import ToolPage, { toolMetadata } from "../../_components/tool-page";
import SplitPdf from "../_components/split-pdf";

export const metadata = toolMetadata("pdf", "split");

export default function Page() {
  return (
    <ToolPage group="pdf" slug="split">
      <SplitPdf />
    </ToolPage>
  );
}
