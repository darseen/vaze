import { getPreviewKind } from "./file-type";

/** Constant bitrate of converted audio, so its final size follows from the duration. */
export const MP3_BITRATE_KBPS = 192;

export const toMp3Name = (name: string) =>
  `${name.replace(/\.[^./\\]+$/, "") || "audio"}.mp3`;

/** Expected size in bytes of `seconds` of converted audio. */
export const expectedMp3Bytes = (seconds: number) =>
  Math.ceil((seconds * MP3_BITRATE_KBPS * 1000) / 8);

export const isVideo = (file: { name: string; mimeType: string }) =>
  getPreviewKind(file.name, file.mimeType) === "video";
