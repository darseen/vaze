import { NextRequest, NextResponse } from "next/server";
import db from "./db";
import { verifyToken } from "./utils/jwt";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  // If the user has a token and is on the homepage, redirect to the dashboard.
  if (token && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If the user is trying to access a protected dashboard route without a token, redirect to the homepage.
  if (!token && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If a token exists for a protected route, verify it.
  if (token && pathname.startsWith("/dashboard")) {
    // verify token
    const payload = await verifyToken(token);
    if (!payload) {
      // Token is invalid, redirect to the homepage and clear the invalid token.
      const response = NextResponse.redirect(new URL("/", request.url));
      response.cookies.delete("token");
      return response;
    }

    // check if user exists in the database
    const user = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(payload.user.id);
    if (!user) {
      // Token is invalid, redirect to the homepage and clear the invalid token.
      const response = NextResponse.redirect(new URL("/", request.url));
      response.cookies.delete("token");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
  runtime: "nodejs",
};
