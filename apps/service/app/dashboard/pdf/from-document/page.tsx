import ToolPage, { toolMetadata } from "../../_components/tool-page";
import DocumentToPdf from "../_components/document-to-pdf";

export const metadata = toolMetadata("pdf", "from-document");

export default function Page() {
  return (
    <ToolPage group="pdf" slug="from-document">
      <DocumentToPdf />
    </ToolPage>
  );
}
