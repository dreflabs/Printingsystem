import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/actor";
import { can } from "@/lib/permissions";

/**
 * Server-side gate for personal attendance. Eligibility is deliberately
 * separate from role so one account can combine operational roles with an
 * optional Admin/Owner responsibility.
 */
export async function requireAttendanceEligible(tenantId: string, actor: Actor) {
  // A platform impersonation must never create a punch that looks like the
  // tenant Owner's real attendance. Support can still inspect the report.
  if (actor.impersonated) throw new Error("Absensi pribadi tidak dapat dilakukan saat mode impersonate aktif.");
  if (!can(actor, "attendance.self")) throw new Error("Role ini tidak memiliki izin absensi pribadi.");

  const user = await prisma.user.findFirst({
    where: { id: actor.id, tenant_id: tenantId, active: true, attendance_eligible: true },
    select: { id: true },
  });
  if (!user) throw new Error("Akun ini tidak terdaftar sebagai pegawai yang wajib melakukan absensi.");
  return user;
}

/**
 * Operational gate: an eligible employee must have checked in before starting
 * production or warehouse work. Owner/Admin takeover remains an explicit
 * management path and is handled by the caller before invoking this helper.
 */
export async function requireCheckedInForWork(tenantId: string, actor: Actor) {
  await requireAttendanceEligible(tenantId, actor);
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  const record = await prisma.attendanceRecord.findFirst({
    where: { tenant_id: tenantId, user_id: actor.id, attendance_day: { gte: day, lt: next }, check_in: { not: null } },
    select: { id: true, check_in: true, check_out: true },
  });
  if (!record) throw new Error("Absen masuk terlebih dahulu sebelum mengerjakan job.");
  if (record.check_out) throw new Error("Sesi kerja sudah ditutup dengan absen pulang.");
  return record;
}

/** Apply the gate only to operational staff; management can perform takeover. */
export async function requireOperationalCheckIn(tenantId: string, actor: Actor) {
  const isOperational = actor.roles.includes("operator") || actor.roles.includes("gudang");
  const isManagement = actor.roles.includes("owner") || actor.roles.includes("admin");
  if (isOperational && !isManagement) return requireCheckedInForWork(tenantId, actor);
  return null;
}
