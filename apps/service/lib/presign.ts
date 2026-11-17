import { keyToUrl } from "@/app/api/_utils";
import { transformParams, type ImageTransform } from "@/lib/image-transform";
import { getLimits } from "@/lib/settings";
import crypto from "node:crypto";

const VERSION = "v1";
// a resize signs under its own first line, so no signature verifies on both sides
const IMAGE_VERSION = "v1-image";
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
 *
 * A `transform` is covered too, so a link to one size can't be edited into
 * another, or into the original. The key goes last because it is the only
 * part that can hold a newline.
 */
export function signKey(
  key: string,
  expiresAt: number,
  transform: ImageTransform | null = null,
): string {
  const payload = transform
    ? `${IMAGE_VERSION}\n${transformParams(transform)}\n${expiresAt}\n${key}`
    : `${VERSION}\n${key}\n${expiresAt}`;

  return crypto
    .createHmac("sha256", signingSecret())
    .update(payload)
    .digest("base64url");
}

export function verifySignature(
  key: string,
  exp: string | null,
  signature: string | null,
  transform: ImageTransform | null = null,
): boolean {
  if (!exp || !signature) return false;

  const expiresAt = Number.parseInt(exp, 10);
  if (!Number.isFinite(expiresAt)) return false;
  if (expiresAt * 1000 <= Date.now()) return false;

  let expected: string;
  try {
    expected = signKey(key, expiresAt, transform);
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

/** Mint a relative, time-limited hosting URL for a key, resized if asked. */
export function buildSignedUrl(
  key: string,
  ttlSeconds?: number,
  transform: ImageTransform | null = null,
): { url: string; expiresAt: string } {
  const { defaultPresignTtl, maxPresignTtl } = getLimits();
  const ttl = Math.min(
    Math.max(Math.floor(ttlSeconds ?? defaultPresignTtl), 1),
    maxPresignTtl,
  );
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;

  const params = transform ? transformParams(transform) : new URLSearchParams();
  params.set("exp", String(expiresAt));
  params.set("sig", signKey(key, expiresAt, transform));

  return {
    url: `${keyToUrl(key)}?${params}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}
