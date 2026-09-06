"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser, requireMutableActor } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { ok, fail } from "@/types";
import { revalidatePath } from "next/cache";

const isAdmin = (r: string) => r === "admin" || r === "owner";
const num = (v: unknown) => Number(v ?? 0);

/** Hari kerja dalam sebulan = semua tanggal kalender kecuali Minggu (toko libur Minggu). */
function workingDaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month - 1, d).getDay() !== 0) count++;
  }
  return count;
}

function monthRangeUTC(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1); // eksklusif
  return { start, end };
}

/**
 * Generate/regenerate periode payroll untuk bulan tertentu — Owner saja.
 * Idempotent selama periode masih DRAFT (regenerasi menimpa PayrollRecord lama).
 * Periode yang sudah FINALIZED tidak bisa digenerate ulang.
 */
export async function generatePayrollPeriod(year: number, month: number) {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (actor.role !== "owner") return fail("Hanya Owner yang boleh membuat periode payroll.");
    if (month < 1 || month > 12) return fail("Bulan tidak valid.");

    const existing = await prisma.payrollPeriod.findUnique({
      where: { tenant_id_year_month: { tenant_id: tenant.id, year, month } },
    });
    if (existing && existing.status === "FINALIZED") {
      return fail("Periode ini sudah difinalisasi — tidak bisa digenerate ulang.");
    }

    const employees = await prisma.user.findMany({
      where: { tenant_id: tenant.id, active: true, base_salary: { not: null } },
      select: { id: true, base_salary: true },
    });
    if (employees.length === 0) {
      return fail("Belum ada pegawai dengan gaji pokok diset. Isi gaji pokok di halaman Pegawai dulu.");
    }

    const { start, end } = monthRangeUTC(year, month);
    const workingDays = workingDaysInMonth(year, month);
    const lateRate = num(tenant.payroll_late_deduction_per_minute);

    const period = await prisma.payrollPeriod.upsert({
      where: { tenant_id_year_month: { tenant_id: tenant.id, year, month } },
      create: { tenant_id: tenant.id, year, month, status: "DRAFT", generated_by: actor.id },
      update: { generated_by: actor.id, generated_at: new Date() },
    });

    for (const emp of employees) {
      const records = await prisma.attendanceRecord.findMany({
        where: { tenant_id: tenant.id, user_id: emp.id, date: { gte: start, lt: end } },
        select: { date: true, check_in: true, late_minutes: true },
      });

      const presentDates = new Set(
        records.filter((r) => r.check_in).map((r) => r.date.toISOString().slice(0, 10))
      );
      const presentDays = presentDates.size;
      const absentDays = Math.max(0, workingDays - presentDays);
      const lateMinutes = records.reduce((sum, r) => sum + (r.late_minutes ?? 0), 0);

      const base = num(emp.base_salary);
      const perDay = workingDays > 0 ? base / workingDays : 0;
      const deductionAbsent = Math.round(perDay * absentDays);
      const deductionLate = Math.round(lateMinutes * lateRate);
      const totalDeduction = Math.min(base, deductionAbsent + deductionLate);
      const netSalary = Math.max(0, base - totalDeduction);

      await prisma.payrollRecord.upsert({
        where: { period_id_user_id: { period_id: period.id, user_id: emp.id } },
        create: {
          tenant_id: tenant.id,
          period_id: period.id,
          user_id: emp.id,
          base_salary: base,
          working_days: workingDays,
          present_days: presentDays,
          absent_days: absentDays,
          late_minutes: lateMinutes,
          deduction_absent: deductionAbsent,
          deduction_late: deductionLate,
          total_deduction: totalDeduction,
          net_salary: netSalary,
        },
        update: {
          base_salary: base,
          working_days: workingDays,
          present_days: presentDays,
          absent_days: absentDays,
          late_minutes: lateMinutes,
          deduction_absent: deductionAbsent,
          deduction_late: deductionLate,
          total_deduction: totalDeduction,
          net_salary: netSalary,
          status: "UNPAID",
          paid_at: null,
        },
      });
    }

    await logAction(actor.id, existing ? "PAYROLL_PERIOD_REGENERATED" : "PAYROLL_PERIOD_GENERATED", "PayrollPeriod", period.id, null, {
      year,
      month,
      employee_count: employees.length,
    });

    revalidatePath("/owner/payroll");
    revalidatePath("/admin/payroll");
    return ok({ periodId: period.id });
  } catch (e) {
    console.error("generatePayrollPeriod:", e);
    return fail(e instanceof Error ? e.message : "Gagal membuat periode payroll.");
  }
}

