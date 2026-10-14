import type { UserSummary } from "@repo/types";
import Base from "./base.js";
import type { NewUserOptions, UserAccess } from "./types/index.js";

/** Accounts on the instance. These calls need an admin's session. */
export default class Users extends Base {
  /** Every account, oldest first. */
  public async getAll() {
    return await this.request<{ users: UserSummary[] }>(
      "GET",
      this.apiUrl("/api/users"),
    );
  }

  public async create(options: NewUserOptions) {
    return await this.request<{ user: UserSummary }>(
      "POST",
      this.apiUrl("/api/users"),
      options,
    );
  }

  /** Applies right away, to the user's sessions and API keys alike. */
  public async setAccess({
    id,
    role,
    scopes = [],
  }: UserAccess & { id: string }) {
    return await this.request<{ user: UserSummary }>(
      "PUT",
      this.apiUrl("/api/users"),
      { id, role, scopes },
    );
  }

  /** Also signs the user out of every device. */
  public async resetPassword({
    id,
    password,
  }: {
    id: string;
    password: string;
  }) {
    return await this.request<{ user: UserSummary }>(
      "PUT",
      this.apiUrl("/api/users"),
      { id, password },
    );
  }

  /** A disabled user is signed out and their API keys stop until re-enabled. */
  public async setDisabled({
    id,
    disabled,
  }: {
    id: string;
    disabled: boolean;
  }) {
    return await this.request<{ user: UserSummary }>(
      "PUT",
      this.apiUrl("/api/users"),
      { id, disabled },
    );
  }

  /** Removes the account, its API keys and its history. Files stay. */
  public async delete(id: string) {
    return await this.request<null>("DELETE", this.apiUrl("/api/users"), {
      id,
    });
  }
}
