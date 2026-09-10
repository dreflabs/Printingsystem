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
import { sendWhatsApp } from "@/lib/wa";
import {
  hhmmToMinutes,
  minutesOfDay,
  lateInfo,
  checkOutInfo,
  isWorkday,
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
function todayRecord(userId: string) {
  return prisma.attendanceRecord.findFirst({
    where: { user_id: userId, date: { gte: startOfToday(), lt: endOfToday() } },
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

  const existing = await todayRecord(user.id);
  if (existing?.check_in) throw new PunchError("Anda sudah absen masuk hari ini.");

  const now = new Date();

  const startMin = hhmmToMinutes(set.work_start);
  if (startMin != null && minutesOfDay(now) < startMin - set.earliest_clock_in_min) {
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

  const { status, lateMinutes } = lateInfo(now, set.late_after);
  const offDay = !isWorkday(now, set.workdays);

  const rec = await prisma.$transaction(async (tx) => {
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
            date: startOfToday(),
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

  const rec = await todayRecord(user.id);
  if (!rec || !rec.check_in) throw new PunchError("Anda belum absen masuk hari ini.");
  if (rec.check_out) throw new PunchError("Anda sudah absen pulang hari ini.");
  if (rec.break_start && !rec.break_end) throw new PunchError("Selesaikan istirahat dulu sebelum absen pulang.");

  const now = new Date();

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

  const status = checkOutInfo(now, set.work_end);

  await prisma.$transaction(async (tx) => {
    await tx.attendanceRecord.update({
      where: { id: rec.id },
      data: {
        check_out: now,
        check_out_status: status,
        check_out_method: method,
        check_out_lat: input.lat ?? null,
        check_out_lng: input.lng ?? null,
        check_out_accuracy_m: input.accuracyM ?? null,
        check_out_ip: ip,
        geo_flag: rec.geo_flag || geo.outside,
      },
    });
    if (selfie) {
      await tx.attendanceSelfie.create({
        data: { tenant_id: tenantId, record_id: rec.id, kind: "CHECK_OUT", mime: selfie.mime, bytes: selfie.buffer },
      });
    }
  });

  await logAction(user.id, "ATTENDANCE_CLOCK_OUT", "AttendanceRecord", rec.id, null, { method, status });

  return { recordId: rec.id, checkOut: now, status };
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
