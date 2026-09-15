"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { clientIpFromHeaders, shortDeviceLabel } from "@/lib/attendance";
import {
  performClockIn,
  performClockOut,
  PunchError,
  type ClockInResult,
  type ClockOutResult,
} from "@/lib/attendance-punch";
import { safeError } from "@/lib/safe-error";
import { requireAttendanceEligible } from "@/lib/attendance-policy";
import { tenantDayDate } from "@/lib/attendance";
import { ok, fail, type ActionResult } from "@/types";

/**
 * Absen masuk/pulang + istirahat langsung di Print Pilot
 * (02-WORKFLOW/18-ABSENSI-IN-APP.md).
 *
 * Import CSV fingerprint tetap ada sebagai cadangan. Semua waktu dari server;
 * klien tidak pernah mengirim timestamp. Data absensi tidak bisa diedit/dihapus
 * siapa pun — Owner hanya menambah catatan.
 */

export interface BreakStatus {
  recordId: string | null;
  onBreak: boolean;
  breakStart: Date | null;
  breakEnd: Date | null;
  breakDurationMin: number;
  breakStatus: string | null;
  /** menit berjalan sejak mulai istirahat (jika sedang istirahat) */
  elapsedMin: number;
  /** sisa menit menuju batas 60 menit (0 jika sudah lewat) */
  remainingMin: number;
  /** true jika pegawai sudah menyelesaikan jatah istirahat hari ini */
  doneToday: boolean;
}

async function todayRecord(userId: string, tenantId: string, timeZone: string) {
  return prisma.attendanceRecord.findFirst({
    where: { tenant_id: tenantId, user_id: userId, attendance_day: tenantDayDate(new Date(), timeZone) },
    orderBy: { created_at: "desc" },
  });
}

export async function getMyBreakStatus(): Promise<ActionResult<BreakStatus>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    await requireAttendanceEligible(tenant.id, actor);
    const set = await tenantSetting(tenant.id);
    const maxMin = set.break_max_min;
    const rec = await todayRecord(actor.id, tenant.id, set.timezone);
    if (!rec) {
      return ok({
        recordId: null, onBreak: false, breakStart: null, breakEnd: null,
        breakDurationMin: 0, breakStatus: null, elapsedMin: 0, remainingMin: maxMin, doneToday: false,
      });
    }
    const onBreak = !!rec.break_start && !rec.break_end;
    const elapsedMin = rec.break_start && !rec.break_end
      ? Math.floor((Date.now() - rec.break_start.getTime()) / 60000)
      : 0;
    return ok({
      recordId: rec.id,
      onBreak,
      breakStart: rec.break_start,
      breakEnd: rec.break_end,
      breakDurationMin: rec.break_duration_min,
      breakStatus: rec.break_status,
      elapsedMin,
      remainingMin: Math.max(0, maxMin - elapsedMin),
      doneToday: !!rec.break_start && !!rec.break_end,
    });
  } catch (e) {
    console.error("getMyBreakStatus:", e);
    return fail(safeError(e, "Gagal memuat status istirahat."));
  }
}

export async function startBreak(): Promise<ActionResult<{ recordId: string; breakStart: Date }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    await requireAttendanceEligible(tenant.id, actor);

    const set = await tenantSetting(tenant.id);
    if (!set.personal_device_enabled)
      return fail("Absen dari HP pribadi dinonaktifkan. Catat istirahat lewat perangkat kiosk.");

    const now = new Date();
    const attendanceDay = tenantDayDate(now, set.timezone);
    const rec = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance:${tenant.id}:${actor.id}:${attendanceDay.toISOString()}`}))`;
      const existing = await tx.attendanceRecord.findFirst({ where: { tenant_id: tenant.id, user_id: actor.id, attendance_day: attendanceDay }, orderBy: { created_at: "desc" } });
      if (!existing?.check_in) throw new Error("Absen masuk terlebih dahulu sebelum memulai istirahat.");
      if (existing.check_out) throw new Error("Istirahat tidak dapat dimulai setelah absen pulang.");
      if (existing.break_start && !existing.break_end) throw new Error("Anda sedang istirahat.");
      if (existing.break_start && existing.break_end) throw new Error("Jatah istirahat hari ini sudah dipakai.");
      return tx.attendanceRecord.update({ where: { id: existing.id }, data: { break_start: now, break_status: "NORMAL", warning_sent_at: null } });
    });

    await logAction(actor.id, "BREAK_STARTED", "AttendanceRecord", rec.id, null, { at: now.toISOString() });
    revalidatePath("/operator");
    revalidatePath("/finishing");
    revalidatePath("/designer");
    revalidatePath("/admin");
    revalidatePath("/owner");
    return ok({ recordId: rec.id, breakStart: now });
  } catch (e) {
    console.error("startBreak:", e);
    return fail(safeError(e, "Gagal memulai istirahat."));
  }
}

export async function endBreak(): Promise<ActionResult<{ durationMin: number; status: string }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    await requireAttendanceEligible(tenant.id, actor);
    const set = await tenantSetting(tenant.id);
    const now = new Date();
    const attendanceDay = tenantDayDate(now, set.timezone);
    const { rec, durationMin, status } = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance:${tenant.id}:${actor.id}:${attendanceDay.toISOString()}`}))`;
      const rec = await tx.attendanceRecord.findFirst({ where: { tenant_id: tenant.id, user_id: actor.id, attendance_day: attendanceDay }, orderBy: { created_at: "desc" } });
      if (!rec || !rec.break_start) throw new Error("Anda belum memulai istirahat.");
      if (!rec.check_in) throw new Error("Absen masuk terlebih dahulu sebelum menyelesaikan istirahat.");
      if (rec.break_end) throw new Error("Istirahat sudah diselesaikan.");
      const durationMin = Math.max(0, Math.round((now.getTime() - rec.break_start.getTime()) / 60000));
      const status = durationMin > set.break_max_min ? "EXCEEDED" : "NORMAL";
      await tx.attendanceRecord.update({ where: { id: rec.id }, data: { break_end: now, break_duration_min: durationMin, break_status: status } });
      return { rec, durationMin, status };
    });
    await logAction(actor.id, "BREAK_ENDED", "AttendanceRecord", rec.id, null, { durationMin, status });
    revalidatePath("/operator");
    revalidatePath("/finishing");
    revalidatePath("/designer");
    revalidatePath("/admin");
    revalidatePath("/owner");
    return ok({ durationMin, status });
  } catch (e) {
    console.error("endBreak:", e);
    return fail(safeError(e, "Gagal menyelesaikan istirahat."));
  }
}

