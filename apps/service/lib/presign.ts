import { keyToUrl } from "@/app/api/_utils";
import { DEFAULT_PRESIGN_TTL_SECONDS, MAX_PRESIGN_TTL_SECONDS } from "@/constants";
import crypto from "node:crypto";

const VERSION = "v1";
const INFO = "vaze-presign-v1";

let cachedSecret: Buffer | null = null;

// Derived from AUTH_SECRET so signing needs no second secret. Rotating
// AUTH_SECRET therefore invalidates every outstanding signed URL.
function signingSecret(): Buffer {
  if (cachedSecret) return cachedSecret;

  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    throw new Error("AUTH_SECRET must be set to sign URLs");
  }

  cachedSecret = Buffer.from(
    crypto.hkdfSync("sha256", authSecret, "", INFO, 32),
  );

  return cachedSecret;
}

/**
 * Sign the *decoded* key. The hosting route decodes percent-encoding before
 * looking a file up, so signing the encoded form would let a re-encoding verify
 * against a different key than the one served.
 */
export function signKey(key: string, expiresAt: number): string {
  return crypto
    .createHmac("sha256", signingSecret())
    .update(`${VERSION}\n${key}\n${expiresAt}`)
    .digest("base64url");
}

export function verifySignature(
  key: string,
  exp: string | null,
  signature: string | null,
): boolean {
  if (!exp || !signature) return false;

  const expiresAt = Number.parseInt(exp, 10);
  if (!Number.isFinite(expiresAt)) return false;
  if (expiresAt * 1000 <= Date.now()) return false;

  let expected: string;
  try {
    expected = signKey(key, expiresAt);
  } catch (error) {
    console.error("failed to verify a signed url", error);
    return false;
  }

  const provided = Buffer.from(signature);
  const digest = Buffer.from(expected);

  // timingSafeEqual throws on a length mismatch, which a truncated signature
  // would trigger
  if (provided.length !== digest.length) return false;

  return crypto.timingSafeEqual(provided, digest);
}

/** Mint a relative, time-limited hosting URL for a key. */
export function buildSignedUrl(
  key: string,
  ttlSeconds = DEFAULT_PRESIGN_TTL_SECONDS,
): { url: string; expiresAt: string } {
  const ttl = Math.min(
    Math.max(Math.floor(ttlSeconds), 1),
    MAX_PRESIGN_TTL_SECONDS,
  );
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;

  const params = new URLSearchParams({
    exp: String(expiresAt),
    sig: signKey(key, expiresAt),
  });

  return {
    url: `${keyToUrl(key)}?${params}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}
