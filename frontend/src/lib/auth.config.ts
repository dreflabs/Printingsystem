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
        token.role = user.role;
        // Simpan semua role (utama + tambahan) sebagai array
        token.roles = user.roles ?? (user.role ? [user.role] : []);
        token.platform = user.platform ?? false;
        token.subLevel = user.subLevel ?? null;
        token.pwChangedAt = user.pwChangedAt ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.id) session.user.id = token.id;
        session.user.role = token.role;
        // Ekspos array role di session untuk cek multi-role
        session.user.roles = token.roles ?? (token.role ? [token.role] : []);
        session.user.platform = token.platform ?? false;
        session.user.subLevel = token.subLevel ?? null;
        session.user.pwChangedAt = token.pwChangedAt ?? 0;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
