import { NativeModule, requireOptionalNativeModule } from "expo";

declare class DownloadsModule extends NativeModule {
  /** Copies a local file into the shared Downloads folder; resolves with the name it got. */
  save(path: string, name: string, mimeType: string): Promise<string>;
}

// Android only, and missing until the app is rebuilt with the module
export default requireOptionalNativeModule<DownloadsModule>("Downloads");
