import { createHash, randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Perangkat kiosk absensi (02-WORKFLOW/18-ABSENSI-IN-APP.md Fase B).
 * Autentikasi kiosk = token panjang di cookie perangkat (bukan sesi user).
 * Hanya hash SHA-256 token yang disimpan; token mentah ditampilkan sekali.
 */

export const KIOSK_COOKIE = "pp_kiosk";
export const KIOSK_MAX_AGE_SEC = 60 * 60 * 24 * 365; // 1 tahun

export function hashKioskToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newKioskToken(): string {
  return randomBytes(24).toString("base64url");
}

export interface KioskContext {
  deviceId: string;
  tenantId: string;
  label: string;
}

/** Baca cookie kiosk → perangkat aktif, atau null. Menyentuh `last_seen_at` best-effort. */
export async function resolveKioskDevice(): Promise<KioskContext | null> {
  const jar = await cookies();
  const raw = jar.get(KIOSK_COOKIE)?.value;
  if (!raw) return null;
  const device = await prisma.kioskDevice.findFirst({
    where: { token_hash: hashKioskToken(raw), active: true },
    select: { id: true, tenant_id: true, label: true },
  });
  if (!device) return null;
  void prisma.kioskDevice
    .update({ where: { id: device.id }, data: { last_seen_at: new Date() } })
    .catch(() => {});
  return { deviceId: device.id, tenantId: device.tenant_id, label: device.label };
}

/** Cookie kiosk pakai Secure hanya kalau request datang lewat https (Coolify bisa http). */
export async function kioskCookieSecure(): Promise<boolean> {
  const proto = (await headers()).get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return process.env.NODE_ENV === "production";
}
