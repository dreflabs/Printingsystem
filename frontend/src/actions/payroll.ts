"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser, requireMutableActor, impersonationNote } from "@/lib/actor";
import { requireEntitlement } from "@/lib/entitlements";
import { can } from "@/lib/permissions";
import { logAction } from "@/lib/logger";
import { safeError } from "@/lib/safe-error";
import { isWorkday, tenantDayDate } from "@/lib/attendance";
import { summarizeAttendance } from "@/lib/payroll-attendance";
import { ok, fail } from "@/types";
import { revalidatePath } from "next/cache";

const num = (v: unknown) => Number(v ?? 0);

/** Hitung hari kerja (sesuai TenantAttendanceSetting.workdays) di rentang [start, end). */
function countWorkdays(start: Date, end: Date, workdays: string): number {
  let count = 0;
  for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    if (isWorkday(d, workdays)) count++;
  }
  return count;
}

function monthRange(year: number, month: number) {
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
    await requireEntitlement(tenant.id, "hrm");
    const actor = await requireMutableActor();
    if (!can(actor, "payroll.manage")) return fail("Hanya Owner yang boleh membuat periode payroll.");
    if (month < 1 || month > 12) return fail("Bulan tidak valid.");

    const { start, end } = monthRange(year, month);
    const now = new Date();
    if (end > now) {
      return fail("Bulan ini belum selesai — payroll hanya bisa digenerate untuk bulan yang sudah lewat penuh.");
    }

    const existing = await prisma.payrollPeriod.findUnique({
      where: { tenant_id_year_month: { tenant_id: tenant.id, year, month } },
    });
    if (existing && existing.status === "FINALIZED") {
      return fail("Periode ini sudah difinalisasi — tidak bisa digenerate ulang.");
    }

    const employees = await prisma.user.findMany({
      where: { tenant_id: tenant.id, active: true, base_salary: { not: null } },
      select: { id: true, base_salary: true, attendance_eligible: true, created_at: true },
    });
    if (employees.length === 0) {
      return fail("Belum ada pegawai dengan gaji pokok diset. Isi gaji pokok di halaman Pegawai dulu.");
    }

    const attendanceSetting = await prisma.tenantAttendanceSetting.upsert({
      where: { tenant_id: tenant.id },
      update: {},
      create: { tenant_id: tenant.id },
    });
    const monthWorkingDays = countWorkdays(start, end, attendanceSetting.workdays);
    const lateRate = num(tenant.payroll_late_deduction_per_minute);

    // Baris yang sudah PAID tidak boleh ditimpa ke UNPAID hanya karena periode
    // di-generate ulang (mis. koreksi absen pegawai lain) — riwayat pembayaran
    // yang sudah tercatat harus tetap.
    const paidRecordIds = existing
      ? new Set(
          (
            await prisma.payrollRecord.findMany({
              where: { period_id: existing.id, status: "PAID" },
              select: { user_id: true },
            })
          ).map((r) => r.user_id)
        )
      : new Set<string>();

    const period = await prisma.payrollPeriod.upsert({
      where: { tenant_id_year_month: { tenant_id: tenant.id, year, month } },
      create: { tenant_id: tenant.id, year, month, status: "DRAFT", generated_by: actor.id },
      update: { generated_by: actor.id, generated_at: new Date() },
    });

    for (const emp of employees) {
      if (paidRecordIds.has(emp.id)) continue;

      const base = num(emp.base_salary);

      // Pegawai yang dibebaskan dari wajib-absen (mis. bergaji tetap, tidak
      // pakai jam kerja formal) tidak boleh dianggap "bolos" karena memang
      // tidak diwajibkan absen — gaji penuh, tanpa potongan absen/telat.
      if (!emp.attendance_eligible) {
        await prisma.payrollRecord.upsert({
          where: { period_id_user_id: { period_id: period.id, user_id: emp.id } },
          create: {
            tenant_id: tenant.id, period_id: period.id, user_id: emp.id, base_salary: base,
            working_days: 0, present_days: 0, absent_days: 0, late_minutes: 0,
            deduction_absent: 0, deduction_late: 0, total_deduction: 0, net_salary: base,
          },
          update: {
            base_salary: base, working_days: 0, present_days: 0, absent_days: 0, late_minutes: 0,
            deduction_absent: 0, deduction_late: 0, total_deduction: 0, net_salary: base,
            status: "UNPAID", paid_at: null,
          },
        });
        continue;
      }

      // Prorata pegawai yang baru mulai di tengah bulan — hari sebelum
      // dia bergabung tidak dihitung sebagai hari kerja wajib.
      const effectiveStart = emp.created_at > start ? emp.created_at : start;
      const employeeWorkingDays = effectiveStart < end ? countWorkdays(effectiveStart, end, attendanceSetting.workdays) : 0;

      // Rentang & pengelompokan memakai HARI TENANT (`attendance_day`), bukan
      // kolom `date` + potongan UTC: di zona WITA/WIT absen pagi (07:xx lokal)
      // jatuh ke tanggal UTC sebelumnya sehingga satu hari kehadiran hilang dan
      // gaji terpotong. `tenantDayDate` mengembalikan tengah malam UTC dari
      // tanggal tenant — persis konvensi kolom `attendance_day`.
      const tz = attendanceSetting.timezone;
      const periodEndDay = tenantDayDate(new Date(end.getTime() - 1), tz); // inklusif
      const effectiveStartDay = tenantDayDate(
        new Date(Math.max(effectiveStart.getTime(), start.getTime())),
        tz,
      );
      const records = await prisma.attendanceRecord.findMany({
        where: {
          tenant_id: tenant.id,
          user_id: emp.id,
          attendance_day: { gte: effectiveStartDay, lte: periodEndDay },
        },
        select: { attendance_day: true, check_in: true, late_minutes: true, off_day: true },
      });

      // Absen di hari libur tidak menambah kehadiran dan tidak menambah
      // keterlambatan (dulu bisa menutupi satu hari bolos).
      const { presentDays, lateMinutes } = summarizeAttendance(records);
      const absentDays = Math.max(0, employeeWorkingDays - presentDays);

      const perDay = monthWorkingDays > 0 ? base / monthWorkingDays : 0;
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
          working_days: employeeWorkingDays,
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
          working_days: employeeWorkingDays,
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

    revalidatePath("/admin/payroll");
    return ok({ periodId: period.id });
  } catch (e) {
    console.error("generatePayrollPeriod:", e);
    return fail(safeError(e, "Gagal membuat periode payroll."));
  }
}

