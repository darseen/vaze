import ToolPage, { toolMetadata } from "../../_components/tool-page";
import EditPdf from "../_components/edit-pdf";

export const metadata = toolMetadata("pdf", "edit");

export default function Page() {
  return (
    <ToolPage group="pdf" slug="edit">
      <EditPdf />
    </ToolPage>
  );
}
