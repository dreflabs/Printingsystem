import type { DefaultSession } from "next-auth";

/**
 * Augmentasi tipe NextAuth: field kustom yang kita simpan di JWT & Session
 * (lihat `src/lib/auth.ts` authorize() + `src/lib/auth.config.ts` callbacks).
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
      roles?: string[];
      platform?: boolean;
      subLevel?: string | null;
      /** epoch ms saat password terakhir diganti (untuk revoke sesi lama) */
      pwChangedAt?: number;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    roles?: string[];
    platform?: boolean;
    subLevel?: string | null;
    pwChangedAt?: number;
  }
}

interface AppToken {
  id?: string;
  role?: string;
  roles?: string[];
  platform?: boolean;
  subLevel?: string | null;
  pwChangedAt?: number;
}

declare module "next-auth/jwt" {
  interface JWT extends AppToken {}
}

// Callback `token` di next-auth v5 memakai tipe dari @auth/core — augmentasi
// `next-auth/jwt` saja tidak selalu ter-merge, jadi augmentasi keduanya.
declare module "@auth/core/jwt" {
  interface JWT extends AppToken {}
}
