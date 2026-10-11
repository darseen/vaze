import { useInView } from "@/hooks/use-in-view";
import type { FileWithUrl } from "@repo/types";
import type {
  PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import { useEffect, useRef, useState } from "react";
import { Loading, NoPreview } from "./status";

interface Pdf {
  doc: PDFDocumentProxy;
  /** Height over width of the first page, a stand-in for unrendered pages. */
  ratio: number;
}

function PdfPage({
  doc,
  number,
  ratio: firstPageRatio,
}: {
  doc: PDFDocumentProxy;
  number: number;
  ratio: number;
}) {
  // a viewport of slack either side, so pages are drawn before they scroll in
  const [ref, visible] = useInView<HTMLDivElement>("100% 0px", {
    once: false,
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(firstPageRatio);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || !canvas) return;

    let task: RenderTask | null = null;
    let cancelled = false;

    doc
      .getPage(number)
      .then((page) => {
        if (cancelled) return;

        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale:
            (canvas.clientWidth * (window.devicePixelRatio || 1)) / base.width,
        });

        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        setRatio(base.height / base.width);

        task = page.render({ canvas, viewport });
        return task.promise;
      })
      // a cancelled render rejects
      .catch(() => {});

    return () => {
      cancelled = true;
      task?.cancel();
      // free the bitmap, or a long document holds every page it has shown
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [visible, doc, number]);

  return (
    <div
      ref={ref}
      className="relative w-full bg-white shadow-lg"
      style={{ aspectRatio: `1 / ${ratio}` }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
    </div>
  );
}

export default function PdfView({ file }: { file: FileWithUrl }) {
  const [pdf, setPdf] = useState<Pdf | null>(null);
  const [failed, setFailed] = useState(false);
  const src = `/${file.url}`;

  useEffect(() => {
    const controller = new AbortController();
    let destroy = () => {};

    import("@/utils/pdf-thumbnail")
      .then(({ openPdf }) => {
        controller.signal.throwIfAborted();
        const task = openPdf(src);
        destroy = () => void task.destroy().catch(() => {});
        return task.promise;
      })
      .then(async (doc) => {
        const page = await doc.getPage(1);
        const { width, height } = page.getViewport({ scale: 1 });
        controller.signal.throwIfAborted();
        setPdf({ doc, ratio: height / width });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });

    return () => {
      controller.abort();
      destroy();
    };
  }, [src]);

  if (failed) {
    return <NoPreview file={file} message="This PDF couldn't be opened" />;
  }
  if (!pdf) return <Loading />;

  return (
    <div className="size-full touch-pan-y touch-pinch-zoom overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
        {Array.from({ length: pdf.doc.numPages }, (_, i) => (
          <PdfPage key={i} doc={pdf.doc} number={i + 1} ratio={pdf.ratio} />
        ))}
      </div>
    </div>
  );
}
