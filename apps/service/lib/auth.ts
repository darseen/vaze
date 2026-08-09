import { db, schema } from "@/db";
import { users } from "@repo/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  baseURL: process.env.BASE_URL,
  secret: process.env.AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: {
    enabled: true,
    // No email delivery is configured; the single admin signs in immediately.
    requireEmailVerification: false,
    autoSignIn: true,
  },
  // On by default in production only; enabling it explicitly means dev behaves
  // the same, and sign-in gets a tighter allowance than the rest.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
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
          const existing = db
            .select({ id: users.id })
            .from(users)
            .limit(1)
            .get();
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
  plugins: [nextCookies()],
});