/** Kunci periode payroll — tidak bisa digenerate ulang setelah ini. Owner saja. */
export async function finalizePayrollPeriod(periodId: string) {
  try {
    const tenant = await requireTenant();
    await requireEntitlement(tenant.id, "hrm");
    const actor = await requireMutableActor();
    if (!can(actor, "payroll.manage")) return fail("Hanya Owner yang boleh finalisasi payroll.");

    const period = await prisma.payrollPeriod.findFirst({ where: { id: periodId, tenant_id: tenant.id } });
    if (!period) return fail("Periode tidak ditemukan.");
    if (period.status === "FINALIZED") return fail("Periode sudah difinalisasi.");

    await prisma.payrollPeriod.update({
      where: { id: periodId },
      data: { status: "FINALIZED", finalized_by: actor.id, finalized_at: new Date() },
    });

    await logAction(actor.id, "PAYROLL_PERIOD_FINALIZED", "PayrollPeriod", periodId);

    revalidatePath("/admin/payroll");
    return ok(null);
  } catch (e) {
    console.error("finalizePayrollPeriod:", e);
    return fail(safeError(e, "Gagal finalisasi payroll."));
  }
}

/** Tandai gaji satu pegawai sudah dibayar. Owner saja. */
export async function markPayrollRecordPaid(recordId: string) {
  try {
    const tenant = await requireTenant();
    await requireEntitlement(tenant.id, "hrm");
    const actor = await requireMutableActor();
    if (!can(actor, "payroll.manage")) return fail("Hanya Owner yang boleh menandai gaji sudah dibayar.");

    const record = await prisma.payrollRecord.findFirst({
      where: { id: recordId, tenant_id: tenant.id },
      include: { period: { select: { status: true } } },
    });
    if (!record) return fail("Data payroll tidak ditemukan.");
    // Periode masih DRAFT bisa digenerate ulang, dan regenerate akan menimpa
    // baris lain — kunci pembayaran ke periode yang sudah FINALIZED saja agar
    // status LUNAS tidak pernah tertimpa oleh generate ulang.
    if (record.period.status !== "FINALIZED") {
      return fail("Finalisasi periode ini dulu sebelum menandai gaji sudah dibayar.");
    }
    if (record.status === "PAID") return fail("Sudah ditandai lunas.");

    await prisma.payrollRecord.update({ where: { id: recordId }, data: { status: "PAID", paid_at: new Date() } });
    await logAction(actor.id, "PAYROLL_RECORD_PAID", "PayrollRecord", recordId);

    revalidatePath("/admin/payroll");
    return ok(null);
  } catch (e) {
    console.error("markPayrollRecordPaid:", e);
    return fail(safeError(e, "Gagal menandai gaji."));
  }
}