// ── ABSEN MASUK / PULANG (IN-APP) ─────────────────────────────────────────────

export interface ClockPunchInput {
  lat?: number | null;
  lng?: number | null;
  accuracyM?: number | null;
  /** dataURL image/webp|jpeg|png hasil selfie kamera; wajib jika selfie_required */
  selfie?: string | null;
}

export interface AttendanceToday {
  checkedIn: boolean;
  checkedOut: boolean;
  checkIn: Date | null;
  checkOut: Date | null;
  checkInStatus: string | null;
  lateMinutes: number;
  checkOutStatus: string | null;
  source: string | null;
  onBreak: boolean;
  breakDoneToday: boolean;
  break: BreakStatus;
  settings: {
    selfieRequired: boolean;
    geofenceMode: "OFF" | "FLAG" | "ENFORCE";
    personalDeviceEnabled: boolean;
    workStart: string;
    workEnd: string;
    breakMaxMin: number;
  };
}

async function tenantSetting(tenantId: string) {
  return prisma.tenantAttendanceSetting.upsert({
    where: { tenant_id: tenantId },
    update: {},
    create: { tenant_id: tenantId },
  });
}

export async function getMyAttendanceToday(): Promise<ActionResult<AttendanceToday>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    await requireAttendanceEligible(tenant.id, actor);
    const set = await tenantSetting(tenant.id);
    const [rec, breakRes] = await Promise.all([
      todayRecord(actor.id, tenant.id, set.timezone),
      getMyBreakStatus(),
    ]);
    const brk: BreakStatus = breakRes.success
      ? breakRes.data
      : {
          recordId: null, onBreak: false, breakStart: null, breakEnd: null,
          breakDurationMin: 0, breakStatus: null, elapsedMin: 0, remainingMin: set.break_max_min, doneToday: false,
        };
    return ok({
      checkedIn: !!rec?.check_in,
      checkedOut: !!rec?.check_out,
      checkIn: rec?.check_in ?? null,
      checkOut: rec?.check_out ?? null,
      checkInStatus: rec?.check_in_status ?? null,
      lateMinutes: rec?.late_minutes ?? 0,
      checkOutStatus: rec?.check_out_status ?? null,
      source: rec?.source ?? null,
      onBreak: brk.onBreak,
      breakDoneToday: brk.doneToday,
      break: brk,
      settings: {
        selfieRequired: set.selfie_required,
        geofenceMode: set.geofence_mode as "OFF" | "FLAG" | "ENFORCE",
        personalDeviceEnabled: set.personal_device_enabled,
        workStart: set.work_start,
        workEnd: set.work_end,
        breakMaxMin: set.break_max_min,
      },
    });
  } catch (e) {
    console.error("getMyAttendanceToday:", e);
    return fail(safeError(e, "Gagal memuat status absensi."));
  }
}

export async function clockIn(input: ClockPunchInput = {}): Promise<ActionResult<ClockInResult>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    await requireAttendanceEligible(tenant.id, actor);
    const set = await tenantSetting(tenant.id);
    if (!set.personal_device_enabled)
      return fail("Absen dari HP pribadi dinonaktifkan. Gunakan perangkat kiosk di kantor.");

    const h = await headers();
    const res = await performClockIn({
      tenantId: tenant.id,
      user: { id: actor.id, name: actor.name },
      setting: set,
      method: "IN_APP",
      ip: clientIpFromHeaders(h),
      deviceLabel: shortDeviceLabel(h.get("user-agent")),
      input,
    });
    revalidatePath("/operator");
    revalidatePath("/finishing");
    revalidatePath("/designer");
    revalidatePath("/admin");
    revalidatePath("/owner");
    return ok(res);
  } catch (e) {
    if (e instanceof PunchError) return fail(e.message);
    console.error("clockIn:", e);
    return fail(safeError(e, "Gagal absen masuk."));
  }
}

export async function clockOut(input: ClockPunchInput = {}): Promise<ActionResult<ClockOutResult>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    await requireAttendanceEligible(tenant.id, actor);
    const set = await tenantSetting(tenant.id);
    if (!set.personal_device_enabled)
      return fail("Absen dari HP pribadi dinonaktifkan. Gunakan perangkat kiosk di kantor.");

    const h = await headers();
    const res = await performClockOut({
      tenantId: tenant.id,
      user: { id: actor.id, name: actor.name },
      setting: set,
      method: "IN_APP",
      ip: clientIpFromHeaders(h),
      deviceLabel: shortDeviceLabel(h.get("user-agent")),
      input,
    });
    revalidatePath("/operator");
    revalidatePath("/finishing");
    revalidatePath("/designer");
    revalidatePath("/admin");
    revalidatePath("/owner");
    return ok(res);
  } catch (e) {
    if (e instanceof PunchError) return fail(e.message);
    console.error("clockOut:", e);
    return fail(safeError(e, "Gagal absen pulang."));
  }
}
