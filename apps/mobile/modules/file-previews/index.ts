import { NativeModule, requireOptionalNativeModule } from "expo";

export type VideoFrame = {
  width: number;
  height: number;
  /** In seconds, 0 when the container doesn't say. */
  duration: number;
};

export type PdfInfo = { pages: { width: number; height: number }[] };

declare class FilePreviewsModule extends NativeModule {
  /** Writes an early frame of a remote video to `target` as a JPEG. */
  videoFrame(
    url: string,
    headers: Record<string, string>,
    target: string,
  ): Promise<VideoFrame>;
  /** Each page's size in points, with its rotation applied. */
  pdfInfo(path: string): Promise<PdfInfo>;
  /** Renders a page `width` pixels wide to `target` as a JPEG. */
  pdfPage(
    path: string,
    index: number,
    width: number,
    target: string,
  ): Promise<{ width: number; height: number }>;
}

// missing until the app is rebuilt with the module, so callers fall back to icons
export default requireOptionalNativeModule<FilePreviewsModule>("FilePreviews");
