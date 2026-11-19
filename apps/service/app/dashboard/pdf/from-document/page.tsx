import { isDocumentConversionEnabled } from "@/lib/document-conversion";
import { connection } from "next/server";
import ToolPage, { toolMetadata } from "../../_components/tool-page";
import DocumentToPdf from "../_components/document-to-pdf";

export const metadata = toolMetadata("pdf", "from-document");

export default async function Page() {
  // read on each request, so changing the variable needs no rebuild
  await connection();

  return (
    <ToolPage group="pdf" slug="from-document">
      <DocumentToPdf enabled={isDocumentConversionEnabled()} />
    </ToolPage>
  );
}
