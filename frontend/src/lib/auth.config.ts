import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        // Store all roles (primary + extra) as an array
        token.roles = (user as any).roles ?? [(user as any).role];
        token.platform = (user as any).platform ?? false;
        token.subLevel = (user as any).subLevel ?? null;
        token.pwChangedAt = (user as any).pwChangedAt ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
        // Expose roles array on session for multi-role checks
        (session.user as any).roles = token.roles ?? [token.role];
        (session.user as any).platform = token.platform ?? false;
        (session.user as any).subLevel = token.subLevel ?? null;
        (session.user as any).pwChangedAt = token.pwChangedAt ?? 0;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
