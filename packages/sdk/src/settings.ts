import type { InstanceSettings, Visibility } from "@repo/types";
import Base from "./base.js";
import type { SettingsChanges } from "./types/index.js";

/** Instance-wide settings. These calls need an admin's session. */
export default class Settings extends Base {
  public async get() {
    return await this.request<InstanceSettings>(
      "GET",
      this.apiUrl("/api/settings"),
    );
  }

  /** Limits left out keep their current values. */
  public async update(changes: SettingsChanges) {
    return await this.request<InstanceSettings>(
      "PUT",
      this.apiUrl("/api/settings"),
      changes,
    );
  }

  /** Gives every existing file this visibility. */
  public async applyVisibility(visibility: Visibility) {
    return await this.request<{ updated: number }>(
      "POST",
      this.apiUrl("/api/settings/apply-visibility"),
      { visibility },
    );
  }
}
