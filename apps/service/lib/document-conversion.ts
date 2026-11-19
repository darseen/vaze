import type { ConversionSource } from "@/app/api/_utils/conversion";
import {
  DOCUMENT_CONVERSION_ENV,
  documentExtension,
  LIBREOFFICE_ADDED_SIZE,
} from "@/utils/pdf-tools";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ConversionError } from "./conversion";
import { createTurnQueue } from "./turn-queue";

// pdf-lib draws PDFs but can't lay out a document, so LibreOffice does
const SOFFICE = process.env.SOFFICE_PATH || "soffice";

const TIMEOUT_MS = 120_000;

export const isDocumentConversionEnabled = () =>
  process.env[DOCUMENT_CONVERSION_ENV] === "true";

export const DOCUMENT_CONVERSION_OFF_MESSAGE = `Document conversion is turned off on this server. Set ${DOCUMENT_CONVERSION_ENV}=true for the Vaze container and recreate it, which installs LibreOffice and adds about ${LIBREOFFICE_ADDED_SIZE}`;

// LibreOffice takes a few hundred MB, so one runs at a time
export const { isBusy, acquireTurn } = createTurnQueue({
  maxRunning: 1,
  maxWaiting: 4,
});

// untrusted documents get no macros, OLE, DDE or link updates (Writer's "never" is 0, Calc's is 1)
const LOCKED_DOWN_PROFILE = `<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="DisableActiveContent" oor:op="fuse"><value>true</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="BlockUntrustedRefererLinks" oor:op="fuse"><value>true</value></prop></item>
<item oor:path="/org.openoffice.Office.Writer/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>0</value></prop></item>
<item oor:path="/org.openoffice.Office.Calc/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>1</value></prop></item>
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>1</value></prop></item>
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="ODFRecalcMode" oor:op="fuse"><value>1</value></prop></item>
</oor:items>
`;

// how LibreOffice reads text and CSV, which carry no encoding of their own
const INPUT_FILTERS: Record<string, string> = {
  txt: "Text (encoded):UTF8,LF,,,",
  csv: "Text - txt - csv (StarCalc):44,34,76,1",
};

/** The file's name without its extension, safe to stand alone in a folder. */
function inputName(name: string): string {
  const base = name
    .replace(/\.[^./\\]+$/, "")
    .replace(/[/\\\0]/g, "_")
    .trim()
    .slice(0, 120);
  // a leading dot would hide it
  return base && !base.startsWith(".") ? base : "document";
}

/** Turns a document into a PDF in `workDir`, with a LibreOffice profile of its own there. */
export async function convertDocument(
  source: ConversionSource,
  workDir: string,
  signal: AbortSignal,
): Promise<string> {
  const extension = documentExtension(source.name);
  if (!extension) {
    throw new ConversionError(
      "This file isn't a document that can be turned into a PDF",
      422,
    );
  }

  const inputDir = path.join(workDir, "in");
  const outputDir = path.join(workDir, "out");
  const profileDir = path.join(workDir, "profile");
  await fs.mkdir(path.join(profileDir, "user"), { recursive: true });
  await fs.mkdir(inputDir, { recursive: true });
  await fs.writeFile(
    path.join(profileDir, "user", "registrymodifications.xcu"),
    LOCKED_DOWN_PROFILE,
  );

  // LibreOffice reads the type from the extension and titles the PDF after the name
  const input = path.join(inputDir, `${inputName(source.name)}.${extension}`);
  await fs.symlink(source.path, input);

  const filter = INPUT_FILTERS[extension];
  const args = [
    `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
    "--headless",
    "--invisible",
    "--norestore",
    "--nolockcheck",
    "--nodefault",
    ...(filter ? [`--infilter=${filter}`] : []),
    "--convert-to",
    "pdf",
    "--outdir",
    outputDir,
    input,
  ];

  await new Promise<void>((resolve, reject) => {
    // its own process group, so stopping it takes the soffice.bin it starts too
    const proc = spawn(SOFFICE, args, {
      detached: true,
      stdio: ["ignore", "ignore", "pipe"],
      env: { ...process.env, HOME: workDir },
    });

    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2000);
    });

    const kill = () => {
      if (proc.pid === undefined) return;
      try {
        process.kill(-proc.pid, "SIGKILL");
      } catch {
        // already gone
      }
    };
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, TIMEOUT_MS);
    signal.addEventListener("abort", kill, { once: true });

    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", kill);
    };

    proc.once("error", (error: NodeJS.ErrnoException) => {
      done();
      reject(
        error.code === "ENOENT"
          ? new ConversionError(
              "LibreOffice isn't installed, so documents can't be converted. Restart the Vaze container to install it again, or install LibreOffice where Vaze runs",
              503,
            )
          : error,
      );
    });
    proc.once("close", (code) => {
      done();
      // whatever soffice.bin left behind goes with it
      kill();
      if (signal.aborted) return reject(signal.reason);
      if (timedOut) {
        return reject(
          new ConversionError(
            "This document took too long to convert, try a smaller one",
            422,
          ),
        );
      }
      if (code !== 0) {
        // it crashes on some damaged files, which are the file's fault rather than the server's
        console.error(`soffice exited with ${code}: ${stderr.trim()}`);
        return reject(
          new ConversionError(
            "This document is damaged or can't be turned into a PDF",
            422,
          ),
        );
      }
      resolve();
    });
  });

  // LibreOffice exits 0 even when it couldn't read the file, leaving no PDF
  const output = path.join(
    outputDir,
    `${path.basename(input, path.extname(input))}.pdf`,
  );
  const stats = await fs.stat(output).catch(() => null);
  if (!stats?.size) {
    throw new ConversionError(
      "This document is damaged or can't be turned into a PDF",
      422,
    );
  }
  return output;
}
