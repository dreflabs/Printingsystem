"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { hhmmToMinutes } from "@/lib/attendance";
import { safeError } from "@/lib/safe-error";
import { ok, fail, type ActionResult } from "@/types";

export interface AttendanceSettings {
  workStart: string;
  lateAfter: string;
  workEnd: string;
  workdays: number[];
  breakMaxMin: number;
  earliestClockInMin: number;
  geofenceLat: number | null;
  geofenceLng: number | null;
  geofenceRadiusM: number;
  geofenceMode: "OFF" | "FLAG" | "ENFORCE";
  ipAllowlist: string;
  ipMode: "OFF" | "FLAG" | "ENFORCE";
  selfieRequired: boolean;
  selfieRetentionDays: number;
  kioskEnabled: boolean;
  personalDeviceEnabled: boolean;
  autoCloseAt: string;
}

const MODES = ["OFF", "FLAG", "ENFORCE"] as const;

/** Ambil (atau buat default) pengaturan absensi tenant aktif. */
export async function getAttendanceSettings(): Promise<ActionResult<AttendanceSettings>> {
  try {
    const tenant = await requireTenant();
    const row = await prisma.tenantAttendanceSetting.upsert({
      where: { tenant_id: tenant.id },
      update: {},
      create: { tenant_id: tenant.id },
    });
    return ok(shape(row));
  } catch (e) {
    console.error("getAttendanceSettings:", e);
    return fail(safeError(e, "Gagal memuat pengaturan absensi."));
  }
}

export async function updateAttendanceSettings(
  patch: Partial<AttendanceSettings>
): Promise<ActionResult<AttendanceSettings>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!actor.roles.includes("owner"))
      return fail("Hanya Owner yang boleh mengubah pengaturan absensi.");

    const before = await prisma.tenantAttendanceSetting.upsert({
      where: { tenant_id: tenant.id },
      update: {},
      create: { tenant_id: tenant.id },
    });

    const data: Record<string, unknown> = {};

    if (patch.workStart !== undefined) data.work_start = reqTime(patch.workStart, "Jam masuk");
    if (patch.lateAfter !== undefined) data.late_after = reqTime(patch.lateAfter, "Batas telat");
    if (patch.workEnd !== undefined) data.work_end = reqTime(patch.workEnd, "Jam pulang");
    if (patch.autoCloseAt !== undefined) data.auto_close_at = reqTime(patch.autoCloseAt, "Jam auto-tutup");

    const ws = (data.work_start ?? before.work_start) as string;
    const la = (data.late_after ?? before.late_after) as string;
    const we = (data.work_end ?? before.work_end) as string;
    if (hhmmToMinutes(la)! < hhmmToMinutes(ws)!)
      return fail("Batas telat tidak boleh lebih awal dari jam masuk.");
    if (hhmmToMinutes(we)! <= hhmmToMinutes(ws)!)
      return fail("Jam pulang harus setelah jam masuk.");

    if (patch.workdays !== undefined) {
      const set = [...new Set(patch.workdays.filter((n) => n >= 1 && n <= 7))].sort();
      if (set.length === 0) return fail("Pilih minimal satu hari kerja.");
      data.workdays = set.join(",");
    }
    if (patch.breakMaxMin !== undefined) data.break_max_min = clampInt(patch.breakMaxMin, 15, 240, "Batas istirahat");
    if (patch.earliestClockInMin !== undefined)
      data.earliest_clock_in_min = clampInt(patch.earliestClockInMin, 0, 720, "Batas absen awal");
    if (patch.selfieRetentionDays !== undefined)
      data.selfie_retention_days = clampInt(patch.selfieRetentionDays, 7, 730, "Retensi selfie");
    if (patch.geofenceRadiusM !== undefined)
      data.geofence_radius_m = clampInt(patch.geofenceRadiusM, 20, 2000, "Radius geofence");

    if (patch.geofenceLat !== undefined) data.geofence_lat = orNullFloat(patch.geofenceLat, -90, 90, "Lintang");
    if (patch.geofenceLng !== undefined) data.geofence_lng = orNullFloat(patch.geofenceLng, -180, 180, "Bujur");

    if (patch.geofenceMode !== undefined) data.geofence_mode = reqMode(patch.geofenceMode);
    if (patch.ipMode !== undefined) data.ip_mode = reqMode(patch.ipMode);
    if (patch.ipAllowlist !== undefined) data.ip_allowlist = patch.ipAllowlist.trim().slice(0, 2000);

    if (patch.selfieRequired !== undefined) data.selfie_required = !!patch.selfieRequired;
    if (patch.kioskEnabled !== undefined) data.kiosk_enabled = !!patch.kioskEnabled;
    if (patch.personalDeviceEnabled !== undefined) data.personal_device_enabled = !!patch.personalDeviceEnabled;

    // Hanya mode ENFORCE yang wajib punya titik. FLAG tanpa titik = tidak menandai
    // apa pun (aman) sampai Owner mengisi koordinatnya.
    if ((data.geofence_mode ?? before.geofence_mode) === "ENFORCE") {
      const lat = data.geofence_lat ?? before.geofence_lat;
      const lng = data.geofence_lng ?? before.geofence_lng;
      if (lat == null || lng == null)
        return fail("Titik geofence (lintang & bujur) wajib diisi untuk mode 'Tolak absen'.");
    }
    if (!(data.kiosk_enabled ?? before.kiosk_enabled) && !(data.personal_device_enabled ?? before.personal_device_enabled))
      return fail("Minimal satu jalur absen harus aktif (kiosk atau HP pribadi).");

    const updated = await prisma.tenantAttendanceSetting.update({
      where: { tenant_id: tenant.id },
      data,
    });

    await logAction(
      actor.id,
      "ATTENDANCE_SETTING_UPDATED",
      "TenantAttendanceSetting",
      updated.id,
      pick(before),
      pick(updated)
    );
    revalidatePath("/owner/attendance-settings");
    return ok(shape(updated));
  } catch (e) {
    console.error("updateAttendanceSettings:", e);
    return fail(safeError(e, "Gagal menyimpan pengaturan absensi."));
  }
}

