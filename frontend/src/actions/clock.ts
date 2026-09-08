"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { sendWhatsApp } from "@/lib/wa";
import {
  hhmmToMinutes,
  minutesOfDay,
  lateInfo,
  checkOutInfo,
  isWorkday,
  evaluateGeofence,
  ipAllowed,
  clientIpFromHeaders,
  shortDeviceLabel,
  decodeSelfieDataUrl,
} from "@/lib/attendance";
import { ok, fail, type ActionResult } from "@/types";

/**
 * Absen masuk/pulang + istirahat langsung di Print Pilot
 * (02-WORKFLOW/18-ABSENSI-IN-APP.md).
 *
 * Import CSV fingerprint tetap ada sebagai cadangan. Semua waktu dari server;
 * klien tidak pernah mengirim timestamp. Data absensi tidak bisa diedit/dihapus
 * siapa pun — Owner hanya menambah catatan.
 */

const BREAK_MAX_MIN = 60;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}

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

async function todayRecord(userId: string) {
  return prisma.attendanceRecord.findFirst({
    where: { user_id: userId, date: { gte: startOfToday(), lt: endOfToday() } },
    orderBy: { created_at: "desc" },
  });
}

export async function getMyBreakStatus(): Promise<ActionResult<BreakStatus>> {
  try {
    const actor = await requireUser();
    const rec = await todayRecord(actor.id);
    if (!rec) {
      return ok({
        recordId: null, onBreak: false, breakStart: null, breakEnd: null,
        breakDurationMin: 0, breakStatus: null, elapsedMin: 0, remainingMin: BREAK_MAX_MIN, doneToday: false,
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
      remainingMin: Math.max(0, BREAK_MAX_MIN - elapsedMin),
      doneToday: !!rec.break_start && !!rec.break_end,
    });
  } catch (e) {
    console.error("getMyBreakStatus:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat status istirahat.");
  }
}

export async function startBreak(): Promise<ActionResult<{ recordId: string; breakStart: Date }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();

    const existing = await todayRecord(actor.id);
    if (existing?.break_start && !existing.break_end) return fail("Anda sedang istirahat.");
    if (existing?.break_start && existing.break_end) return fail("Jatah istirahat hari ini sudah dipakai.");

    const now = new Date();
    const rec = existing
      ? await prisma.attendanceRecord.update({
          where: { id: existing.id },
          data: { break_start: now, break_status: "NORMAL", warning_sent_at: null },
        })
      : await prisma.attendanceRecord.create({
          data: {
            tenant_id: tenant.id,
            user_id: actor.id,
            employee_name: actor.name,
            date: startOfToday(),
            check_in_status: "UNKNOWN",
            break_start: now,
            break_status: "NORMAL",
          },
        });

    await logAction(actor.id, "BREAK_STARTED", "AttendanceRecord", rec.id, null, { at: now.toISOString() });
    revalidatePath("/operator");
    revalidatePath("/finishing");
    revalidatePath("/designer");
    return ok({ recordId: rec.id, breakStart: now });
  } catch (e) {
    console.error("startBreak:", e);
    return fail(e instanceof Error ? e.message : "Gagal memulai istirahat.");
  }
}

export async function endBreak(): Promise<ActionResult<{ durationMin: number; status: string }>> {
  try {
    const actor = await requireUser();
    const rec = await todayRecord(actor.id);
    if (!rec || !rec.break_start) return fail("Anda belum memulai istirahat.");
    if (rec.break_end) return fail("Istirahat sudah diselesaikan.");

    const now = new Date();
    const durationMin = Math.max(0, Math.round((now.getTime() - rec.break_start.getTime()) / 60000));
    const status = durationMin > BREAK_MAX_MIN ? "EXCEEDED" : "NORMAL";

    await prisma.attendanceRecord.update({
      where: { id: rec.id },
      data: { break_end: now, break_duration_min: durationMin, break_status: status },
    });
    await logAction(actor.id, "BREAK_ENDED", "AttendanceRecord", rec.id, null, { durationMin, status });
    revalidatePath("/operator");
    revalidatePath("/finishing");
    revalidatePath("/designer");
    return ok({ durationMin, status });
  } catch (e) {
    console.error("endBreak:", e);
    return fail(e instanceof Error ? e.message : "Gagal menyelesaikan istirahat.");
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
    const [rec, set, breakRes] = await Promise.all([
      todayRecord(actor.id),
      tenantSetting(tenant.id),
      getMyBreakStatus(),
    ]);
    const brk: BreakStatus = breakRes.success
      ? breakRes.data
      : {
          recordId: null, onBreak: false, breakStart: null, breakEnd: null,
          breakDurationMin: 0, breakStatus: null, elapsedMin: 0, remainingMin: BREAK_MAX_MIN, doneToday: false,
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
      },
    });
  } catch (e) {
    console.error("getMyAttendanceToday:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat status absensi.");
  }
}

