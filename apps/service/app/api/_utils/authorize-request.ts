import { verifyToken } from "@/utils/jwt";
import { NextRequest } from "next/server";

export default async function authorizeRequest(request: NextRequest) {
  // authorize the request using the jwt token or an api key
  const token = request.cookies.get("token")?.value;
  const apiKey = request.headers.get("API-Key");

  if (!token && !apiKey) {
    return { error: { message: "Unauthorized" }, data: null };
  } else if (token) {
    const payload = await verifyToken(token);
    if (!payload) {
      return { error: { message: "Unauthorized" }, data: null };
    }

    return { error: null, data: { user: payload.user } };
  }
  //  else if (apiKey) {
  //   // TODO: implement api key verification
  // }

  return { error: null, data: null };
}
