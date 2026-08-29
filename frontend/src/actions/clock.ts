"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { ok, fail, type ActionResult } from "@/types";

/**
 * Tombol Mulai / Selesai Istirahat di dashboard pegawai (ABSENSI-FINGERPRINT.md Fase 2).
 *
 * Jam masuk/pulang tetap dari mesin fingerprint (import CSV). Di sini hanya
 * pencatatan istirahat real-time. Waktu mulai/selesai tercatat otomatis dan
 * tidak bisa diubah siapa pun.
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
