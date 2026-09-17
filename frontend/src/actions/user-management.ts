"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser, requireMutableActor, impersonationNote } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { generateTempPassword } from "@/lib/temp-password";
import { ok, fail, type ActionResult } from "@/types";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { can } from "@/lib/permissions";
import { getTenantEntitlements } from "@/lib/entitlements";
import { safeError } from "@/lib/safe-error";

const USER_SELECT = {
  id: true,
  name: true,
  username: true,
  email: true,
  active: true,
  must_change_password: true,
  failed_login_count: true,
  locked_until: true,
  last_login_at: true,
  created_at: true,
  attendance_eligible: true,
  base_salary: true,
  role: { select: { name: true } },
  extra_roles: { select: { role: { select: { name: true } } } },
  user_machines: { select: { machine_id: true, machine: { select: { name: true } } } },
} as const;

const ATTENDANCE_DEFAULT_ROLES = new Set(["owner", "designer_sales", "operator", "gudang"]);

export async function updateOperatorMachines(userId: string, machineIds: string[]): Promise<ActionResult<null>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    
    // Hanya Owner yang boleh mengatur ini
    if (!can(actor, "shop.configure")) return fail("Hanya Owner yang boleh mengatur penugasan mesin.");

    // Verifikasi user yang dituju ada di tenant yang sama
    const target = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id },
      include: { role: true, extra_roles: { include: { role: true } } }
    });
    if (!target) return fail("Pegawai tidak ditemukan.");

    // Pastikan user tersebut punya role operator
    const isOp = target.role.name === "operator" || target.extra_roles.some(er => er.role.name === "operator");
    if (!isOp) return fail("Pegawai ini tidak memiliki role Operator Cetak.");

    // Normalisasi input sebelum dipakai pada query/createMany. Selain menjaga
    // unique constraint, ini mencegah ID kosong/duplikat masuk ke relasi akses.
    const requestedMachineIds = [...new Set((machineIds ?? []).map((id) => id.trim()).filter(Boolean))];

    await prisma.$transaction(async (tx) => {
      // UserMachine adalah relasi tenant-scoped. Validasi ini wajib dilakukan
      // di server karena daftar mesin dari browser tidak dapat dipercaya.
      const machines = requestedMachineIds.length === 0
        ? []
        : await tx.machine.findMany({
            where: { tenant_id: tenant.id, id: { in: requestedMachineIds } },
            select: { id: true, name: true },
          });
      if (machines.length !== requestedMachineIds.length) {
        throw new Error("Ada mesin yang tidak valid atau bukan milik toko ini.");
      }

      // Jangan mencabut akses dari operator yang masih memegang job aktif pada
      // mesin tersebut. Owner harus memindahkan job lebih dulu agar tugas tidak
      // hilang dari dashboard atau kehilangan penanggung jawab.
      const currentGrants = await tx.userMachine.findMany({
        where: { tenant_id: tenant.id, user_id: userId },
        select: { machine_id: true },
      });
      const removedMachineIds = currentGrants
        .map((grant) => grant.machine_id)
        .filter((id) => !requestedMachineIds.includes(id));
      if (removedMachineIds.length > 0) {
        const activeJobs = await tx.productionJob.findMany({
          where: {
            tenant_id: tenant.id,
            operator_id: userId,
            machine_id: { in: removedMachineIds },
            status: { in: ["PRODUCTION_ASSIGNED", "PRODUCTION_STARTED", "PRODUCTION_PAUSED"] },
          },
          select: { job_code: true, machine_id: true },
          orderBy: { job_code: "asc" },
        });
        if (activeJobs.length > 0) {
          const codes = activeJobs.slice(0, 3).map((job) => job.job_code).join(", ");
          const suffix = activeJobs.length > 3 ? " dan lainnya" : "";
          throw new Error(`Akses mesin tidak dapat dicabut karena ${activeJobs.length} job masih aktif (${codes}${suffix}). Reassign job terlebih dahulu.`);
        }
      }

      // Hapus yang lama
      await tx.userMachine.deleteMany({
        where: { tenant_id: tenant.id, user_id: userId }
      });
      
      // Insert yang baru
      if (requestedMachineIds.length > 0) {
        await tx.userMachine.createMany({
          data: requestedMachineIds.map(mid => ({
            tenant_id: tenant.id,
            user_id: userId,
            machine_id: mid,
            assigned_by: actor.id,
          }))
        });
      }
      
      await logAction(actor.id, "UPDATE_OPERATOR_MACHINES", "User", userId, "Assigned machines updated", { machineIds: requestedMachineIds });
    });

    revalidatePath("/owner/users");
    return ok(null);
  } catch (error) {
    console.error("updateOperatorMachines error:", error);
    return fail(safeError(error, "Terjadi kesalahan saat menyimpan tugas mesin."));
  }
}

