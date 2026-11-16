import Base from "./base.js";
import type {
  ConversionSource,
  ImageConversionOptions,
} from "./types/index.js";

/** Converting files from one format to another. */
export default class Conversion extends Base {
  /**
   * Extract a video's audio as an MP3. Pass a stored file's `id`, or a `file`
   * from the caller's device, which the server keeps only until it is done.
   */
  public async videoToAudio(source: ConversionSource) {
    const url = this.videoToAudioUrl();
    if ("id" in source) {
      return await this.requestBlob(url, "POST", { fileId: source.id });
    }

    const formData = new FormData();
    // React Native's FormData reads uri, name and type off a plain object
    formData.append("file", source.file as Blob);
    return await this.requestBlob(url, "POST", formData);
  }

  /** Where `videoToAudio` posts; stream it yourself with `authHeaders()`. */
  public videoToAudioUrl() {
    return this.apiUrl("/api/conversion/video-to-audio");
  }

  /**
   * Convert an image to WebP, JPG, PNG or AVIF, and resize it if asked. Pass a
   * stored file's `id`, or a `file` from the caller's device, which the server
   * keeps only until it is done.
   */
  public async image(
    source: ConversionSource,
    options: ImageConversionOptions,
  ) {
    const url = this.imageUrl();
    if ("id" in source) {
      return await this.requestBlob(url, "POST", {
        fileId: source.id,
        ...options,
      });
    }

    const formData = new FormData();
    for (const [name, value] of Object.entries(options)) {
      if (value !== undefined) formData.append(name, String(value));
    }
    formData.append("file", source.file as Blob);
    return await this.requestBlob(url, "POST", formData);
  }

  /** Where `image` posts; send the request yourself with `authHeaders()`. */
  public imageUrl() {
    return this.apiUrl("/api/conversion/image");
  }
}
