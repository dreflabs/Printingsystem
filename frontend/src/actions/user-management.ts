"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser, requireMutableActor } from "@/lib/actor";
import { logAction } from "@/lib/logger";
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
} as const;

export async function getTenantUsers() {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (actor.role !== "owner") throw new Error("Hanya Owner yang boleh melihat daftar pegawai.");

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
  role_name: string;
  extra_role_names?: string[]; // Additional roles beyond primary
}) {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (actor.role !== "owner") throw new Error("Hanya Owner yang boleh menambah pegawai.");
    if (data.role_name === "owner" || data.extra_role_names?.includes("owner")) {
      throw new Error("Role Owner tidak bisa dibuat lewat form ini.");
    }

    // Find the primary role ID
    const role = await prisma.role.findUnique({ where: { name: data.role_name } });
    if (!role) throw new Error("Role not found");

    // Check if username/email already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: data.username }, { email: data.email }],
      },
    });
    if (existing) throw new Error("Username atau Email sudah digunakan");

    // Default password for new employees: printpilot123!
    const defaultPassword = "printpilot123!";
    const password_hash = await bcrypt.hash(defaultPassword, 12);

    const newUser = await prisma.user.create({
      data: {
        tenant_id: tenant.id,
        name: data.name,
        username: data.username,
        email: data.email,
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

    await logAction(actor.id, "EMPLOYEE_CREATED", "User", newUser.id, null, {
      name: data.name,
      username: data.username,
      role: data.role_name,
      extra_roles: data.extra_role_names ?? [],
    });

    revalidatePath("/owner/users");
    return { success: true, user: newUser, tempPassword: defaultPassword };
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
    if (actor.role !== "owner") throw new Error("Hanya Owner yang boleh mengubah role pegawai.");
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

    await logAction(actor.id, "USER_ROLES_UPDATED", "User", userId, oldRoleNames, roleNames);

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
    if (actor.role !== "owner") throw new Error("Hanya Owner yang boleh mengaktifkan/menonaktifkan pegawai.");

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

    await logAction(actor.id, active ? "EMPLOYEE_ACTIVATED" : "EMPLOYEE_DEACTIVATED", "User", userId, { active: user.active }, { active });

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
    if (actor.role !== "owner") throw new Error("Hanya Owner yang boleh membuka kunci akun pegawai.");

    const user = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id },
    });
    if (!user) throw new Error("User tidak ditemukan");

    await prisma.user.update({
      where: { id: userId },
      data: { failed_login_count: 0, locked_until: null },
    });

    await logAction(actor.id, "EMPLOYEE_ACCOUNT_UNLOCKED", "User", userId);

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
    if (actor.role !== "owner") throw new Error("Hanya Owner yang boleh me-reset password pegawai.");

    const user = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id },
      include: { role: true },
    });
    if (!user) throw new Error("User not found");
    if (user.role.name === "owner") throw new Error("Owner must use self-service reset");

    const newPassword = "printpilot123!";
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

    await logAction(actor.id, "EMPLOYEE_PASSWORD_RESET", "User", userId);

    revalidatePath("/owner/users");
    return { success: true, newPassword };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." };
  }
}
