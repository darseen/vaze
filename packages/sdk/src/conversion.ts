import type { ApiResponse, VideoFormat, VideoJob } from "@repo/types";
import Base from "./base.js";
import type {
  ConversionSource,
  ImageConversionOptions,
  VideoConversionOptions,
  VideoWaitOptions,
} from "./types/index.js";

/** Resolves after `ms`, or rejects as soon as `signal` aborts. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Converting files from one format to another. */
export default class Conversion extends Base {
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

  /**
   * Convert a video and wait for the result: starts the job, polls it until
   * it is done, downloads the file and removes it from the server. Pass a
   * stored file's `id`, or a `file` from the caller's device. `format: "mp3"`
   * keeps only its sound.
   */
  public async video(
    source: ConversionSource,
    options: VideoConversionOptions = {},
    { onProgress, signal, pollInterval = 1000 }: VideoWaitOptions = {},
  ): Promise<
    ApiResponse<{ blob: Blob; filename: string | null; contentType: string }>
  > {
    const started = await this.startVideo(source, options);
    if (started.error) return { data: null, error: started.error };

    let job = started.data;
    const { id } = job;
    const stop = () => void this.cancelVideo(id);
    signal?.addEventListener("abort", stop, { once: true });

    try {
      onProgress?.(job);
      while (job.status === "queued" || job.status === "converting") {
        await wait(pollInterval, signal);
        const polled = await this.videoJob(id);
        if (polled.error) return { data: null, error: polled.error };
        job = polled.data;
        onProgress?.(job);
      }

      if (job.status === "failed") {
        return {
          data: null,
          error: { message: job.error ?? "The video couldn't be converted." },
        };
      }

      const result = await this.downloadVideo(id);
      // the result is in hand, so the server's copy can go
      if (result.data) await this.cancelVideo(id);
      return result;
    } catch {
      return {
        data: null,
        error: { message: "The video conversion was canceled." },
      };
    } finally {
      signal?.removeEventListener("abort", stop);
    }
  }

  /**
   * Start converting a video without waiting for it. Returns the job, whose
   * progress `videoJob` reports and whose result `downloadVideo` fetches once
   * its status is "done". The result is kept for an hour.
   */
  public async startVideo(
    source: ConversionSource,
    options: VideoConversionOptions = {},
  ) {
    const url = this.videoUrl();
    if ("id" in source) {
      return await this.request<VideoJob>("POST", url, {
        fileId: source.id,
        ...options,
      });
    }

    const formData = new FormData();
    for (const [name, value] of Object.entries(options)) {
      if (value !== undefined) formData.append(name, String(value));
    }
    formData.append("file", source.file as Blob);
    return await this.request<VideoJob>("POST", url, formData);
  }

  /** Where `startVideo` posts; send the request yourself with `authHeaders()`. */
  public videoUrl() {
    return this.apiUrl("/api/conversion/video");
  }

  /** The formats the server converts videos to. Servers before 5.0.0 answer `405`. */
  public async videoFormats() {
    return await this.request<{ formats: VideoFormat[] }>(
      "GET",
      this.videoUrl(),
    );
  }

  /** A video conversion's status and progress. */
  public async videoJob(id: string) {
    return await this.request<VideoJob>(
      "GET",
      this.apiUrl(`/api/conversion/video/${encodeURIComponent(id)}`),
    );
  }

  /** Download a finished conversion's video. */
  public async downloadVideo(id: string) {
    return await this.requestBlob(this.videoDownloadUrl(id));
  }

  /** Where `downloadVideo` fetches from, e.g. to stream the video to disk with `authHeaders()`. */
  public videoDownloadUrl(id: string) {
    return this.apiUrl(
      `/api/conversion/video/${encodeURIComponent(id)}/download`,
    );
  }

  /** Stop a conversion that hasn't finished, or remove one that has, with its result. */
  public async cancelVideo(id: string) {
    return await this.request<null>(
      "DELETE",
      this.apiUrl(`/api/conversion/video/${encodeURIComponent(id)}`),
    );
  }
}
