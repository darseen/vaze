import { db, schema } from "@/db";
import { recordActivity } from "@/lib/activity";
import { markSignedIn } from "@/lib/users";
import { formatIpAddress } from "@/utils";
import { describeUserAgent } from "@/utils/user-agent";
import { expo } from "@better-auth/expo";
import { users, type Role } from "@repo/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

// Better Auth's /admin endpoints are for admins only, and nobody impersonates.
const ac = createAccessControl(defaultStatements);
const noAdminAccess = ac.newRole({ user: [], session: [] });
const roles = {
  admin: ac.newRole({
    user: [
      "create",
      "list",
      "set-role",
      "ban",
      "delete",
      "set-password",
      "set-email",
      "get",
      "update",
    ],
    session: ["list", "revoke", "delete"],
  }),
  editor: noAdminAccess,
  viewer: noAdminAccess,
  custom: noAdminAccess,
} satisfies Record<Role, unknown>;

// a password change also starts a session, and that is not a sign-in
const SIGN_IN_PATHS = new Set(["/sign-in/email", "/sign-up/email"]);

export const auth = betterAuth({
  baseURL: process.env.BASE_URL,
  secret: process.env.AUTH_SECRET,
  // the mobile app's scheme, sent as its origin by the expo plugin
  trustedOrigins: ["vaze://"],
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: {
    enabled: true,
    // no email delivery is configured, so accounts sign in immediately
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
  user: {
    modelName: "users",
    additionalFields: {
      scopes: { type: "string", required: false, input: false },
    },
    // no email is ever sent, so a new address applies immediately
    changeEmail: { enabled: true, updateEmailWithoutVerification: true },
  },
  session: { modelName: "sessions" },
  account: { modelName: "accounts" },
  verification: { modelName: "verifications" },
  databaseHooks: {
    user: {
      create: {
        // Covers the register action and a direct POST to /sign-up/email alike.
        before: async (user, ctx) => {
          const existing = db
            .select({ id: users.id })
            .from(users)
            .limit(1)
            .get();
          // the first account to register owns the instance
          if (!existing) return { data: { ...user, role: "admin" } };
          if (ctx?.path !== "/admin/create-user") {
            throw new APIError("FORBIDDEN", {
              message: "Registration is closed. Ask an admin to add you.",
            });
          }
          return { data: user };
        },
      },
    },
    session: {
      create: {
        // sign-up counts too, since the first account is signed straight in
        after: async (session, ctx) => {
          if (!ctx?.path || !SIGN_IN_PATHS.has(ctx.path)) return;
          markSignedIn(session.userId, session.createdAt);
          recordActivity({
            userId: session.userId,
            type: "account.signed-in",
            target: describeUserAgent(session.userAgent || null),
            detail: session.ipAddress
              ? formatIpAddress(session.ipAddress)
              : null,
          });
        },
      },
    },
  },
  plugins: [
    admin({
      ac,
      roles,
      defaultRole: "viewer",
      bannedUserMessage: "This account has been disabled.",
    }),
    expo(),
    // must stay last so it sees cookies set by the plugins before it
    nextCookies(),
  ],
});
