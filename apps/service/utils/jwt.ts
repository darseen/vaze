import { JWTPayload, jwtVerify, SignJWT } from "jose";

// Sessions live for 7 days, matching the auth cookie's maxAge so a valid
// cookie never carries an already-expired token.
const TOKEN_EXPIRATION = "7d";

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. Refusing to sign or verify tokens with an empty key.",
    );
  }
  return new TextEncoder().encode(secret);
}

export function issueJWT(user: { id: string; username: string }) {
  const token = new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(TOKEN_EXPIRATION)
    .setIssuedAt()
    .sign(getSecret());

  return token;
}

export async function verifyToken(token: string) {
  try {
    const decoded = await jwtVerify<
      JWTPayload & { user: { id: string; username: string } }
    >(token, getSecret());
    return decoded.payload;
  } catch {
    return null;
  }
}
