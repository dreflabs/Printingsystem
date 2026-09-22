/**
 * Inti absen masuk/pulang, dipakai bersama oleh:
 *  - server action sesi pegawai (`src/actions/clock.ts`)
 *  - route kiosk (`src/app/api/kiosk/punch`)
 *
 * Tidak menyentuh sesi / header — pemanggil menyediakan semua konteks.
 * Melempar `PunchError` dengan pesan siap-tampil kalau gagal validasi.
 */

import type { TenantAttendanceSetting } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/logger";
import {
  hhmmToMinutes,
  lateInfoForTenant,
  checkOutInfoForTenant,
  isWorkdayForTenant,
  tenantMinutesOfDay,
  tenantDayDate,
  evaluateGeofence,
  ipAllowed,
  decodeSelfieDataUrl,
} from "@/lib/attendance";

export class PunchError extends Error {}

export type PunchMethod = "IN_APP" | "KIOSK";

export interface PunchInput {
  lat?: number | null;
  lng?: number | null;
  accuracyM?: number | null;
  selfie?: string | null; // dataURL image/webp|jpeg|png
}

export interface PunchContext {
  tenantId: string;
  user: { id: string; name: string };
  setting: TenantAttendanceSetting;
  method: PunchMethod;
  ip: string | null;
  deviceLabel: string | null;
  input: PunchInput;
}

function todayRecord(userId: string, tenantId: string, timeZone: string) {
  return prisma.attendanceRecord.findFirst({
    where: { tenant_id: tenantId, user_id: userId, attendance_day: tenantDayDate(new Date(), timeZone) },
    orderBy: { created_at: "desc" },
  });
}

export interface ClockInResult {
  recordId: string;
  checkIn: Date;
  status: string;
  lateMinutes: number;
  geoFlag: boolean;
  ipFlag: boolean;
}

export async function performClockIn(ctx: PunchContext): Promise<ClockInResult> {
  const { tenantId, user, setting: set, method, ip, deviceLabel, input } = ctx;

  const now = new Date();
  const attendanceDay = tenantDayDate(now, set.timezone);

  const startMin = hhmmToMinutes(set.work_start);
  if (startMin != null && tenantMinutesOfDay(now, set.timezone) < startMin - set.earliest_clock_in_min) {
    throw new PunchError(
      `Belum bisa absen masuk. Paling awal ${set.earliest_clock_in_min} menit sebelum jam ${set.work_start}.`
    );
  }

  let ipFlag = false;
  if (set.ip_mode !== "OFF") {
    const okIp = ipAllowed(ip, set.ip_allowlist);
    if (!okIp && set.ip_mode === "ENFORCE") throw new PunchError("Absen hanya bisa dari jaringan kantor.");
    ipFlag = !okIp;
  }

  const geo = evaluateGeofence(set, input.lat, input.lng, input.accuracyM);
  if (geo.outside && set.geofence_mode === "ENFORCE") {
    throw new PunchError(
      geo.distanceM != null
        ? `Anda di luar area kantor (~${geo.distanceM} m). Absen ditolak.`
        : "Lokasi tidak terbaca. Aktifkan izin lokasi untuk absen."
    );
  }
  const geoFlag = geo.outside;

  const selfie = input.selfie ? decodeSelfieDataUrl(input.selfie) : null;
  if (set.selfie_required && !selfie) throw new PunchError("Selfie wajib untuk absen. Izinkan kamera lalu coba lagi.");
  if (input.selfie && !selfie) throw new PunchError("Foto selfie tidak valid. Ulangi pengambilan foto.");

  const { status, lateMinutes } = lateInfoForTenant(now, set.late_after, set.timezone);
  const offDay = !isWorkdayForTenant(now, set.workdays, set.timezone);

  const rec = await prisma.$transaction(async (tx) => {
    // Serialize punches for the same tenant/user/day. This closes the race in
    // which two tabs both read “belum absen” before either INSERT commits.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance:${tenantId}:${user.id}:${attendanceDay.toISOString()}`}))`;
    const existing = await tx.attendanceRecord.findFirst({
      where: { tenant_id: tenantId, user_id: user.id, attendance_day: attendanceDay },
      orderBy: { created_at: "desc" },
    });
    if (existing?.check_in) throw new PunchError("Anda sudah absen masuk hari ini.");

    const base = {
      check_in: now,
      check_in_status: status,
      late_minutes: lateMinutes,
      source: method,
      check_in_method: method,
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
            tenant_id: tenantId,
            user_id: user.id,
            employee_name: user.name,
            attendance_day: attendanceDay,
            date: now,
            ...base,
          },
        });
    if (selfie) {
      await tx.attendanceSelfie.create({
        data: { tenant_id: tenantId, record_id: row.id, kind: "CHECK_IN", mime: selfie.mime, bytes: selfie.buffer },
      });
    }
    return row;
  });

  await logAction(user.id, "ATTENDANCE_CLOCK_IN", "AttendanceRecord", rec.id, null, {
    method, status, lateMinutes, geoFlag, ipFlag, offDay, distanceM: geo.distanceM,
  });

  if (status === "LATE") void notifyOwnersLate(tenantId, user.name, now, lateMinutes);

  return { recordId: rec.id, checkIn: now, status, lateMinutes, geoFlag, ipFlag };
}

