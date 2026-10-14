import type { Me, SessionSummary } from "@repo/types";
import Base from "./base.js";
import type { PasswordChange, ProfileChanges } from "./types/index.js";

/** The signed-in user's own account. These calls need a session, not a key. */
export default class Account extends Base {
  /** Changes the display name, the sign-in email, or both. */
  public async update(changes: ProfileChanges) {
    return await this.request<Me>("PUT", this.apiUrl("/api/me"), changes);
  }

  public async changePassword({
    currentPassword,
    newPassword,
    revokeOtherSessions = false,
  }: PasswordChange) {
    return await this.request<null>("PUT", this.apiUrl("/api/me/password"), {
      currentPassword,
      newPassword,
      revokeOtherSessions,
    });
  }

  /** Every device signed in to the account, the current one first. */
  public async getSessions() {
    return await this.request<{ sessions: SessionSummary[] }>(
      "GET",
      this.apiUrl("/api/me/sessions"),
    );
  }

  /** Signs out another device. The current session ends with a sign-out instead. */
  public async revokeSession(id: string) {
    return await this.request<null>("DELETE", this.apiUrl("/api/me/sessions"), {
      id,
    });
  }

  /** Signs out every device but the current one. */
  public async revokeOtherSessions() {
    return await this.request<null>("DELETE", this.apiUrl("/api/me/sessions"), {
      others: true,
    });
  }
}
