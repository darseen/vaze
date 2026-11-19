import * as pdfQueue from "@/lib/pdf";
import { checkInputSize, parseSplitOptions, runPdfJob } from "@/lib/pdf";
import { toPartName, toSplitArchiveName } from "@/utils/pdf-tools";
import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { handlePdfTool } from "../../_utils/pdf";

/** Cuts a PDF into parts by `ranges` or `every` pages, one per page by default, and sends a ZIP. */
export function POST(request: NextRequest) {
  return handlePdfTool(request, {
    label: "pdf split",
    bucket: "pdf",
    limit: 60,
    queue: pdfQueue,
    sources: { min: 1, max: 1 },
    parse: (fields, sources) => {
      checkInputSize(sources);
      return parseSplitOptions(fields);
    },
    run: async ({ sources: [source], options, workDir, signal }) => {
      const { parts = [] } = await runPdfJob(
        { kind: "split", input: source, split: options, outputDir: workDir },
        signal,
      );

      const mtime = new Date();
      return {
        kind: "zip",
        name: toSplitArchiveName(source.name),
        entries: await Promise.all(
          parts.map(async (range, index) => {
            const partPath = path.join(workDir, `${index}.pdf`);
            const { size } = await fs.stat(partPath);
            return {
              type: "file" as const,
              name: toPartName(source.name, range),
              path: partPath,
              size,
              mtime,
            };
          }),
        ),
        headers: { "X-Pdf-Parts": String(parts.length) },
      };
    },
  });
}
