import db, { schema } from "@/db";
import { users } from "@/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  // Reuse the app's existing secret / URL env vars (set by entrypoint.sh in
  // production) so no new configuration is required to deploy.
  baseURL: process.env.BASE_URL,
  secret: process.env.AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: {
    enabled: true,
    // No email delivery is configured; the single admin signs in immediately.
    requireEmailVerification: false,
    autoSignIn: true,
  },
  // Map Better Auth's default (singular) models onto this project's plural
  // table names.
  user: { modelName: "users" },
  session: { modelName: "sessions" },
  account: { modelName: "accounts" },
  verification: { modelName: "verifications" },
  databaseHooks: {
    user: {
      create: {
        // Single-admin model: enforce that at most one account can ever exist,
        // regardless of entry point (the register action *or* a direct POST to
        // Better Auth's /api/auth/sign-up/email endpoint).
        before: async (user) => {
          const existing = db.select({ id: users.id }).from(users).limit(1).get();
          if (existing) {
            throw new APIError("FORBIDDEN", {
              message: "An admin account already exists.",
            });
          }
          return { data: user };
        },
      },
    },
  },
  // `nextCookies` must be the last plugin: it forwards Better Auth's Set-Cookie
  // headers into Next.js when auth.api.* is called from server actions.
  plugins: [nextCookies()],
});
