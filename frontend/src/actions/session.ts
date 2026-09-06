"use server";

import { cookies } from "next/headers";
import { auth, signOut } from "@/lib/auth";
import { getCurrentUser } from "@/lib/actor";
import { IMPERSONATE_COOKIE } from "@/lib/platform";

export interface SessionUser {
  id: string;
  name: string;
  role: string;
  roles: string[];
}

/**
 * User yang sedang login (dari sesi NextAuth). Selama AUTH_BYPASS aktif dan
 * belum ada sesi, jatuh ke dev-fallback (owner/admin pertama) — sama seperti
 * `requireUser` di server actions, supaya UI konsisten dengan data.
 */
export async function getSessionUser(): Promise<
  { ok: true; user: SessionUser } | { ok: false }
> {
  const session = await auth();
  const u = session?.user as
    | { id?: string; name?: string | null; role?: string; roles?: string[]; platform?: boolean }
    | undefined;

  if (u?.id && !u.platform) {
    return {
      ok: true,
      user: {
        id: u.id,
        name: u.name ?? "Pengguna",
        role: u.role ?? "admin",
        roles: u.roles ?? (u.role ? [u.role] : []),
      },
    };
  }

  const fb = await getCurrentUser();
  if (fb) return { ok: true, user: { id: fb.id, name: fb.name, role: fb.role, roles: [fb.role] } };
  return { ok: false };
}

export async function signOutAction() {
  (await cookies()).delete(IMPERSONATE_COOKIE);
  await signOut({ redirectTo: "/login" });
}
