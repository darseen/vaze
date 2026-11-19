import * as pdfQueue from "@/lib/pdf";
import { checkInputSize, parseEditOptions, runPdfJob } from "@/lib/pdf";
import { toPdfName } from "@/utils/pdf-tools";
import { NextRequest } from "next/server";
import path from "node:path";
import { handlePdfTool } from "../../_utils/pdf";

/** Moves, turns, removes or repeats a PDF's pages, and can number them and retitle it. */
export function POST(request: NextRequest) {
  return handlePdfTool(request, {
    label: "pdf edit",
    bucket: "pdf",
    limit: 60,
    queue: pdfQueue,
    sources: { min: 1, max: 1 },
    parse: (fields, sources) => {
      checkInputSize(sources);
      return parseEditOptions(fields);
    },
    run: async ({ sources: [source], options, workDir, signal }) => {
      const output = path.join(workDir, "edited.pdf");
      const { pages } = await runPdfJob(
        { kind: "edit", input: source, ...options, output },
        signal,
      );
      return {
        kind: "file",
        path: output,
        name: toPdfName(source.name),
        headers: { "X-Pdf-Pages": String(pages) },
      };
    },
  });
}
