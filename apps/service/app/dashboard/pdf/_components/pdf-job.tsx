import { formatBytes } from "@/utils";
import { FileArchive, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  ConversionFailed,
  ConversionProgress,
  ConversionReady,
} from "../../conversion/_components/conversion-parts";
import {
  requestConversion,
  type ConversionSource,
} from "../../conversion/_components/request-conversion";

type Status =
  | { phase: "idle" }
  | { phase: "uploading"; progress: number }
  | { phase: "working"; progress: number | null }
  | {
      phase: "done";
      url: string;
      name: string;
      size: number;
      /** Pages in the PDF, or parts in a ZIP. */
      count: number | null;
      zip: boolean;
    }
  | { phase: "error"; message: string };

const IDLE: Status = { phase: "idle" };

export interface PdfJob {
  url: string;
  sources: ConversionSource[];
  options?: Record<string, string | number | boolean | object>;
  /** What the result is saved as. */
  name: string;
  zip?: boolean;
}

/** Runs one PDF tool request at a time, and drops it when the card goes. */
export function usePdfJob() {
  const [status, setStatus] = useState<Status>(IDLE);
  const cancelRef = useRef<(() => void) | null>(null);
  const resultUrl = status.phase === "done" ? status.url : null;
  const busy = status.phase === "uploading" || status.phase === "working";

  // leaving the page cancels the request
  useEffect(() => () => cancelRef.current?.(), []);

  useEffect(() => {
    if (!resultUrl) return;
    return () => URL.revokeObjectURL(resultUrl);
  }, [resultUrl]);

  function start({ url, sources, options, name, zip = false }: PdfJob) {
    if (busy) return;

    const finish = (next: Status) => {
      cancelRef.current = null;
      setStatus(next);
    };

    setStatus(
      sources.some((source) => source.kind === "device")
        ? { phase: "uploading", progress: 0 }
        : { phase: "working", progress: null },
    );

    cancelRef.current = requestConversion(
      { url, sources, options },
      {
        onUploadProgress: (fraction) =>
          setStatus(
            fraction < 1
              ? { phase: "uploading", progress: fraction }
              : { phase: "working", progress: null },
          ),
        onProgress: (_received, progress) =>
          setStatus({ phase: "working", progress }),
        onDone: (result, header) => {
          const count = Number(header(zip ? "X-Pdf-Parts" : "X-Pdf-Pages"));
          finish({
            phase: "done",
            url: URL.createObjectURL(result),
            name: zip ? `${name}.zip` : name,
            size: result.size,
            count: count > 0 ? count : null,
            zip,
          });
        },
        onError: (message) => finish({ phase: "error", message }),
      },
    );
  }

  function cancel() {
    cancelRef.current?.();
    cancelRef.current = null;
    setStatus(IDLE);
  }

  /** Forgets the result, e.g. once the files or options it was made from change. */
  function reset() {
    if (!busy) setStatus(IDLE);
  }

  return { status, busy, start, cancel, reset };
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

export function PdfJobStatus({
  status,
  workingLabel,
}: {
  status: Status;
  /** e.g. "Merging PDFs…" */
  workingLabel: string;
}) {
  if (status.phase === "idle") return null;

  let content;
  if (status.phase === "error") {
    content = <ConversionFailed message={status.message} />;
  } else if (status.phase === "done") {
    const Icon = status.zip ? FileArchive : FileText;
    const details = [
      status.count === null
        ? null
        : status.zip
          ? plural(status.count, "PDF", "PDFs")
          : plural(status.count, "page", "pages"),
      formatBytes(status.size),
    ];
    content = (
      <ConversionReady
        title={status.zip ? "Your PDFs are ready" : "Your PDF is ready"}
        preview={
          <div className="bg-secondary text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <Icon size={18} />
          </div>
        }
        name={status.name}
        details={details.filter(Boolean).join(" · ")}
        url={status.url}
        downloadLabel={status.zip ? "Download ZIP" : "Download PDF"}
      />
    );
  } else if (status.phase === "uploading") {
    content = (
      <ConversionProgress label="Uploading…" progress={status.progress} />
    );
  } else {
    content = (
      <ConversionProgress label={workingLabel} progress={status.progress} />
    );
  }

  return (
    <div className="bg-muted/40 mt-3 rounded-xl border p-4">{content}</div>
  );
}
