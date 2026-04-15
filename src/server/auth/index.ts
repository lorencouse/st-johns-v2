import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/server/db";
import { and, eq } from "drizzle-orm";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/server/db/schema";

type UserRole = "user" | "premium" | "admin";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  providers: [
    Google({
      authorization: {
        params: {
          scope: "openid email profile",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account: oauthAccount }) {
      // Update stored tokens/scopes on every sign-in (Auth.js only writes on first sign-in)
      if (oauthAccount && user.id) {
        await db
          .update(accounts)
          .set({
            access_token: oauthAccount.access_token,
            refresh_token: oauthAccount.refresh_token ?? undefined,
            expires_at: oauthAccount.expires_at,
            scope: oauthAccount.scope,
            id_token: oauthAccount.id_token,
            token_type: oauthAccount.token_type,
          })
          .where(
            and(
              eq(accounts.provider, oauthAccount.provider),
              eq(accounts.providerAccountId, oauthAccount.providerAccountId)
            )
          );
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
      }
      // Load role from DB on sign-in or refresh
      if (token.id && (trigger === "signIn" || !token.role)) {
        const [dbUser] = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, token.id as string))
          .limit(1);
        token.role = dbUser?.role ?? "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role =
          (token.role as UserRole) ?? "user";
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
});
