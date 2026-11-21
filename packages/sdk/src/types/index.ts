import type {
  FileWithUrl,
  Limits,
  Role,
  Scope,
  VideoCodec,
  VideoFormat,
  VideoJob,
  Visibility,
} from "@repo/types";
import type Account from "../account.js";
import type Activity from "../activity.js";
import type Conversion from "../conversion.js";
import type Deleted from "../deleted.js";
import type Files from "../files.js";
import type Folders from "../folders.js";
import type Keys from "../keys.js";
import type Settings from "../settings.js";
import type Users from "../users.js";

export interface IVaze {
  files: Files;
  folders: Folders;
  deleted: Deleted;
  conversion: Conversion;
  keys: Keys;
  account: Account;
  activity: Activity;
  users: Users;
  settings: Settings;
}

export type VazeHeaders =
  | Record<string, string>
  | (() => Record<string, string> | Promise<Record<string, string>>);

// type aliases (not interfaces) so they satisfy the Record-typed `params`
// argument of `Base.apiUrl` via their implicit index signatures
export type VazeOptions = {
  apiKey?: string;
  vazeUrl?: string;
  /**
   * Headers sent with every request, such as a Better Auth session cookie.
   * A function is called before each request. Replaces the need for `apiKey`.
   */
  headers?: VazeHeaders;
  /** Replaces the global `fetch`, e.g. to set `credentials` or a timeout. */
  fetch?: typeof fetch;
};

/** A file on disk in React Native, which streams it from `uri` on upload. */
export type FileReference = {
  uri: string;
  name: string;
  type: string;
};

/** Which tools a server offers; each is false on a server too old for it, or with its section turned off. */
export type Tools = {
  /** Video conversion, in Vaze 4.8.0 and later. */
  video: boolean;
  /** Keeping only a video's sound, with `format: "mp3"`, in Vaze 5.0.0 and later. */
  audio: boolean;
  /** Image conversion, in Vaze 4.6.0 and later. */
  image: boolean;
};

/** A stored file by its id, or a file from the caller's device. */
export type ConversionSource = { id: string } | { file: File | FileReference };

export type ImageFormat = "webp" | "jpeg" | "png" | "avif";

export type ImageConversionOptions = {
  format: ImageFormat;
  /** 1 to 100. Defaults to 80, or 50 for AVIF; PNG ignores it. */
  quality?: number;
  /** Fits the image inside `width` × `height`; only an SVG is ever made larger. */
  width?: number;
  height?: number;
};

export type VideoQuality = "high" | "balanced" | "small";

export type VideoConversionOptions = {
  /**
   * Defaults to "mp4". A GIF has no codec and no sound. An MP3 keeps only the
   * sound, at 256, 192 or 128 kbps for each `quality`, and takes no codec,
   * resolution, fps, target size or `audio: false`.
   */
  format?: VideoFormat;
  /**
   * Defaults to H.264, or VP9 for WebM. "copy" keeps the streams as they are
   * and changes only the container, so it takes no quality, size or fps.
   */
  codec?: VideoCodec;
  /** The short side to fit, e.g. 720 for 1280 × 720; never made larger. GIFs default to 480. */
  resolution?: number | "original";
  /** The most frames a second; a slower video keeps its own. GIFs default to 15. */
  fps?: number | "original";
  /** Seconds, or text such as "1:30", where the result starts. */
  start?: number | string;
  /** Seconds, or text such as "1:30", where the result ends. */
  end?: number | string;
  /** false leaves the sound out. */
  audio?: boolean;
} & (
  | {
      /** Defaults to "balanced". */
      quality?: VideoQuality;
      targetSize?: never;
    }
  | {
      /** Bytes the result fits in, made in two passes; not for GIFs. */
      targetSize: number;
      quality?: never;
    }
);

export type VideoWaitOptions = {
  /** Called with the job each time it is polled, and once as it starts. */
  onProgress?: (job: VideoJob) => void;
  /** Aborting stops the conversion on the server too. */
  signal?: AbortSignal;
  /** Milliseconds between polls. Defaults to 1000. */
  pollInterval?: number;
};

export type ListOptions = {
  limit?: number;
  offset?: number;
  orderBy?: "createdAt" | "updatedAt" | "name" | "size";
  orderDirection?: "ASC" | "DESC";
};

/** The widths a hosting URL can resize an image to (`?w=`). */
export type HostedImageWidth =
  64 | 128 | 256 | 320 | 480 | 640 | 800 | 1024 | 1280 | 1600 | 1920 | 2560;

export type SignOptions = {
  id?: string;
  key?: string;
  /** Seconds the link stays valid. Capped server-side, default one hour. */
  expiresIn?: number;
  /** Sign a link to the image resized to this width, never made larger. */
  width?: HostedImageWidth;
  /**
   * Sign a link to the image in this format. Without one, a resize keeps JPG,
   * PNG, WebP and AVIF in their own format and makes other images WebP.
   */
  format?: ImageFormat;
};

export type SignedUrl = {
  url: string;
  expiresAt: string;
};

export type MoveDestination = {
  /** The destination folder's id. Either this or `folder` is required. */
  folderId?: string;
  /** The destination folder's key, created if missing; `""` is the root. */
  folder?: string;
};

export type BulkMoveResult = {
  files: FileWithUrl[];
  failed: { id: string; message: string }[];
};

export type NewKeyOptions = {
  name: string;
  /** Only `files:read`, `files:write` and `files:delete`, and only ones the caller holds. */
  scopes: Scope[];
  /** Leave it out, or pass `null`, for a key that never expires. */
  expiresAt?: Date | string | null;
};

export type ProfileChanges = {
  name?: string;
  /** The new sign-in email; it applies right away. */
  email?: string;
};

export type PasswordChange = {
  currentPassword: string;
  /** At least 8 characters. */
  newPassword: string;
  /** Signs out every other device too. */
  revokeOtherSessions?: boolean;
};

export type UserAccess = {
  role: Role;
  /** Only read for the `custom` role, which needs at least one. `users:manage` can't be picked. */
  scopes?: Scope[];
};

export type NewUserOptions = UserAccess & {
  name: string;
  email: string;
  /** At least 8 characters. */
  password: string;
};

export type SettingsChanges = {
  defaultVisibility?: Visibility;
  limits?: Partial<Limits>;
};

export type BulkDeleteResult = {
  deleted: string[];
  failed: { id: string; message: string }[];
};

export type BulkRestoreResult = {
  restored: string[];
  failed: { id: string; message: string }[];
};

export type DeleteOptions = {
  /** Skip Recently deleted and remove it from storage right away. */
  permanent?: boolean;
};
