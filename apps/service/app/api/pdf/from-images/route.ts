import * as pdfQueue from "@/lib/pdf";
import {
  checkInputSize,
  parseImagesOptions,
  prepareImages,
  runPdfJob,
} from "@/lib/pdf";
import { MAX_PDF_SOURCES, toPdfName } from "@/utils/pdf-tools";
import { NextRequest } from "next/server";
import path from "node:path";
import { handlePdfTool } from "../../_utils/pdf";

/** Makes a PDF with one image on each page, in the order sent. */
export function POST(request: NextRequest) {
  return handlePdfTool(request, {
    label: "images to pdf",
    bucket: "pdf",
    limit: 60,
    queue: pdfQueue,
    sources: { min: 1, max: MAX_PDF_SOURCES },
    parse: (fields, sources) => {
      checkInputSize(sources);
      return parseImagesOptions(fields);
    },
    run: async ({ sources, options, workDir, signal }) => {
      const images = await prepareImages(sources, workDir, signal);
      const output = path.join(workDir, "images.pdf");
      const { pages } = await runPdfJob(
        { kind: "images", images, ...options, output },
        signal,
      );
      return {
        kind: "file",
        path: output,
        name: toPdfName(sources[0].name),
        headers: { "X-Pdf-Pages": String(pages) },
      };
    },
  });
}
