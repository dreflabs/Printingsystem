import { prisma } from "@/lib/prisma";
import { getTenantDetail, updateTenantPlan, listSuperAdmins, listTenants, setTenantStatus } from "@/actions/platform";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const t = await prisma.tenant.findFirst();
  const tid = t!.id;
  const origPlan = t!.plan;
  const origStatus = t!.status;
  const origMax = t!.max_users;

  const detail = await getTenantDetail(tid);
  const admins = await listSuperAdmins();

  // ubah paket
  const up = await updateTenantPlan(tid, { plan: "PRO", maxUsers: 12, reason: "uji otomatis" });
  const afterPlan = await prisma.tenant.findUnique({ where: { id: tid }, select: { plan: true, max_users: true } });

  // suspend → requireTenant harus melempar TENANT_SUSPENDED (tanpa cookie impersonate)
  await setTenantStatus(tid, "SUSPEND", "uji");
  let suspendedThrow = "TIDAK melempar (BUG)";
  try {
    await requireTenant();
  } catch (e) {
    suspendedThrow = e instanceof Error && e.message.startsWith("TENANT_SUSPENDED") ? "OK melempar" : `melempar lain: ${e instanceof Error ? e.message : e}`;
  }

  // pulihkan
  await prisma.tenant.update({ where: { id: tid }, data: { plan: origPlan, status: origStatus, max_users: origMax } });
  const auditCount = await prisma.tenantAuditLog.count({ where: { tenant_id: tid, action: { in: ["PLAN_CHANGED", "TENANT_SUSPENDED"] } } });

  return Response.json({
    detailOk: detail.success,
    detailUsers: detail.success ? detail.data.users.length : detail,
    detailAuditLogs: detail.success ? detail.data.auditLogs.length : null,
    superAdmins: admins.success ? admins.data.map((a) => ({ email: a.email, role: a.role })) : admins,
    updatePlan: up,
    planAfter: afterPlan,
    suspendedThrow,
    auditRowsWritten: auditCount,
  });
}
