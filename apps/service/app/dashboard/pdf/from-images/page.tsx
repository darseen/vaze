import ToolPage, { toolMetadata } from "../../_components/tool-page";
import ImagesToPdf from "../_components/images-to-pdf";

export const metadata = toolMetadata("pdf", "from-images");

export default function Page() {
  return (
    <ToolPage group="pdf" slug="from-images">
      <ImagesToPdf />
    </ToolPage>
  );
}
