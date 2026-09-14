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
