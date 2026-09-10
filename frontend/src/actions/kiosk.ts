"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { hashKioskToken, newKioskToken } from "@/lib/kiosk";
import { safeError } from "@/lib/safe-error";
import { ok, fail, type ActionResult } from "@/types";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  designer_sales: "Designer / Setting",
  operator: "Operator",
  gudang: "Finishing & Gudang",
};

export interface KioskDeviceRow {
  id: string;
  label: string;
  lastSeenAt: Date | null;
  active: boolean;
  createdAt: Date;
}

async function ownerGuard() {
  const tenant = await requireTenant();
  const actor = await requireUser();
  if (!actor.roles.includes("owner")) throw new Error("Hanya Owner yang boleh mengelola perangkat kiosk.");
  return { tenant, actor };
}

export async function listKioskDevices(): Promise<ActionResult<KioskDeviceRow[]>> {
  try {
    const { tenant } = await ownerGuard();
    const rows = await prisma.kioskDevice.findMany({
      where: { tenant_id: tenant.id },
      orderBy: { created_at: "desc" },
    });
    return ok(
      rows.map((d) => ({
        id: d.id,
        label: d.label,
        lastSeenAt: d.last_seen_at,
        active: d.active,
        createdAt: d.created_at,
      }))
    );
  } catch (e) {
    return fail(safeError(e, "Gagal memuat perangkat kiosk."));
  }
}

/** Buat perangkat kiosk baru. Token mentah dikembalikan SEKALI. */
export async function createKioskDevice(label: string): Promise<ActionResult<{ id: string; label: string; token: string }>> {
  try {
    const { tenant, actor } = await ownerGuard();
    const clean = label.trim().slice(0, 60);
    if (clean.length < 2) return fail("Nama perangkat minimal 2 karakter.");

    const token = newKioskToken();
    const device = await prisma.kioskDevice.create({
      data: { tenant_id: tenant.id, label: clean, token_hash: hashKioskToken(token), created_by: actor.id },
    });
    await logAction(actor.id, "KIOSK_DEVICE_CREATED", "KioskDevice", device.id, null, { label: clean });
    revalidatePath("/owner/attendance-settings");
    return ok({ id: device.id, label: clean, token });
  } catch (e) {
    return fail(safeError(e, "Gagal membuat perangkat kiosk."));
  }
}

export async function revokeKioskDevice(id: string): Promise<ActionResult<null>> {
  try {
    const { tenant, actor } = await ownerGuard();
    const device = await prisma.kioskDevice.findFirst({ where: { id, tenant_id: tenant.id } });
    if (!device) return fail("Perangkat tidak ditemukan.");
    await prisma.kioskDevice.update({ where: { id }, data: { active: false } });
    await logAction(actor.id, "KIOSK_DEVICE_REVOKED", "KioskDevice", id, { active: true }, { active: false });
    revalidatePath("/owner/attendance-settings");
    return ok(null);
  } catch (e) {
    return fail(safeError(e, "Gagal mencabut perangkat."));
  }
}

export interface KioskPinRow {
  id: string;
  name: string;
  roleLabel: string;
  hasPin: boolean;
}

/** Daftar pegawai (non-owner) untuk pengaturan PIN kiosk. */
export async function listEmployeesForKiosk(): Promise<ActionResult<KioskPinRow[]>> {
  try {
    const { tenant } = await ownerGuard();
    const users = await prisma.user.findMany({
      where: { tenant_id: tenant.id, active: true },
      select: { id: true, name: true, kiosk_pin_hash: true, role: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    return ok(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        roleLabel: ROLE_LABEL[u.role.name] ?? u.role.name,
        hasPin: !!u.kiosk_pin_hash,
      }))
    );
  } catch (e) {
    return fail(safeError(e, "Gagal memuat daftar pegawai."));
  }
}
