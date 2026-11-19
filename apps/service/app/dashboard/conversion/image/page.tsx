import ToolPage, { toolMetadata } from "../../_components/tool-page";
import ImageConverter from "../_components/image-converter";

export const metadata = toolMetadata("conversion", "image");

export default function Page() {
  return (
    <ToolPage group="conversion" slug="image">
      <ImageConverter />
    </ToolPage>
  );
}