/** Kunci periode payroll — tidak bisa digenerate ulang setelah ini. Owner saja. */
export async function finalizePayrollPeriod(periodId: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (actor.role !== "owner") return fail("Hanya Owner yang boleh finalisasi payroll.");

    const period = await prisma.payrollPeriod.findFirst({ where: { id: periodId, tenant_id: tenant.id } });
    if (!period) return fail("Periode tidak ditemukan.");
    if (period.status === "FINALIZED") return fail("Periode sudah difinalisasi.");

    await prisma.payrollPeriod.update({
      where: { id: periodId },
      data: { status: "FINALIZED", finalized_by: actor.id, finalized_at: new Date() },
    });

    await logAction(actor.id, "PAYROLL_PERIOD_FINALIZED", "PayrollPeriod", periodId);

    revalidatePath("/owner/payroll");
    revalidatePath("/admin/payroll");
    return ok(null);
  } catch (e) {
    console.error("finalizePayrollPeriod:", e);
    return fail(e instanceof Error ? e.message : "Gagal finalisasi payroll.");
  }
}

/** Tandai gaji satu pegawai sudah dibayar. Owner saja. */
export async function markPayrollRecordPaid(recordId: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (actor.role !== "owner") return fail("Hanya Owner yang boleh menandai gaji sudah dibayar.");

    const record = await prisma.payrollRecord.findFirst({ where: { id: recordId, tenant_id: tenant.id } });
    if (!record) return fail("Data payroll tidak ditemukan.");
    if (record.status === "PAID") return fail("Sudah ditandai lunas.");

    await prisma.payrollRecord.update({ where: { id: recordId }, data: { status: "PAID", paid_at: new Date() } });
    await logAction(actor.id, "PAYROLL_RECORD_PAID", "PayrollRecord", recordId);

    revalidatePath("/owner/payroll");
    revalidatePath("/admin/payroll");
    return ok(null);
  } catch (e) {
    console.error("markPayrollRecordPaid:", e);
    return fail(e instanceof Error ? e.message : "Gagal menandai gaji.");
  }
}

/** Set/ubah gaji pokok bulanan seorang pegawai. Owner saja. */
export async function setEmployeeBaseSalary(userId: string, amount: number) {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (actor.role !== "owner") return fail("Hanya Owner yang boleh mengubah gaji pokok pegawai.");
    if (!Number.isFinite(amount) || amount < 0) return fail("Nominal gaji tidak valid.");

    const user = await prisma.user.findFirst({ where: { id: userId, tenant_id: tenant.id } });
    if (!user) return fail("Pegawai tidak ditemukan.");

    await prisma.user.update({ where: { id: userId }, data: { base_salary: amount } });
    // Nominal gaji SENGAJA tidak dicatat di sini — /api/audit-logs bisa dibaca role
    // admin juga, dan itu akan membocorkan nominal yang justru disembunyikan dari
    // Admin di getPayrollPeriods/getPayrollPeriodDetail.
    await logAction(actor.id, "EMPLOYEE_BASE_SALARY_SET", "User", userId, { changed: true }, { changed: true });

    revalidatePath("/owner/users");
    revalidatePath("/owner/payroll");
    return ok(null);
  } catch (e) {
    console.error("setEmployeeBaseSalary:", e);
    return fail(e instanceof Error ? e.message : "Gagal mengubah gaji pokok.");
  }
}

/** Set tarif potongan keterlambatan (Rp/menit) tenant. Owner saja. */
export async function updatePayrollLateDeductionRate(rupiahPerMinute: number) {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (actor.role !== "owner") return fail("Hanya Owner yang boleh mengubah pengaturan payroll.");
    if (!Number.isFinite(rupiahPerMinute) || rupiahPerMinute < 0) return fail("Nominal tidak valid.");

    await prisma.tenant.update({ where: { id: tenant.id }, data: { payroll_late_deduction_per_minute: rupiahPerMinute } });
    // Nominal tarif SENGAJA tidak dicatat di sini — /api/audit-logs juga bisa
    // dibaca role admin, yang akan membocorkan nominal payroll ke Admin.
    await logAction(actor.id, "PAYROLL_LATE_RATE_UPDATED", "Tenant", tenant.id, { changed: true }, { changed: true });

    revalidatePath("/owner/payroll");
    return ok(null);
  } catch (e) {
    console.error("updatePayrollLateDeductionRate:", e);
    return fail(e instanceof Error ? e.message : "Gagal mengubah pengaturan.");
  }
}

