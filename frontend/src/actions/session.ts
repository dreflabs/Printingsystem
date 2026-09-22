"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { getCurrentUser } from "@/lib/actor";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantEntitlements } from "@/lib/entitlements";
import { IMPERSONATE_COOKIE } from "@/lib/platform";
import { normalizeWorkspaceMode, type WorkspaceMode } from "@/lib/workspace-mode";

export type { WorkspaceMode };

export interface SessionUser {
  id: string;
  name: string;
  role: string;
  roles: string[];
  /** Tampilan navigasi & beranda tenant — BUKAN izin. */
  workspaceMode: WorkspaceMode;
  /** Kunci entitlement aktif tenant — untuk menyembunyikan menu yang tidak tersedia di paket. `undefined` = jangan sembunyikan apa pun. */
  features?: string[];
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
  const tenantId = (tenant as { id?: string } | null)?.id;
  // Gagal membaca entitlement JANGAN menyembunyikan seluruh menu — biarkan
  // `undefined` supaya sidebar menampilkan item sesuai peran saja.
  let features: string[] | undefined;
  if (tenantId) {
    try {
      features = Array.from((await getTenantEntitlements(tenantId)).features);
    } catch {
      features = undefined;
    }
  }

  if (u?.id && !u.platform) {
    return {
      ok: true,
      user: {
        id: u.id,
        name: u.name ?? "Pengguna",
        role: u.role ?? "admin",
        roles: u.roles ?? (u.role ? [u.role] : []),
        workspaceMode,
        features,
      },
    };
  }

  const fb = await getCurrentUser();
  if (fb) return { ok: true, user: { id: fb.id, name: fb.name, role: fb.role, roles: [fb.role], workspaceMode, features } };
  return { ok: false };
}

export async function signOutAction() {
  (await cookies()).delete(IMPERSONATE_COOKIE);
  // redirect: false + redirect() relatif — di belakang reverse proxy, redirectTo
  // Auth.js kadang jadi URL absolut ke origin internal (localhost:3000).
  await signOut({ redirect: false });
  redirect("/login");
}
