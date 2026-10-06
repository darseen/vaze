import {
  getDocument,
  PDFWorker,
  VerbosityLevel,
} from "pdfjs-dist/legacy/build/pdf.mjs";

// broken uploads would otherwise flood the console with parser warnings
const verbosity = VerbosityLevel.ERRORS;

let worker: PDFWorker | null = null;

// passed explicitly so destroying one document never tears down the others
function sharedWorker() {
  worker ??= PDFWorker.create({
    port: new Worker(new URL("./pdf.worker.ts", import.meta.url), {
      type: "module",
    }),
    verbosity,
  });
  return worker;
}

/** Draw the top of a PDF's first page across the full width of `canvas`. */
export async function renderPdfThumbnail(
  url: string,
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
) {
  signal.throwIfAborted();

  const task = getDocument({
    url,
    worker: sharedWorker(),
    // fetch only the byte ranges the first page needs
    disableAutoFetch: true,
    disableStream: true,
    rangeChunkSize: 1024 * 1024,
    verbosity,
  });

  const destroy = () => task.destroy().catch(() => {});
  signal.addEventListener("abort", destroy);

  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);

    const ratio = window.devicePixelRatio || 1;
    const { width } = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: (canvas.clientWidth * ratio) / width,
    });

    canvas.width = Math.round(canvas.clientWidth * ratio);
    canvas.height = Math.round(canvas.clientHeight * ratio);

    await page.render({ canvas, viewport }).promise;
  } finally {
    signal.removeEventListener("abort", destroy);
    await destroy();
  }
}