export async function getTenantUsers() {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!can(actor, "user.view")) throw new Error("Hanya Owner yang boleh melihat daftar pegawai.");

    // Start of today in local timezone (assuming server runs on same TZ or we just use simple UTC boundary)
    // To be perfectly safe, we'll fetch records created in the last 24 hours or just fetch the latest 1 record per user.
    // Since AttendanceRecord has `date` (00:00), we can just fetch the latest 1.
    const users = await prisma.user.findMany({
      where: { tenant_id: tenant.id },
      select: {
        ...USER_SELECT,
        attendance_records: {
          take: 1,
          orderBy: { date: "desc" }
        }
      },
      orderBy: { created_at: "desc" },
    });
    
    // Decimal tidak bisa lewat batas Server Action — konversi ke number/null.
    return users.map((u) => {
      const att = u.attendance_records[0];
      let liveStatus = "BELUM_ABSEN";
      if (att) {
        // If the record is today
        const isToday = new Date(att.date).toDateString() === new Date().toDateString();
        if (isToday) {
          if (att.off_day) liveStatus = "LIBUR";
          else if (att.check_in && !att.check_out) liveStatus = "BEKERJA";
          else if (att.check_out) liveStatus = "PULANG";
        }
      }

      return {
        ...u,
        base_salary: u.base_salary == null ? null : Number(u.base_salary),
        liveStatus
      };
    });
  } catch (error) {
    console.error("Error fetching tenant users:", error);
    throw error;
  }
}

