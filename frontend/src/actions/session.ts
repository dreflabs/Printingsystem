"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { getCurrentUser } from "@/lib/actor";
import { getCurrentTenant } from "@/lib/tenant";
import { IMPERSONATE_COOKIE } from "@/lib/platform";

export type WorkspaceMode = "SOLO" | "TEAM_SMALL" | "TEAM_FULL";

/** Nilai yang tidak dikenal / null → SOLO (tampilan paling sederhana, fail-safe). */
function normalizeWorkspaceMode(v: unknown): WorkspaceMode {
  return v === "TEAM_FULL" || v === "TEAM_SMALL" ? v : "SOLO";
}

export interface SessionUser {
  id: string;
  name: string;
  role: string;
  roles: string[];
  /** Tampilan navigasi & beranda tenant — BUKAN izin. */
  workspaceMode: WorkspaceMode;
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

  // workspace_mode ikut dari tenant aktif (bukan dari JWT — supaya perubahan
  // mode langsung terasa tanpa menunggu token lama kedaluwarsa).
  const tenant = await getCurrentTenant().catch(() => null);
  const workspaceMode = normalizeWorkspaceMode(
    (tenant as { workspace_mode?: string } | null)?.workspace_mode
  );

  if (u?.id && !u.platform) {
    return {
      ok: true,
      user: {
        id: u.id,
        name: u.name ?? "Pengguna",
        role: u.role ?? "admin",
        roles: u.roles ?? (u.role ? [u.role] : []),
        workspaceMode,
      },
    };
  }

  const fb = await getCurrentUser();
  if (fb) return { ok: true, user: { id: fb.id, name: fb.name, role: fb.role, roles: [fb.role], workspaceMode } };
  return { ok: false };
}

export async function signOutAction() {
  (await cookies()).delete(IMPERSONATE_COOKIE);
  // redirect: false + redirect() relatif — di belakang reverse proxy, redirectTo
  // Auth.js kadang jadi URL absolut ke origin internal (localhost:3000).
  await signOut({ redirect: false });
  redirect("/login");
}
