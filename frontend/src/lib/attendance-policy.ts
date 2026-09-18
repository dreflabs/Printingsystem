import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/actor";
import { can } from "@/lib/permissions";
import { tenantDayDate } from "@/lib/attendance";

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
  const setting = await prisma.tenantAttendanceSetting.findUnique({ where: { tenant_id: tenantId }, select: { timezone: true } });
  const day = tenantDayDate(new Date(), setting?.timezone ?? "Asia/Jakarta");
  const record = await prisma.attendanceRecord.findFirst({
    where: { tenant_id: tenantId, user_id: actor.id, attendance_day: day, check_in: { not: null } },
    select: { id: true, check_in: true, check_out: true },
  });
  if (!record) throw new Error("Absen masuk terlebih dahulu sebelum mengerjakan job.");
  if (record.check_out) throw new Error("Sesi kerja sudah ditutup dengan absen pulang.");
  return record;
}

/**
 * Apply the gate only to operational staff; management can perform takeover.
 * designer_sales is included here — it's wajib-absen by default alongside
 * operator/gudang (see ATTENDANCE_DEFAULT_ROLES), so it must be enforced the
 * same way or a Designer can work all day without ever checking in while an
 * Operator/Gudang doing the exact same policy is hard-blocked.
 */
export async function requireOperationalCheckIn(tenantId: string, actor: Actor) {
  const isOperational = actor.roles.includes("operator") || actor.roles.includes("gudang") || actor.roles.includes("designer_sales");
  const isManagement = actor.roles.includes("owner") || actor.roles.includes("admin");
  if (isOperational && !isManagement) return requireCheckedInForWork(tenantId, actor);
  return null;
}
