import { cookies } from "next/headers";
import { verifyToken } from "./jwt";

export default async function auth() {
  try {
    const token = (await cookies()).get("token")?.value;
    if (!token) return null;

    const decoded = await verifyToken(token);
    if (!decoded) return null;

    return decoded.user;
  } catch {
    return null;
  }
}