export async function clockIn(
  input: ClockPunchInput = {}
): Promise<ActionResult<{ recordId: string; checkIn: Date; status: string; lateMinutes: number; geoFlag: boolean; ipFlag: boolean }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    const set = await tenantSetting(tenant.id);

    if (!set.personal_device_enabled)
      return fail("Absen dari HP pribadi dinonaktifkan. Gunakan perangkat kiosk di kantor.");

    const existing = await todayRecord(actor.id);
    if (existing?.check_in) return fail("Anda sudah absen masuk hari ini.");

    const now = new Date();

    // Terlalu awal
    const startMin = hhmmToMinutes(set.work_start);
    if (startMin != null && minutesOfDay(now) < startMin - set.earliest_clock_in_min) {
      return fail(`Belum bisa absen masuk. Paling awal ${set.earliest_clock_in_min} menit sebelum jam ${set.work_start}.`);
    }

    const h = await headers();
    const ip = clientIpFromHeaders(h);
    const deviceLabel = shortDeviceLabel(h.get("user-agent"));

    // IP kantor
    let ipFlag = false;
    if (set.ip_mode !== "OFF") {
      const okIp = ipAllowed(ip, set.ip_allowlist);
      if (!okIp && set.ip_mode === "ENFORCE")
        return fail("Absen hanya bisa dari jaringan kantor.");
      ipFlag = !okIp;
    }

    // Geofence
    const geo = evaluateGeofence(set, input.lat, input.lng, input.accuracyM);
    if (geo.outside && set.geofence_mode === "ENFORCE") {
      return fail(
        geo.distanceM != null
          ? `Anda di luar area kantor (~${geo.distanceM} m). Absen ditolak.`
          : "Lokasi tidak terbaca. Aktifkan izin lokasi untuk absen."
      );
    }
    const geoFlag = geo.outside;

    // Selfie
    const selfie = input.selfie ? decodeSelfieDataUrl(input.selfie) : null;
    if (set.selfie_required && !selfie)
      return fail("Selfie wajib untuk absen. Izinkan kamera lalu coba lagi.");
    if (input.selfie && !selfie)
      return fail("Foto selfie tidak valid. Ulangi pengambilan foto.");

    const { status, lateMinutes } = lateInfo(now, set.late_after);
    const offDay = !isWorkday(now, set.workdays);

    const rec = await prisma.$transaction(async (tx) => {
      const base = {
        check_in: now,
        check_in_status: status,
        late_minutes: lateMinutes,
        source: "IN_APP",
        check_in_method: "IN_APP",
        check_in_lat: input.lat ?? null,
        check_in_lng: input.lng ?? null,
        check_in_accuracy_m: input.accuracyM ?? null,
        check_in_ip: ip,
        geo_flag: geoFlag,
        ip_flag: ipFlag,
        off_day: offDay,
        device_label: deviceLabel,
      };
      const row = existing
        ? await tx.attendanceRecord.update({ where: { id: existing.id }, data: base })
        : await tx.attendanceRecord.create({
            data: {
              tenant_id: tenant.id,
              user_id: actor.id,
              employee_name: actor.name,
              date: startOfToday(),
              ...base,
            },
          });
      if (selfie) {
        await tx.attendanceSelfie.create({
          data: { tenant_id: tenant.id, record_id: row.id, kind: "CHECK_IN", mime: selfie.mime, bytes: selfie.buffer },
        });
      }
      return row;
    });

    await logAction(actor.id, "ATTENDANCE_CLOCK_IN", "AttendanceRecord", rec.id, null, {
      status, lateMinutes, geoFlag, ipFlag, offDay, distanceM: geo.distanceM,
    });
    revalidatePath("/operator");
    revalidatePath("/finishing");
    revalidatePath("/designer");

    if (status === "LATE") {
      void notifyOwnersLate(tenant.id, actor.name, now, lateMinutes);
    }

    return ok({ recordId: rec.id, checkIn: now, status, lateMinutes, geoFlag, ipFlag });
  } catch (e) {
    console.error("clockIn:", e);
    return fail(e instanceof Error ? e.message : "Gagal absen masuk.");
  }
}

