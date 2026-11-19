import * as pdfQueue from "@/lib/pdf";
import { checkInputSize, runPdfJob } from "@/lib/pdf";
import { MAX_PDF_SOURCES, toMergedName } from "@/utils/pdf-tools";
import { NextRequest } from "next/server";
import path from "node:path";
import { handlePdfTool } from "../../_utils/pdf";

/** Joins PDFs into one, in the order sent: stored ones by id, device ones as uploads. */
export function POST(request: NextRequest) {
  return handlePdfTool(request, {
    label: "pdf merge",
    bucket: "pdf",
    limit: 60,
    queue: pdfQueue,
    sources: { min: 2, max: MAX_PDF_SOURCES },
    parse: (_fields, sources) => checkInputSize(sources),
    run: async ({ sources, workDir, signal }) => {
      const output = path.join(workDir, "merged.pdf");
      const { pages } = await runPdfJob(
        { kind: "merge", inputs: sources, output },
        signal,
      );
      return {
        kind: "file",
        path: output,
        name: toMergedName(sources[0].name),
        headers: { "X-Pdf-Pages": String(pages) },
      };
    },
  });
}
