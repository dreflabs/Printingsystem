/**
 * Jejak audit tingkat-platform (`PlatformAuditLog`).
 *
 * Beda dari `tenant_audit_logs`:
 *  - `tenant_audit_logs` WAJIB `tenant_id` → aksi tanpa tenant (login Super Admin,
 *    kelola akun Super Admin lain, MFA) tidak punya tempat.
 *  - `tenant_audit_logs` ikut terhapus saat tenant di-purge → jejak "siapa
 *    menghapus tenant X" hilang. `PlatformAuditLog` menyimpan salinannya dengan
 *    `target_label` (slug) yang tetap terbaca setelah baris tenant hilang.
 *
 * Best-effort: `logPlatform()` TIDAK PERNAH melempar — kegagalan menulis audit
 * tidak boleh menggagalkan aksi yang sedang berjalan.
 */

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export type PlatformAuditAction =
  | "LOGIN_OTP_SENT"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGIN_LOCKED"
  | "LOGOUT"
  | "IMPERSONATE_START"
  | "IMPERSONATE_END"
  | "TENANT_SUSPENDED"
  | "TENANT_ACTIVATED"
  | "TENANT_PLAN_CHANGED"
  | "TENANT_CHURNED"
  | "TENANT_PURGED"
  | "SUPER_ADMIN_CREATED"
  | "SUPER_ADMIN_ACTIVATED"
  | "SUPER_ADMIN_DEACTIVATED"
  | "SUPER_ADMIN_SUBLEVEL_CHANGED"
  | "SUPER_ADMIN_PASSWORD_RESET"
  | "SUPER_ADMIN_UNLOCKED";

export interface PlatformAuditInput {
  actorId?: string | null;
  /** Nama pelaku; di-snapshot supaya tetap terbaca kalau akun dihapus. Default "SYSTEM". */
  actorName?: string;
  actorSubLevel?: string | null;
  action: PlatformAuditAction;
  targetType?: "Tenant" | "SuperAdmin" | null;
  targetId?: string | null;
  /** Label target yang tahan-hapus: slug tenant / email Super Admin. */
  targetLabel?: string | null;
  detail?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

export async function logPlatform(input: PlatformAuditInput): Promise<void> {
  try {
    await prisma.platformAuditLog.create({
      data: {
        actor_id: input.actorId ?? null,
        actor_name: input.actorName?.trim() || "SYSTEM",
        actor_sub_level: input.actorSubLevel ?? null,
        action: input.action,
        target_type: input.targetType ?? null,
        target_id: input.targetId ?? null,
        target_label: input.targetLabel ?? null,
        detail_json: input.detail === undefined ? null : JSON.stringify(input.detail),
        ip: input.ip ?? null,
        user_agent: input.userAgent ? input.userAgent.slice(0, 400) : null,
      },
    });
  } catch (e) {
    console.error("logPlatform:", e);
  }
}

/** Ambil IP + User-Agent dari Request (di belakang reverse proxy Traefik/Coolify). */
export function requestMeta(req: Request | undefined): { ip: string | null; userAgent: string | null } {
  if (!req) return { ip: null, userAgent: null };
  const xff = req.headers.get("x-forwarded-for");
  const ip = xff ? xff.split(",")[0]!.trim() : req.headers.get("x-real-ip");
  return { ip: ip || null, userAgent: req.headers.get("user-agent") };
}

/** Versi untuk Server Action / Route Handler (pakai next/headers). */
export async function headerMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    const ip = xff ? xff.split(",")[0]!.trim() : h.get("x-real-ip");
    return { ip: ip || null, userAgent: h.get("user-agent") };
  } catch {
    return { ip: null, userAgent: null };
  }
}