/** Set/ubah gaji pokok bulanan seorang pegawai. Owner saja. */
export async function setEmployeeBaseSalary(userId: string, amount: number) {
  try {
    const tenant = await requireTenant();
    await requireEntitlement(tenant.id, "hrm");
    const actor = await requireMutableActor();
    if (!can(actor, "payroll.manage")) return fail("Hanya Owner yang boleh mengubah gaji pokok pegawai.");
    if (!Number.isFinite(amount) || amount < 0) return fail("Nominal gaji tidak valid.");

    const user = await prisma.user.findFirst({ where: { id: userId, tenant_id: tenant.id } });
    if (!user) return fail("Pegawai tidak ditemukan.");

    await prisma.user.update({ where: { id: userId }, data: { base_salary: amount } });
    // Nominal gaji SENGAJA tidak dicatat di sini — /api/audit-logs bisa dibaca role
    // admin juga, dan itu akan membocorkan nominal yang justru disembunyikan dari
    // Admin di getPayrollPeriods/getPayrollPeriodDetail.
    await logAction(actor.id, "EMPLOYEE_BASE_SALARY_SET", "User", userId, { changed: true }, { changed: true }, impersonationNote(actor));

    revalidatePath("/owner/users");
    revalidatePath("/admin/payroll");
    return ok(null);
  } catch (e) {
    console.error("setEmployeeBaseSalary:", e);
    return fail(safeError(e, "Gagal mengubah gaji pokok."));
  }
}

/** Set tarif potongan keterlambatan (Rp/menit) tenant. Owner saja. */
export async function updatePayrollLateDeductionRate(rupiahPerMinute: number) {
  try {
    const tenant = await requireTenant();
    await requireEntitlement(tenant.id, "hrm");
    const actor = await requireMutableActor();
    if (!can(actor, "payroll.manage")) return fail("Hanya Owner yang boleh mengubah pengaturan payroll.");
    if (!Number.isFinite(rupiahPerMinute) || rupiahPerMinute < 0) return fail("Nominal tidak valid.");

    await prisma.tenant.update({ where: { id: tenant.id }, data: { payroll_late_deduction_per_minute: rupiahPerMinute } });
    // Nominal tarif SENGAJA tidak dicatat di sini — /api/audit-logs juga bisa
    // dibaca role admin, yang akan membocorkan nominal payroll ke Admin.
    await logAction(actor.id, "PAYROLL_LATE_RATE_UPDATED", "Tenant", tenant.id, { changed: true }, { changed: true });

    revalidatePath("/admin/payroll");
    return ok(null);
  } catch (e) {
    console.error("updatePayrollLateDeductionRate:", e);
    return fail(safeError(e, "Gagal mengubah pengaturan."));
  }
}

/**
 * Daftar periode payroll. Owner: dengan total nominal. Admin: hanya status
 * & jumlah pegawai, tanpa nominal (sesuai 07-REPORTS/EMPLOYEE-REPORT.md).
 */
export async function getPayrollPeriods() {
  try {
    const tenant = await requireTenant();
    await requireEntitlement(tenant.id, "hrm");
    const actor = await requireUser();
    if (!can(actor, "payroll.view")) return fail("Hanya Owner/Admin yang boleh melihat payroll.");

    const periods = await prisma.payrollPeriod.findMany({
      where: { tenant_id: tenant.id },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { records: { select: { net_salary: true, status: true } } },
    });

    // readOnly = Super Admin sub-level SUPPORT sedang impersonate — meski actor.role
    // di sini "owner" (role tenant target), SUPPORT tidak boleh lihat nominal gaji.
    const canSeeAmount = can(actor, "payroll.manage") && !actor.readOnly;
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
    return fail(safeError(e, "Gagal memuat daftar payroll."));
  }
}

/** Detail satu periode payroll. Owner: breakdown lengkap. Admin: tanpa nominal. */
export async function getPayrollPeriodDetail(periodId: string) {
  try {
    const tenant = await requireTenant();
    await requireEntitlement(tenant.id, "hrm");
    const actor = await requireUser();
    if (!can(actor, "payroll.view")) return fail("Hanya Owner/Admin yang boleh melihat payroll.");

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
    const canSeeAmount = can(actor, "payroll.manage") && !actor.readOnly;
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
    return fail(safeError(e, "Gagal memuat detail payroll."));
  }
}

/** Slip gaji satu pegawai (untuk halaman cetak) — Owner saja, berisi nominal. */
export async function getPayslip(recordId: string) {
  try {
    const tenant = await requireTenant();
    await requireEntitlement(tenant.id, "hrm");
    const actor = await requireUser();
    // Slip gaji tidak punya varian tanpa nominal — SUPPORT (readOnly) yang
    // impersonate ditolak sepenuhnya di sini, bukan cuma disembunyikan angkanya.
    if (!can(actor, "payroll.manage") || actor.readOnly) return fail("Hanya Owner yang boleh melihat slip gaji.");

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
    return fail(safeError(e, "Gagal memuat slip gaji."));
  }
}
