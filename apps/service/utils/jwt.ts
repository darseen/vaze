import { JWTPayload, jwtVerify, SignJWT } from "jose";

export function issueJWT(user: { id: string; username: string }) {
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
  const token = new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1d")
    .setIssuedAt()
    .sign(secret);

  return token;
}

export async function verifyToken(token: string) {
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
    const decoded = await jwtVerify<
      JWTPayload & { user: { id: string; username: string } }
    >(token, secret);
    return decoded.payload;
  } catch {
    return null;
  }
}