export async function createEmployee(data: {
  name: string;
  username: string;
  email: string;
  phone?: string; // nomor HP untuk notifikasi WA absensi (opsional)
  role_name: string;
  extra_role_names?: string[]; // Additional roles beyond primary
}) {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (!can(actor, "user.create")) throw new Error("Hanya Owner yang boleh menambah pegawai.");
    if (data.role_name === "owner" || data.extra_role_names?.includes("owner")) {
      throw new Error("Role Owner tidak bisa dibuat lewat form ini.");
    }

    // Find the primary role ID
    const role = await prisma.role.findUnique({ where: { name: data.role_name } });
    if (!role) throw new Error("Role not found");

    // Kuota paket dihitung dari user aktif, termasuk Owner. Jangan hanya
    // mengandalkan UI: createEmployee adalah gerbang server-side terakhir.
    const entitlements = await getTenantEntitlements(tenant.id);
    if (entitlements.maxUsers != null) {
      const activeUsers = await prisma.user.count({
        where: { tenant_id: tenant.id, active: true },
      });
      if (activeUsers >= entitlements.maxUsers) {
        throw new Error(
          `Kuota user aktif paket Anda sudah penuh (${activeUsers}/${entitlements.maxUsers}). Nonaktifkan pegawai lain, atau Owner bisa upgrade paket sendiri di /owner/billing.`,
        );
      }
    }

    // Username & email hanya unik PER TENANT (@@unique([tenant_id, username]) dan
    // @@unique([tenant_id, email])), jadi pemeriksaannya wajib dibatasi tenant ini.
    // Tanpa `tenant_id`, Owner tidak bisa memakai nama umum seperti "admin" atau
    // "kasir" hanya karena percetakan lain sudah memakainya — dan pesan galatnya
    // membocorkan keberadaan akun di percetakan lain.
    const existing = await prisma.user.findFirst({
      where: {
        tenant_id: tenant.id,
        OR: [{ username: data.username }, { email: data.email }],
      },
    });
    if (existing) throw new Error("Username atau Email sudah digunakan");

    // Password sementara ACAK per pegawai (bukan konstanta bersama). Hanya
    // dikembalikan sekali ke Owner untuk diserahkan ke pegawai; alur ganti-sandi
    // paksa (must_change_password) menahan akun sampai pegawai menggantinya.
    const tempPassword = generateTempPassword();
    const password_hash = await bcrypt.hash(tempPassword, 12);

    const newUser = await prisma.user.create({
      data: {
        tenant_id: tenant.id,
        name: data.name,
        username: data.username,
        email: data.email,
        phone: data.phone?.trim() || null,
        password_hash,
        role_id: role.id,
        attendance_eligible: ATTENDANCE_DEFAULT_ROLES.has(data.role_name) || (data.extra_role_names ?? []).some((r) => ATTENDANCE_DEFAULT_ROLES.has(r)),
        must_change_password: true,
        // Dibuat langsung oleh Owner (bukan self-serve signup) — tidak ada alur
        // verifikasi email untuk pegawai, jadi tandai terverifikasi agar bisa
        // login. Tanpa ini, login.ts:166 mengunci akun pegawai selamanya.
        email_verified_at: new Date(),
      },
    });

    // Create extra role entries (multi-role support)
    if (data.extra_role_names && data.extra_role_names.length > 0) {
      const extraRoles = await prisma.role.findMany({
        where: { name: { in: data.extra_role_names } },
      });
      // Exclude the primary role from extra roles to avoid duplicates
      const uniqueExtraRoles = extraRoles.filter((r) => r.id !== role.id);
      if (uniqueExtraRoles.length > 0) {
        await prisma.userRole.createMany({
          data: uniqueExtraRoles.map((r) => ({
            user_id: newUser.id,
            role_id: r.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Jangan pernah mencatat password sementara ke audit log.
    await logAction(actor.id, "EMPLOYEE_CREATED", "User", newUser.id, null, {
      name: data.name,
      username: data.username,
      role: data.role_name,
      extra_roles: data.extra_role_names ?? [],
    }, impersonationNote(actor));

    revalidatePath("/owner/users");
    return { success: true, user: newUser, tempPassword };
  } catch (error: unknown) {
    console.error("Error creating employee:", error);
    return { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." };
  }
}

/** Owner mengatur apakah akun termasuk daftar pegawai yang wajib absen. */
export async function setAttendanceEligibility(userId: string, eligible: boolean): Promise<ActionResult<null>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (!can(actor, "user.update_role")) return fail("Hanya Owner yang boleh mengatur kewajiban absensi.");
    const target = await prisma.user.findFirst({ where: { id: userId, tenant_id: tenant.id } });
    if (!target) return fail("Pegawai tidak ditemukan.");
    await prisma.user.update({ where: { id: target.id }, data: { attendance_eligible: !!eligible } });
    await logAction(actor.id, "ATTENDANCE_ELIGIBILITY_UPDATED", "User", target.id, { eligible: target.attendance_eligible }, { eligible: !!eligible }, impersonationNote(actor));
    revalidatePath("/owner/users");
    return ok(null);
  } catch (error) {
    console.error("setAttendanceEligibility:", error);
    return fail(error instanceof Error ? error.message : "Gagal mengubah kewajiban absensi.");
  }
}

/**
 * Update the roles for an existing user.
 * The first role in the array becomes the primary role.
 * All remaining roles are stored as extra_roles.
 */
export async function updateUserRoles(userId: string, roleNames: string[]) {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (!can(actor, "user.update_role")) throw new Error("Hanya Owner yang boleh mengubah role pegawai.");
    if (roleNames.length === 0) throw new Error("Minimal 1 role harus dipilih");

    const user = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id },
      include: { role: true, extra_roles: { include: { role: true } } },
    });
    if (!user) throw new Error("User tidak ditemukan");
    if (user.role.name === "owner" && !roleNames.includes("owner")) {
      throw new Error("Role Owner tidak bisa dihapus dari akun Owner");
    }
    if (roleNames.includes("owner") && user.role.name !== "owner") {
      throw new Error("Role Owner tidak bisa ditambahkan lewat form ini.");
    }
    const oldRoleNames = [user.role.name, ...user.extra_roles.map((r) => r.role.name)];

    // Jangan mencabut role operasional saat pekerjaan user masih berjalan.
    // Tanpa guard ini, job bisa kehilangan penanggung jawab sementara role
    // baru sudah tersimpan. Owner harus melakukan reassign atau memakai alur
    // takeover darurat yang terpisah.
    const removingOperator = oldRoleNames.includes("operator") && !roleNames.includes("operator");
    const removingGudang = oldRoleNames.includes("gudang") && !roleNames.includes("gudang");
    const activeProductionStatuses = [
      "PRODUCTION_QUEUED",
      "PRODUCTION_ASSIGNED",
      "PRODUCTION_STARTED",
      "PRODUCTION_PAUSED",
      "PRODUCTION_COMPLETE",
      "QC_PASSED",
      "FINISHING_STARTED",
      "FINISHING_COMPLETE",
      "STORED",
      "IN_TRANSIT",
    ];
    const [activeProduction, activeFinishing, activeStorage] = await Promise.all([
      removingOperator
        ? prisma.productionJob.count({
            where: { tenant_id: tenant.id, operator_id: userId, status: { in: activeProductionStatuses } },
          })
        : Promise.resolve(0),
      removingGudang
        ? prisma.finishingJob.count({
            where: { tenant_id: tenant.id, operator_id: userId, status: "FINISHING_STARTED" },
          })
        : Promise.resolve(0),
      removingGudang
        ? prisma.storageItem.count({
            where: { tenant_id: tenant.id, status: { in: ["STORED", "IN_TRANSIT"] }, OR: [{ stored_by: userId }, { transit_by: userId }] },
          })
        : Promise.resolve(0),
    ]);
    if (activeProduction || activeFinishing || activeStorage) {
      const parts = [
        activeProduction ? `${activeProduction} job produksi` : "",
        activeFinishing ? `${activeFinishing} job finishing` : "",
        activeStorage ? `${activeStorage} item storage` : "",
      ].filter(Boolean).join(", ");
      throw new Error(`Role tidak dapat dicabut karena masih ada pekerjaan aktif (${parts}). Reassign pekerjaan terlebih dahulu.`);
    }

    const allRoles = await prisma.role.findMany({
      where: { name: { in: roleNames } },
    });
    if (allRoles.length === 0) throw new Error("Role tidak ditemukan");

    // Primary role: keep owner as primary if they have it, otherwise first in priority order
    const PRIORITY = ["owner", "admin", "designer_sales", "operator", "gudang"];
    const sortedRoles = [...allRoles].sort(
      (a, b) => PRIORITY.indexOf(a.name) - PRIORITY.indexOf(b.name)
    );
    const primaryRole = sortedRoles[0];
    const extraRoles = sortedRoles.slice(1);

    // Update primary role
    await prisma.user.update({
      where: { id: userId },
      data: { role_id: primaryRole.id },
    });

    // Replace extra roles: delete old, insert new
    await prisma.userRole.deleteMany({ where: { user_id: userId } });
    if (extraRoles.length > 0) {
      await prisma.userRole.createMany({
        data: extraRoles.map((r) => ({ user_id: userId, role_id: r.id })),
        skipDuplicates: true,
      });
    }

    await logAction(actor.id, "USER_ROLES_UPDATED", "User", userId, oldRoleNames, roleNames, impersonationNote(actor));

    revalidatePath("/owner/users");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error updating user roles:", error);
    return { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." };
  }
}

export async function toggleEmployeeStatus(userId: string, active: boolean) {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (!can(actor, "user.deactivate")) throw new Error("Hanya Owner yang boleh mengaktifkan/menonaktifkan pegawai.");

    const user = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id },
      include: { role: true },
    });
    if (!user) throw new Error("User not found");
    if (user.role.name === "owner") throw new Error("Cannot deactivate the owner account");

    if (active) {
      const entitlements = await getTenantEntitlements(tenant.id);
      if (entitlements.maxUsers != null) {
        const activeUsers = await prisma.user.count({ where: { tenant_id: tenant.id, active: true } });
        if (activeUsers >= entitlements.maxUsers) {
          throw new Error(
            `Kuota user aktif paket Anda sudah penuh (${activeUsers}/${entitlements.maxUsers}). Nonaktifkan pegawai lain, atau Owner bisa upgrade paket sendiri di /owner/billing.`,
          );
        }
      }
    }

    let requeuedProduction = 0;
    let needsReassignProduction = 0;
    await prisma.$transaction(async (tx) => {
      if (!active) {
        // Job yang belum dimulai aman dikembalikan ke antrean mesin. Job yang
        // sudah berjalan dipertahankan agar progres/jejak operator tidak hilang
        // dan ditandai untuk keputusan reassign Admin/Owner.
        const queued = await tx.productionJob.updateMany({
          where: {
            tenant_id: tenant.id,
            operator_id: userId,
            status: { in: ["PRODUCTION_ASSIGNED", "PRODUCTION_QUEUED"] },
          },
          data: { operator_id: null, status: "PRODUCTION_QUEUED" },
        });
        requeuedProduction = queued.count;
        needsReassignProduction = await tx.productionJob.count({
          where: { tenant_id: tenant.id, operator_id: userId, status: { in: ["PRODUCTION_STARTED", "PRODUCTION_PAUSED"] } },
        });
      }
      await tx.user.update({
        where: { id: userId },
        data: { active, deactivated_at: active ? null : new Date() },
      });
    });

    await logAction(actor.id, active ? "EMPLOYEE_ACTIVATED" : "EMPLOYEE_DEACTIVATED", "User", userId, { active: user.active }, {
      active,
      requeuedProduction,
      needsReassignProduction,
    }, impersonationNote(actor));

    revalidatePath("/owner/users");
    revalidatePath("/admin");
    revalidatePath("/admin/production");
    revalidatePath("/operator");
    return { success: true, requeuedProduction, needsReassignProduction };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." };
  }
}

