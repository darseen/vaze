import type { Me, Stats } from "@repo/types";
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

  /** The caller's account and the scopes it may use. */
  public async me() {
    return await this.request<Me>("GET", this.apiUrl("/api/me"));
  }

  /** Dashboard numbers, with each section limited to the caller's scopes. */
  public async stats() {
    const { data, error } = await this.request<Stats>(
      "GET",
      this.apiUrl("/api/stats"),
    );
    const files = data?.files;

    return {
      error,
      data: data
        ? {
            ...data,
            files: files
              ? {
                  ...files,
                  largest: constructFileUrls({
                    vazeUrl: this.vazeUrl,
                    files: files.largest,
                  }),
                  recent: constructFileUrls({
                    vazeUrl: this.vazeUrl,
                    files: files.recent,
                  }),
                }
              : null,
          }
        : null,
    };
  }
}

export type {
  ActivityEntry as Activity,
  ActivityType,
  ApiKeySummary as ApiKey,
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
