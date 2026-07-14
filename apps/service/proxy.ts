import { NextRequest, NextResponse } from "next/server";
import { auth } from "./lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Validate the Better Auth session (checks the session row + user in the DB).
  const session = await auth.api.getSession({ headers: request.headers });

  // If the user is signed in and on the homepage, send them to the dashboard.
  if (session && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If the user is trying to access a protected dashboard route without a valid
  // session, redirect to the homepage.
  if (!session && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
};