/**
 * Daftar periode payroll. Owner: dengan total nominal. Admin: hanya status
 * & jumlah pegawai, tanpa nominal (sesuai 07-REPORTS/EMPLOYEE-REPORT.md).
 */
export async function getPayrollPeriods() {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.role)) return fail("Hanya Owner/Admin yang boleh melihat payroll.");

    const periods = await prisma.payrollPeriod.findMany({
      where: { tenant_id: tenant.id },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { records: { select: { net_salary: true, status: true } } },
    });

    // readOnly = Super Admin sub-level SUPPORT sedang impersonate — meski actor.role
    // di sini "owner" (role tenant target), SUPPORT tidak boleh lihat nominal gaji.
    const canSeeAmount = actor.role === "owner" && !actor.readOnly;
    return ok(
      periods.map((p) => ({
        id: p.id,
        year: p.year,
        month: p.month,
        status: p.status,
        employeeCount: p.records.length,
        paidCount: p.records.filter((r) => r.status === "PAID").length,
        totalNet: canSeeAmount ? p.records.reduce((s, r) => s + num(r.net_salary), 0) : null,
      }))
    );
  } catch (e) {
    console.error("getPayrollPeriods:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat daftar payroll.");
  }
}

/** Detail satu periode payroll. Owner: breakdown lengkap. Admin: tanpa nominal. */
export async function getPayrollPeriodDetail(periodId: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.role)) return fail("Hanya Owner/Admin yang boleh melihat payroll.");

    const period = await prisma.payrollPeriod.findFirst({
      where: { id: periodId, tenant_id: tenant.id },
      include: {
        records: {
          include: { user: { select: { id: true, name: true, username: true, role: { select: { name: true } } } } },
          orderBy: { user: { name: "asc" } },
        },
      },
    });
    if (!period) return fail("Periode tidak ditemukan.");

    // readOnly = Super Admin sub-level SUPPORT sedang impersonate — tidak boleh
    // lihat nominal gaji meski actor.role di sini "owner" (role tenant target).
    const canSeeAmount = actor.role === "owner" && !actor.readOnly;
    return ok({
      id: period.id,
      year: period.year,
      month: period.month,
      status: period.status,
      records: period.records.map((r) => ({
        id: r.id,
        userId: r.user.id,
        name: r.user.name,
        username: r.user.username,
        role: r.user.role.name,
        workingDays: r.working_days,
        presentDays: r.present_days,
        absentDays: r.absent_days,
        lateMinutes: r.late_minutes,
        status: r.status,
        paidAt: r.paid_at,
        ...(canSeeAmount
          ? {
              baseSalary: num(r.base_salary),
              deductionAbsent: num(r.deduction_absent),
              deductionLate: num(r.deduction_late),
              totalDeduction: num(r.total_deduction),
              netSalary: num(r.net_salary),
            }
          : {}),
      })),
    });
  } catch (e) {
    console.error("getPayrollPeriodDetail:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat detail payroll.");
  }
}

/** Slip gaji satu pegawai (untuk halaman cetak) — Owner saja, berisi nominal. */
export async function getPayslip(recordId: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    // Slip gaji tidak punya varian tanpa nominal — SUPPORT (readOnly) yang
    // impersonate ditolak sepenuhnya di sini, bukan cuma disembunyikan angkanya.
    if (actor.role !== "owner" || actor.readOnly) return fail("Hanya Owner yang boleh melihat slip gaji.");

    const record = await prisma.payrollRecord.findFirst({
      where: { id: recordId, tenant_id: tenant.id },
      include: {
        user: { select: { name: true, username: true, role: { select: { name: true } } } },
        period: { select: { year: true, month: true } },
      },
    });
    if (!record) return fail("Slip gaji tidak ditemukan.");

    return ok({
      employeeName: record.user.name,
      username: record.user.username,
      role: record.user.role.name,
      year: record.period.year,
      month: record.period.month,
      baseSalary: num(record.base_salary),
      workingDays: record.working_days,
      presentDays: record.present_days,
      absentDays: record.absent_days,
      lateMinutes: record.late_minutes,
      deductionAbsent: num(record.deduction_absent),
      deductionLate: num(record.deduction_late),
      totalDeduction: num(record.total_deduction),
      netSalary: num(record.net_salary),
      status: record.status,
      paidAt: record.paid_at,
      generatedAt: record.created_at,
    });
  } catch (e) {
    console.error("getPayslip:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat slip gaji.");
  }
}
