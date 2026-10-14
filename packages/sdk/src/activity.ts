import type { ActivityEntry } from "@repo/types";
import Base from "./base.js";

/** The caller's activity history. These calls need a session, not a key. */
export default class Activity extends Base {
  /** The most recent entries, newest first. */
  public async getAll() {
    return await this.request<{ activities: ActivityEntry[] }>(
      "GET",
      this.apiUrl("/api/activity"),
    );
  }

  public async delete(ids: string[]) {
    return await this.request<{ deleted: number }>(
      "DELETE",
      this.apiUrl("/api/activity"),
      { ids },
    );
  }

  /** Deletes every entry. Files, keys and accounts are not affected. */
  public async clear() {
    return await this.request<{ deleted: number }>(
      "DELETE",
      this.apiUrl("/api/activity"),
      { all: true },
    );
  }
}