export interface ClockOutResult {
  recordId: string;
  checkOut: Date;
  status: string;
}

export async function performClockOut(ctx: PunchContext): Promise<ClockOutResult> {
  const { tenantId, user, setting: set, method, ip, input } = ctx;

  const rec = await todayRecord(user.id, tenantId, set.timezone);
  if (!rec || !rec.check_in) throw new PunchError("Anda belum absen masuk hari ini.");
  if (rec.check_out) throw new PunchError("Anda sudah absen pulang hari ini.");
  if (rec.break_start && !rec.break_end) throw new PunchError("Selesaikan istirahat dulu sebelum absen pulang.");

  const now = new Date();
  const attendanceDay = tenantDayDate(now, set.timezone);

  if (set.ip_mode !== "OFF") {
    const okIp = ipAllowed(ip, set.ip_allowlist);
    if (!okIp && set.ip_mode === "ENFORCE") throw new PunchError("Absen hanya bisa dari jaringan kantor.");
  }

  const geo = evaluateGeofence(set, input.lat, input.lng, input.accuracyM);
  if (geo.outside && set.geofence_mode === "ENFORCE") {
    throw new PunchError(
      geo.distanceM != null
        ? `Anda di luar area kantor (~${geo.distanceM} m). Absen pulang ditolak.`
        : "Lokasi tidak terbaca. Aktifkan izin lokasi untuk absen."
    );
  }

  const selfie = input.selfie ? decodeSelfieDataUrl(input.selfie) : null;
  if (set.selfie_required && !selfie) throw new PunchError("Selfie wajib untuk absen pulang. Izinkan kamera lalu coba lagi.");
  if (input.selfie && !selfie) throw new PunchError("Foto selfie tidak valid. Ulangi pengambilan foto.");

  const status = checkOutInfoForTenant(now, set.work_end, set.timezone);
  const checkoutIpFlag = set.ip_mode !== "OFF" && !ipAllowed(ip, set.ip_allowlist);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance:${tenantId}:${user.id}:${attendanceDay.toISOString()}`}))`;
    const fresh = await tx.attendanceRecord.findFirst({
      where: { tenant_id: tenantId, user_id: user.id, attendance_day: attendanceDay },
      orderBy: { created_at: "desc" },
    });
    if (!fresh || !fresh.check_in) throw new PunchError("Anda belum absen masuk hari ini.");
    if (fresh.check_out) throw new PunchError("Anda sudah absen pulang hari ini.");
    if (fresh.break_start && !fresh.break_end) throw new PunchError("Selesaikan istirahat dulu sebelum absen pulang.");

    const updated = await tx.attendanceRecord.update({
      where: { id: fresh.id },
      data: {
        check_out: now,
        check_out_status: status,
        check_out_method: method,
        check_out_lat: input.lat ?? null,
        check_out_lng: input.lng ?? null,
        check_out_accuracy_m: input.accuracyM ?? null,
        check_out_ip: ip,
        geo_flag: fresh.geo_flag || geo.outside,
        ip_flag: fresh.ip_flag || checkoutIpFlag,
      },
    });
    if (selfie) {
      await tx.attendanceSelfie.create({
        data: { tenant_id: tenantId, record_id: updated.id, kind: "CHECK_OUT", mime: selfie.mime, bytes: selfie.buffer },
      });
    }
    return updated;
  });

  await logAction(user.id, "ATTENDANCE_CLOCK_OUT", "AttendanceRecord", updated.id, null, { method, status });

  return { recordId: updated.id, checkOut: now, status };
}

/**
 * Antrekan notifikasi keterlambatan untuk Owner.
 *
 * Dulu dikirim langsung ke provider: hasilnya tidak diperiksa, tidak dicatat,
 * dan tidak diulang bila gagal — peringatan bisa hilang tanpa jejak. Sekarang
 * masuk `NotificationEvent` sehingga job dispatcher yang mengirim, mencatat
 * status (PENDING/SENT/FAILED), dan mengulang bila provider sedang gagal.
 */
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
      if (!o.phone) continue;
      await prisma.notificationEvent.create({
        data: {
          tenant_id: tenantId,
          event_type: "ATTENDANCE_LATE",
          channel: "WHATSAPP",
          recipient: o.phone,
          template_code: "ATTENDANCE_LATE",
          body,
          status: "PENDING",
        },
      });
    }
  } catch (e) {
    console.error("notifyOwnersLate:", e);
  }
}
