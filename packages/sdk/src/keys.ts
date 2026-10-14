import type { ApiKeySummary, CreatedApiKey } from "@repo/types";
import Base from "./base.js";
import type { NewKeyOptions } from "./types/index.js";

/** The caller's API keys. These calls need a signed-in session, not a key. */
export default class Keys extends Base {
  /** Every key the caller owns, newest first. */
  public async getAll() {
    return await this.request<{ keys: ApiKeySummary[] }>(
      "GET",
      this.apiUrl("/api/keys"),
    );
  }

  /** The response holds the key's secret, which can't be read again later. */
  public async create({ name, scopes, expiresAt }: NewKeyOptions) {
    return await this.request<{ key: CreatedApiKey }>(
      "POST",
      this.apiUrl("/api/keys"),
      {
        name,
        scopes,
        expiresAt:
          expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt,
      },
    );
  }

  public async rename(data: { id: string; name: string }) {
    return await this.request<null>("PUT", this.apiUrl("/api/keys"), data);
  }

  /** Revokes the key at once for anything using it. */
  public async delete(id: string) {
    return await this.request<null>("DELETE", this.apiUrl("/api/keys"), {
      id,
    });
  }
}