export async function clockOut(
  input: ClockPunchInput = {}
): Promise<ActionResult<{ recordId: string; checkOut: Date; status: string }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    const set = await tenantSetting(tenant.id);

    const rec = await todayRecord(actor.id);
    if (!rec || !rec.check_in) return fail("Anda belum absen masuk hari ini.");
    if (rec.check_out) return fail("Anda sudah absen pulang hari ini.");
    if (rec.break_start && !rec.break_end)
      return fail("Selesaikan istirahat dulu sebelum absen pulang.");

    const now = new Date();
    const h = await headers();
    const ip = clientIpFromHeaders(h);

    const geo = evaluateGeofence(set, input.lat, input.lng, input.accuracyM);
    if (geo.outside && set.geofence_mode === "ENFORCE") {
      return fail(
        geo.distanceM != null
          ? `Anda di luar area kantor (~${geo.distanceM} m). Absen pulang ditolak.`
          : "Lokasi tidak terbaca. Aktifkan izin lokasi untuk absen."
      );
    }

    const selfie = input.selfie ? decodeSelfieDataUrl(input.selfie) : null;
    if (set.selfie_required && !selfie)
      return fail("Selfie wajib untuk absen pulang. Izinkan kamera lalu coba lagi.");
    if (input.selfie && !selfie)
      return fail("Foto selfie tidak valid. Ulangi pengambilan foto.");

    const status = checkOutInfo(now, set.work_end);

    await prisma.$transaction(async (tx) => {
      await tx.attendanceRecord.update({
        where: { id: rec.id },
        data: {
          check_out: now,
          check_out_status: status,
          check_out_method: "IN_APP",
          check_out_lat: input.lat ?? null,
          check_out_lng: input.lng ?? null,
          check_out_accuracy_m: input.accuracyM ?? null,
          check_out_ip: ip,
          geo_flag: rec.geo_flag || geo.outside,
        },
      });
      if (selfie) {
        await tx.attendanceSelfie.create({
          data: { tenant_id: tenant.id, record_id: rec.id, kind: "CHECK_OUT", mime: selfie.mime, bytes: selfie.buffer },
        });
      }
    });

    await logAction(actor.id, "ATTENDANCE_CLOCK_OUT", "AttendanceRecord", rec.id, null, { status });
    revalidatePath("/operator");
    revalidatePath("/finishing");
    revalidatePath("/designer");
    return ok({ recordId: rec.id, checkOut: now, status });
  } catch (e) {
    console.error("clockOut:", e);
    return fail(e instanceof Error ? e.message : "Gagal absen pulang.");
  }
}

async function notifyOwnersLate(tenantId: string, name: string, at: Date, lateMin: number) {
  try {
    const owners = await prisma.user.findMany({
      where: { tenant_id: tenantId, active: true, role: { name: "owner" }, phone: { not: null } },
      select: { phone: true },
    });
    if (owners.length === 0) return;
    const jam = at.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
    const body = `${name} terlambat masuk. Jam masuk: ${jam} (telat ${lateMin} menit).`;
    for (const o of owners) {
      if (o.phone) await sendWhatsApp({ to: o.phone, body });
    }
  } catch (e) {
    console.error("notifyOwnersLate:", e);
  }
}
