import ToolPage, { toolMetadata } from "../../_components/tool-page";
import VideoConverter from "../_components/video-converter";

export const metadata = toolMetadata("conversion", "video");

export default function Page() {
  return (
    <ToolPage group="conversion" slug="video">
      <VideoConverter />
    </ToolPage>
  );
}
