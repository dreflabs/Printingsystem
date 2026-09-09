"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser, requireMutableActor, impersonationNote } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { generateTempPassword } from "@/lib/temp-password";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

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
  base_salary: true,
  role: { select: { name: true } },
  extra_roles: { select: { role: { select: { name: true } } } },
  user_machines: { select: { machine_id: true, machine: { select: { name: true } } } },
} as const;

export async function updateOperatorMachines(userId: string, machineIds: string[]): Promise<ActionResult<null>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    
    // Hanya Owner yang boleh mengatur ini
    if (!actor.roles.includes("owner")) return fail("Hanya Owner yang boleh mengatur penugasan mesin.");

    // Verifikasi user yang dituju ada di tenant yang sama
    const target = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id },
      include: { role: true, extra_roles: { include: { role: true } } }
    });
    if (!target) return fail("Pegawai tidak ditemukan.");

    // Pastikan user tersebut punya role operator
    const isOp = target.role.name === "operator" || target.extra_roles.some(er => er.role.name === "operator");
    if (!isOp) return fail("Pegawai ini tidak memiliki role Operator Cetak.");

    await prisma.$transaction(async (tx) => {
      // Hapus yang lama
      await tx.userMachine.deleteMany({
        where: { tenant_id: tenant.id, user_id: userId }
      });
      
      // Insert yang baru
      if (machineIds.length > 0) {
        await tx.userMachine.createMany({
          data: machineIds.map(mid => ({
            tenant_id: tenant.id,
            user_id: userId,
            machine_id: mid,
            assigned_by: actor.id,
          }))
        });
      }
      
      await logAction(actor.id, "UPDATE_OPERATOR_MACHINES", "User", userId, "Assigned machines updated", { machineIds });
    });

    revalidatePath("/owner/users");
    return ok(null);
  } catch (error) {
    console.error("updateOperatorMachines error:", error);
    return fail("Terjadi kesalahan saat menyimpan tugas mesin.");
  }
}

export async function getTenantUsers() {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!actor.roles.includes("owner")) throw new Error("Hanya Owner yang boleh melihat daftar pegawai.");

    const users = await prisma.user.findMany({
      where: { tenant_id: tenant.id },
      select: USER_SELECT,
      orderBy: { created_at: "desc" },
    });
    // Decimal tidak bisa lewat batas Server Action — konversi ke number/null.
    return users.map((u) => ({ ...u, base_salary: u.base_salary == null ? null : Number(u.base_salary) }));
  } catch (error) {
    console.error("Error fetching tenant users:", error);
    throw new Error("Failed to fetch users");
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
    if (!actor.roles.includes("owner")) throw new Error("Hanya Owner yang boleh menambah pegawai.");
    if (data.role_name === "owner" || data.extra_role_names?.includes("owner")) {
      throw new Error("Role Owner tidak bisa dibuat lewat form ini.");
    }

    // Find the primary role ID
    const role = await prisma.role.findUnique({ where: { name: data.role_name } });
    if (!role) throw new Error("Role not found");

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
        must_change_password: true,
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

/**
 * Update the roles for an existing user.
 * The first role in the array becomes the primary role.
 * All remaining roles are stored as extra_roles.
 */
export async function updateUserRoles(userId: string, roleNames: string[]) {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (!actor.roles.includes("owner")) throw new Error("Hanya Owner yang boleh mengubah role pegawai.");
    if (roleNames.length === 0) throw new Error("Minimal 1 role harus dipilih");

    const user = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id },
      include: { role: true },
    });
    if (!user) throw new Error("User tidak ditemukan");
    if (user.role.name === "owner" && !roleNames.includes("owner")) {
      throw new Error("Role Owner tidak bisa dihapus dari akun Owner");
    }
    if (roleNames.includes("owner") && user.role.name !== "owner") {
      throw new Error("Role Owner tidak bisa ditambahkan lewat form ini.");
    }
    const oldRoleNames = [user.role.name];

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
    if (!actor.roles.includes("owner")) throw new Error("Hanya Owner yang boleh mengaktifkan/menonaktifkan pegawai.");

    const user = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id },
      include: { role: true },
    });
    if (!user) throw new Error("User not found");
    if (user.role.name === "owner") throw new Error("Cannot deactivate the owner account");

    await prisma.user.update({
      where: { id: userId },
      data: {
        active,
        deactivated_at: active ? null : new Date(),
      },
    });

    await logAction(actor.id, active ? "EMPLOYEE_ACTIVATED" : "EMPLOYEE_DEACTIVATED", "User", userId, { active: user.active }, { active }, impersonationNote(actor));

    revalidatePath("/owner/users");
    return { success: true };
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
    if (!actor.roles.includes("owner")) throw new Error("Hanya Owner yang boleh membuka kunci akun pegawai.");

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
    if (!actor.roles.includes("owner")) throw new Error("Hanya Owner yang boleh me-reset password pegawai.");

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
    if (!actor.roles.includes("owner")) throw new Error("Hanya Owner yang boleh menghapus pegawai.");

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
    if (!actor.roles.includes("owner")) throw new Error("Hanya Owner yang boleh menghapus pegawai.");

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
