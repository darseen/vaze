import { NextRequest, NextResponse } from "next/server";
import { auth } from "./lib/auth";
import { isToolSectionEnabled, toolSectionOfApi } from "./lib/tool-sections";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // a tool section turned off answers as if it didn't exist, which is also how apps tell
  const section = toolSectionOfApi(pathname);
  if (section) {
    return isToolSectionEnabled(section)
      ? NextResponse.next()
      : NextResponse.json(
          { data: null, error: { message: "Not found" } },
          { status: 404 },
        );
  }

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
  matcher: [
    "/",
    "/dashboard/:path*",
    "/api/conversion/:path*",
    "/api/pdf/:path*",
  ],
};
