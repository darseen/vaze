export type {
  Account,
  Activity,
  ActivityType,
  ApiKey,
  ApiRequest,
  File,
  Folder,
  Session,
  User,
  Verification,
  Visibility,
} from "@repo/db";

import type { File } from "@repo/db";

export type ApiResponse<T> =
  | {
      data: T;
      error: null;
    }
  | {
      data: null;
      error: { message: string };
    };

export type FileWithUrl = File & { url: string };
