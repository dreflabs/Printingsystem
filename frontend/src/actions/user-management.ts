"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";


export async function getTenantUsers() {
  try {
    const tenant = await requireTenant();
    const users = await prisma.user.findMany({
      where: { tenant_id: tenant.id },
      include: {
        role: true,
        extra_roles: { include: { role: true } },
      },
      orderBy: { created_at: "desc" },
    });
    return users;
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
    if (roleNames.length === 0) throw new Error("Minimal 1 role harus dipilih");

    const user = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id },
      include: { role: true },
    });
    if (!user) throw new Error("User tidak ditemukan");
    if (user.role.name === "owner" && !roleNames.includes("owner")) {
      throw new Error("Role Owner tidak bisa dihapus dari akun Owner");
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

    const user = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id },
    });
    if (!user) throw new Error("User tidak ditemukan");

    await prisma.user.update({
      where: { id: userId },
      data: { failed_login_count: 0, locked_until: null },
    });

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

    revalidatePath("/owner/users");
    return { success: true, newPassword };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." };
  }
}
