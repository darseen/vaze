import { formatBytes } from "@/utils";
import type { FileWithUrl } from "@repo/types";
import { useEffect, useState } from "react";
import { Loading, NoPreview } from "./status";

// a single text node beyond this makes scrolling sluggish
const TEXT_VIEW_BYTES = 1024 * 1024;

export default function TextView({ file }: { file: FileWithUrl }) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const src = `/${file.url}`;

  useEffect(() => {
    const controller = new AbortController();

    fetch(src, {
      headers: { Range: `bytes=0-${TEXT_VIEW_BYTES - 1}` },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Unexpected ${response.status}`);
        return response.arrayBuffer();
      })
      .then((buffer) => {
        // `stream` holds back a multi-byte character the range cut in half
        const content = new TextDecoder().decode(
          buffer.slice(0, TEXT_VIEW_BYTES),
          { stream: true },
        );
        if (content.includes("\0")) throw new Error("Binary content");

        setText(content);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });

    return () => controller.abort();
  }, [src]);

  if (failed) {
    return <NoPreview file={file} message="This file can't be shown as text" />;
  }
  if (text === null) return <Loading />;

  return (
    <div className="size-full touch-pan-y touch-pinch-zoom overflow-y-auto p-4">
      <pre className="bg-card text-card-foreground mx-auto max-w-4xl rounded-lg border p-4 font-mono text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
        {text}
      </pre>
      {file.size > TEXT_VIEW_BYTES && (
        <p className="text-muted-foreground mx-auto mt-3 max-w-4xl text-center text-sm">
          Showing the first {formatBytes(TEXT_VIEW_BYTES)}. Download the file to
          see the rest.
        </p>
      )}
    </div>
  );
}