/**
 * Clear a lockout on an employee account (failed-login threshold reached).
 * Does NOT change the password — the user keeps their existing credentials.
 */
export async function unlockEmployeeAccount(userId: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (!can(actor, "user.update_role")) throw new Error("Hanya Owner yang boleh membuka kunci akun pegawai.");

    const user = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id },
    });
    if (!user) throw new Error("User tidak ditemukan");

    await prisma.user.update({
      where: { id: userId },
      data: { failed_login_count: 0, locked_until: null },
    });

    await logAction(actor.id, "EMPLOYEE_ACCOUNT_UNLOCKED", "User", userId, undefined, undefined, impersonationNote(actor));

    revalidatePath("/owner/users");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error unlocking account:", error);
    return { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." };
  }
}

export async function resetEmployeePassword(userId: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (!can(actor, "user.reset_password")) throw new Error("Hanya Owner yang boleh me-reset password pegawai.");

    const user = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id },
      include: { role: true },
    });
    if (!user) throw new Error("User not found");
    if (user.role.name === "owner") throw new Error("Owner must use self-service reset");

    // Password sementara acak — bump password_changed_at agar sesi pegawai yang
    // sedang berjalan langsung tidak berlaku (harus login ulang dengan yang baru).
    const newPassword = generateTempPassword();
    const password_hash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password_hash,
        password_changed_at: new Date(),
        must_change_password: true,
        failed_login_count: 0,
        locked_until: null,
      },
    });

    await logAction(actor.id, "EMPLOYEE_PASSWORD_RESET", "User", userId, undefined, undefined, impersonationNote(actor));

    revalidatePath("/owner/users");
    return { success: true, newPassword };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." };
  }
}

