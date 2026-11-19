import * as documentQueue from "@/lib/document-conversion";
import {
  convertDocument,
  DOCUMENT_CONVERSION_OFF_MESSAGE,
  isDocumentConversionEnabled,
} from "@/lib/document-conversion";
import { toPdfName } from "@/utils/pdf-tools";
import { NextRequest } from "next/server";
import { handlePdfTool } from "../../_utils/pdf";

/** Turns a document, spreadsheet or presentation into a PDF with LibreOffice. */
export function POST(request: NextRequest) {
  return handlePdfTool(request, {
    label: "document to pdf",
    bucket: "document-conversion",
    limit: 20,
    queue: documentQueue,
    disabled: () =>
      isDocumentConversionEnabled() ? null : DOCUMENT_CONVERSION_OFF_MESSAGE,
    sources: { min: 1, max: 1 },
    parse: () => undefined,
    run: async ({ sources: [source], workDir, signal }) => ({
      kind: "file",
      path: await convertDocument(source, workDir, signal),
      name: toPdfName(source.name),
    }),
  });
}
