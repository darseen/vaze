import type { DeletedItem } from "@repo/types";
import Base from "./base.js";
import type { BulkDeleteResult, BulkRestoreResult } from "./types/index.js";

/** Files and folders that were deleted and can still be restored. */
export default class Deleted extends Base {
  /** Most recently deleted first, with how many days items are kept. */
  public async getAll() {
    return await this.request<{ items: DeletedItem[]; retentionDays: number }>(
      "GET",
      this.apiUrl("/api/deleted"),
    );
  }

  /** Put items back where they were; one whose name is taken now fails. */
  public async restore(ids: string[]) {
    return await this.request<BulkRestoreResult>(
      "POST",
      this.apiUrl("/api/deleted/restore"),
      { ids },
    );
  }

  /** Delete items for good, before their time is up. */
  public async purge(ids: string[]) {
    return await this.request<BulkDeleteResult>(
      "DELETE",
      this.apiUrl("/api/deleted"),
      { ids },
    );
  }

  /** Delete everything in it for good. */
  public async empty() {
    return await this.request<BulkDeleteResult>(
      "DELETE",
      this.apiUrl("/api/deleted"),
      { all: true },
    );
  }
}