// ─── Hapus pegawai ───────────────────────────────────────────────────────────
// User direferensikan puluhan tabel (order, pembayaran, produksi, QC, gudang,
// gaji, absensi, audit log) dengan FK Restrict. Menghapus baris User hanya
// mungkin bila pegawai belum pernah menyentuh apa pun. Kalau sudah, data itu
// milik PERCETAKAN (order pelanggan, catatan uang, slip gaji, jejak audit) —
// tidak boleh ikut terhapus. Untuk kasus itu kita anonimkan + nonaktifkan:
// identitas & akses login pegawai hilang, riwayat tetap utuh atas nama
// "Mantan Pegawai".

const HISTORY_RELATIONS = {
  created_customers: true, added_materials: true, material_movements: true,
  created_orders: true, designed_orders: true, discount_approved: true,
  dp_override_by_orders: true, cancelled_by_orders: true, cancellation_approved: true,
  retail_stock_movements: true, design_jobs: true, uploaded_designs: true,
  approved_designs: true, production_jobs: true, qc_inspections: true,
  rework_decisions: true, finishing_jobs: true, stored_items: true, transit_items: true,
  released_items: true, incident_reports: true, payments_received: true,
  pickup_releases: true, resent_notifications: true, audits_performed: true,
  audits_approved: true, audit_logs: true, created_corrections: true,
  approved_corrections: true, imported_attendance: true, attendance_records: true,
  payroll_records: true,
} as const;

type HistoryCount = Record<keyof typeof HISTORY_RELATIONS, number>;

