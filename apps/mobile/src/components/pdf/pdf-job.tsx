import type { File as DeviceFile } from "expo-file-system";
import { Button } from "heroui-native";
import { FileArchive, FileText } from "lucide-react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import {
  ConversionFailed,
  ConversionProgress,
  ConversionReady,
  ResultActions,
} from "@/components/conversion/conversion-parts";
import { Icon } from "@/components/icon";
import { useServer } from "@/components/server-context";
import { formatBytes } from "@/lib/format";
import {
  PDF_MIME_TYPE,
  runPdfTool,
  ZIP_MIME_TYPE,
  type PdfToolRequest,
} from "@/lib/pdf-tools";

type Status =
  | { phase: "idle" }
  | { phase: "uploading"; progress: number }
  | { phase: "working"; progress: number | null }
  | {
      phase: "done";
      file: DeviceFile;
      /** Pages in a PDF, or PDFs in a split's ZIP. */
      count: number | null;
      zip: boolean;
    }
  | { phase: "error"; message: string };

const IDLE: Status = { phase: "idle" };

export type PdfJob = ReturnType<typeof usePdfJob>;

/** Runs one PDF tool request at a time, dropped when the screen goes. */
export function usePdfJob() {
  const { vaze } = useServer();
  const [status, setStatus] = useState<Status>(IDLE);
  const cancelRef = useRef<(() => void) | null>(null);
  // events from a canceled run are ignored
  const runRef = useRef(0);
  const busy = status.phase === "uploading" || status.phase === "working";

  useEffect(() => () => cancelRef.current?.(), []);

  function start(request: PdfToolRequest, { zip = false } = {}) {
    const run = ++runRef.current;
    const live = () => runRef.current === run;
    const finish = (final: Status) => {
      if (!live()) return;
      cancelRef.current = null;
      setStatus(final);
    };

    setStatus(
      request.sources.some((source) => source.kind === "device")
        ? { phase: "uploading", progress: 0 }
        : { phase: "working", progress: null },
    );

    cancelRef.current = runPdfTool(vaze, request, {
      onUploadProgress: (fraction) => {
        if (!live()) return;
        setStatus(
          fraction < 1
            ? { phase: "uploading", progress: fraction }
            : { phase: "working", progress: null },
        );
      },
      onProgress: (_received, progress) => {
        if (live()) setStatus({ phase: "working", progress });
      },
      onDone: (file, header) => {
        const count = Number(header(zip ? "X-Pdf-Parts" : "X-Pdf-Pages"));
        finish({ phase: "done", file, count: count > 0 ? count : null, zip });
      },
      onError: (message) => finish({ phase: "error", message }),
    });
  }

  function cancel() {
    cancelRef.current?.();
    cancelRef.current = null;
    runRef.current++;
    setStatus(IDLE);
  }

  /** Forgets a result once the files or options it was made from change. */
  function reset() {
    if (!busy) setStatus(IDLE);
  }

  return { status, busy, start, cancel, reset };
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** The job's progress or result, then Save and Share, Cancel, or the tool's own button. */
export function PdfJobFooter({
  job,
  workingLabel,
  againLabel,
  onAgain,
  action,
}: {
  job: PdfJob;
  /** e.g. "Merging PDFs…" */
  workingLabel: string;
  againLabel: string;
  onAgain: () => void;
  /** The tool's button, shown until there's a result. */
  action: ReactNode;
}) {
  const { status } = job;

  let panel: ReactNode = null;
  if (status.phase === "error") {
    panel = <ConversionFailed message={status.message} />;
  } else if (status.phase === "done") {
    const details = [
      status.count === null
        ? null
        : status.zip
          ? plural(status.count, "PDF", "PDFs")
          : plural(status.count, "page", "pages"),
      formatBytes(status.file.size ?? 0),
    ];
    panel = (
      <ConversionReady
        title={status.zip ? "Your PDFs are ready" : "Your PDF is ready"}
        preview={
          <View className="size-10 items-center justify-center rounded-xl bg-default">
            <Icon icon={status.zip ? FileArchive : FileText} size={20} />
          </View>
        }
        name={status.file.name}
        details={details.filter(Boolean).join(" · ")}
      />
    );
  } else if (status.phase !== "idle") {
    panel = (
      <ConversionProgress
        label={status.phase === "uploading" ? "Uploading…" : workingLabel}
        progress={status.progress}
      />
    );
  }

  return (
    <>
      {panel}
      {status.phase === "done" ? (
        <ResultActions
          file={status.file}
          mimeType={status.zip ? ZIP_MIME_TYPE : PDF_MIME_TYPE}
          againLabel={againLabel}
          onAgain={onAgain}
        />
      ) : job.busy ? (
        <Button variant="secondary" onPress={job.cancel}>
          Cancel
        </Button>
      ) : (
        action
      )}
    </>
  );
}
