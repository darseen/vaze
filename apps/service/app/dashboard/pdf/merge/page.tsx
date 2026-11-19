import ToolPage, { toolMetadata } from "../../_components/tool-page";
import MergePdfs from "../_components/merge-pdfs";

export const metadata = toolMetadata("pdf", "merge");

export default function Page() {
  return (
    <ToolPage group="pdf" slug="merge">
      <MergePdfs />
    </ToolPage>
  );
}
