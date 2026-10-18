import type { ApiResponse, FileWithUrl, Me, Stats } from "@repo/types";
import Account from "./account.js";
import Activity from "./activity.js";
import Base from "./base.js";
import Files from "./files.js";
import Folders from "./folders.js";
import Keys from "./keys.js";
import Settings from "./settings.js";
import Users from "./users.js";
import type { IVaze, VazeOptions } from "./types/index.js";
import { constructFileUrls } from "./utils/index.js";

export default class Vaze extends Base implements IVaze {
  public files: Files;
  public folders: Folders;
  public keys: Keys;
  public account: Account;
  public activity: Activity;
  public users: Users;
  public settings: Settings;

  constructor(options: VazeOptions = {}) {
    super(options);

    this.files = new Files(options);
    this.folders = new Folders(options);
    this.keys = new Keys(options);
    this.account = new Account(options);
    this.activity = new Activity(options);
    this.users = new Users(options);
    this.settings = new Settings(options);
  }

  public async health() {
    return await this.request<{ message: string }>(
      "GET",
      this.apiUrl("/api/health"),
    );
  }

  /** Whether the instance still needs its first account, which becomes the admin. */
  public async setupStatus() {
    return await this.request<{ needed: boolean }>(
      "GET",
      this.apiUrl("/api/setup"),
    );
  }

  /** The caller's account and the scopes it may use. */
  public async me() {
    return await this.request<Me>("GET", this.apiUrl("/api/me"));
  }

  /** Dashboard numbers, with each section limited to the caller's scopes. */
  public async stats(): Promise<ApiResponse<Stats>> {
    const response = await this.request<Stats>(
      "GET",
      this.apiUrl("/api/stats"),
    );
    if (response.data === null) return response;

    const { files, hosting } = response.data;
    const vazeUrl = this.vazeUrl;
    const withUrl = (file: FileWithUrl) => ({
      ...file,
      url: constructFileUrls({ vazeUrl, files: [file] })[0]!.url,
    });

    return {
      error: null,
      data: {
        ...response.data,
        files: files
          ? {
              ...files,
              largest: constructFileUrls({ vazeUrl, files: files.largest }),
              recent: constructFileUrls({ vazeUrl, files: files.recent }),
            }
          : null,
        // servers that predate traffic leave `hosting` out, so keep it out
        ...(hosting
          ? {
              hosting: {
                ...hosting,
                top: hosting.top.map((entry) => ({
                  ...entry,
                  file: withUrl(entry.file),
                })),
              },
            }
          : {}),
      },
    };
  }
}

export type {
  ActivityEntry as Activity,
  ActivityType,
  ApiKeySummary as ApiKey,
  ApiKeyUsage,
  ApiResponse,
  CreatedApiKey,
  FileWithUrl as File,
  Folder,
  InstanceSettings,
  Limits,
  Me,
  Role,
  Scope,
  SessionSummary as Session,
  Stats,
  StatsAlert,
  TrafficDay,
  UserSummary as User,
  Visibility,
} from "@repo/types";
export type {
  BulkDeleteResult,
  BulkMoveResult,
  FileReference,
  ListOptions,
  MoveDestination,
  NewKeyOptions,
  NewUserOptions,
  PasswordChange,
  ProfileChanges,
  SettingsChanges,
  SignedUrl,
  SignOptions,
  UserAccess,
  VazeHeaders,
  VazeOptions,
} from "./types/index.js";