/** Owner/Admin men-set PIN kiosk seorang pegawai (hanya hash disimpan). */
export async function setEmployeePin(userId: string, pin: string): Promise<ActionResult<null>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!actor.roles.includes("owner") && !actor.roles.includes("admin"))
      return fail("Hanya Owner/Admin yang boleh mengatur PIN kiosk.");

    const target = await prisma.user.findFirst({ where: { id: userId, tenant_id: tenant.id } });
    if (!target) return fail("Pegawai tidak ditemukan.");

    const trimmed = pin.trim();
    if (trimmed === "") {
      await prisma.user.update({ where: { id: userId }, data: { kiosk_pin_hash: null } });
      await logAction(actor.id, "ATTENDANCE_PIN_CLEARED", "User", userId, null, null);
      return ok(null);
    }
    if (!/^\d{4,6}$/.test(trimmed)) return fail("PIN harus 4–6 digit angka.");
    const hash = await bcrypt.hash(trimmed, 12);
    await prisma.user.update({ where: { id: userId }, data: { kiosk_pin_hash: hash } });
    await logAction(actor.id, "ATTENDANCE_PIN_SET", "User", userId, null, null);
    revalidatePath("/owner/users");
    return ok(null);
  } catch (e) {
    console.error("setEmployeePin:", e);
    return fail(safeError(e, "Gagal menyimpan PIN."));
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

type Row = Awaited<ReturnType<typeof prisma.tenantAttendanceSetting.upsert>>;

function shape(r: Row): AttendanceSettings {
  return {
    workStart: r.work_start,
    lateAfter: r.late_after,
    workEnd: r.work_end,
    workdays: r.workdays.split(",").map(Number).filter((n) => n >= 1 && n <= 7),
    breakMaxMin: r.break_max_min,
    earliestClockInMin: r.earliest_clock_in_min,
    geofenceLat: r.geofence_lat,
    geofenceLng: r.geofence_lng,
    geofenceRadiusM: r.geofence_radius_m,
    geofenceMode: r.geofence_mode as AttendanceSettings["geofenceMode"],
    ipAllowlist: r.ip_allowlist,
    ipMode: r.ip_mode as AttendanceSettings["ipMode"],
    selfieRequired: r.selfie_required,
    selfieRetentionDays: r.selfie_retention_days,
    kioskEnabled: r.kiosk_enabled,
    personalDeviceEnabled: r.personal_device_enabled,
    autoCloseAt: r.auto_close_at,
  };
}

function pick(r: Row) {
  const { id, tenant_id, created_at, updated_at, ...rest } = r;
  void id; void tenant_id; void created_at; void updated_at;
  return rest as Record<string, unknown>;
}

function reqTime(v: string, label: string): string {
  if (hhmmToMinutes(v) == null) throw new Error(`${label} harus format HH:mm.`);
  return v.trim();
}
function reqMode(v: string): string {
  if (!(MODES as readonly string[]).includes(v)) throw new Error("Mode tidak valid.");
  return v;
}
function clampInt(v: number, min: number, max: number, label: string): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < min || n > max)
    throw new Error(`${label} harus antara ${min} dan ${max}.`);
  return n;
}
function orNullFloat(v: number | null, min: number, max: number, label: string): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} tidak valid.`);
  return n;
}
