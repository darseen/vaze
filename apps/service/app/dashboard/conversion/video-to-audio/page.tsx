import ToolPage, { toolMetadata } from "../../_components/tool-page";
import VideoToAudio from "../_components/video-to-audio";

export const metadata = toolMetadata("conversion", "video-to-audio");

export default function Page() {
  return (
    <ToolPage group="conversion" slug="video-to-audio">
      <VideoToAudio />
    </ToolPage>
  );
}