function bucketCounts(c: HistoryCount) {
  const sum = (...ks: (keyof HistoryCount)[]) => ks.reduce((s, k) => s + (c[k] ?? 0), 0);
  const buckets = {
    order: sum("created_orders", "designed_orders", "discount_approved", "dp_override_by_orders", "cancelled_by_orders", "cancellation_approved"),
    pembayaran: sum("payments_received"),
    produksi: sum("production_jobs", "qc_inspections", "rework_decisions", "finishing_jobs"),
    gudang: sum("stored_items", "transit_items", "released_items", "incident_reports", "pickup_releases"),
    desain: sum("design_jobs", "uploaded_designs", "approved_designs"),
    gaji: sum("payroll_records"),
    absensi: sum("attendance_records", "imported_attendance"),
    "jejak audit": sum("audit_logs", "audits_performed", "audits_approved", "created_corrections", "approved_corrections"),
    "data master": sum("created_customers", "added_materials", "material_movements", "retail_stock_movements", "resent_notifications"),
  };
  const total = Object.values(buckets).reduce((a, b) => a + b, 0);
  return { buckets, total };
}

/** Pratinjau dampak hapus: bisa hard-delete atau harus anonim. */
export async function getEmployeeDeleteImpact(userId: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!can(actor, "user.deactivate")) throw new Error("Hanya Owner yang boleh menghapus pegawai.");

    const user = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id },
      select: { id: true, name: true, username: true, role: { select: { name: true } }, _count: { select: HISTORY_RELATIONS } },
    });
    if (!user) return { success: false as const, error: "Pegawai tidak ditemukan." };
    if (user.role.name === "owner") return { success: false as const, error: "Akun Owner tidak bisa dihapus." };
    if (user.id === actor.id) return { success: false as const, error: "Tidak bisa menghapus akun Anda sendiri." };

    const { buckets, total } = bucketCounts(user._count as HistoryCount);
    return {
      success: true as const,
      data: {
        name: user.name,
        username: user.username,
        canHardDelete: total === 0,
        total,
        buckets: Object.entries(buckets).filter(([, n]) => n > 0).map(([label, n]) => ({ label, n })),
      },
    };
  } catch (e) {
    console.error("getEmployeeDeleteImpact:", e);
    return { success: false as const, error: e instanceof Error ? e.message : "Terjadi kesalahan." };
  }
}

/**
 * Hapus pegawai. `total === 0` → hapus baris User permanen. Selain itu →
 * anonimkan (nama/kontak/login dihapus) + nonaktifkan, riwayat dipertahankan.
 */
export async function deleteEmployee(userId: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (!can(actor, "user.deactivate")) throw new Error("Hanya Owner yang boleh menghapus pegawai.");

    const user = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id },
      select: { id: true, name: true, username: true, role: { select: { name: true } }, _count: { select: HISTORY_RELATIONS } },
    });
    if (!user) return { success: false, error: "Pegawai tidak ditemukan." };
    if (user.role.name === "owner") return { success: false, error: "Akun Owner tidak bisa dihapus." };
    if (user.id === actor.id) return { success: false, error: "Tidak bisa menghapus akun Anda sendiri." };

    const { total } = bucketCounts(user._count as HistoryCount);

    if (total === 0) {
      await prisma.$transaction(async (tx) => {
        await tx.userRole.deleteMany({ where: { user_id: userId } });
        await tx.passwordResetToken.deleteMany({ where: { user_id: userId } });
        await tx.user.delete({ where: { id: userId } });
      });
      await logAction(actor.id, "EMPLOYEE_DELETED", "User", userId, { name: user.name, username: user.username }, { mode: "hard_delete" }, impersonationNote(actor));
      revalidatePath("/owner/users");
      return { success: true, mode: "deleted" as const };
    }

    const tag = userId.slice(0, 8);
    const deadHash = await bcrypt.hash(`deleted-${userId}-${Date.now()}`, 12);
    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { user_id: userId } });
      await tx.passwordResetToken.deleteMany({ where: { user_id: userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          name: "Mantan Pegawai",
          username: `deleted_${tag}`,
          email: `deleted_${tag}@deleted.invalid`,
          phone: null,
          avatar_url: null,
          base_salary: null,
          active: false,
          deactivated_at: new Date(),
          must_change_password: false,
          failed_login_count: 0,
          locked_until: null,
          password_hash: deadHash,
          password_changed_at: new Date(), // batalkan sesi yang sedang berjalan
        },
      });
    });
    await logAction(actor.id, "EMPLOYEE_ANONYMIZED", "User", userId, { name: user.name, username: user.username }, { mode: "anonymize", kept_history: true }, impersonationNote(actor));
    revalidatePath("/owner/users");
    return { success: true, mode: "anonymized" as const };
  } catch (e) {
    console.error("deleteEmployee:", e);
    return { success: false, error: e instanceof Error ? e.message : "Terjadi kesalahan." };
  }
}
