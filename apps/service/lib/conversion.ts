// both ship in the image's ffmpeg package; set these for binaries off PATH
export const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
export const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

export class ConversionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ConversionError";
    this.status = status;
  }
}

export function toConversionError(error: unknown, message: string): Error {
  if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") {
    return new ConversionError("ffmpeg is not installed on this server", 503);
  }
  if (error instanceof Error && error.name === "AbortError") return error;
  return new ConversionError(message, 422);
}
