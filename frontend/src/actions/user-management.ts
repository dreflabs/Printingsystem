"use server";

import { requireTenant } from "@/lib/tenant";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

export async function getTenantUsers() {
  try {
    const tenant = await requireTenant();
    const users = await prisma.user.findMany({
      where: { tenant_id: tenant.id },
      include: { role: true },
      orderBy: { created_at: "desc" },
    });
    return users;
  } catch (error) {
    console.error("Error fetching tenant users:", error);
    throw new Error("Failed to fetch users");
  }
}

export async function createEmployee(data: { name: string; username: string; email: string; role_name: string }) {
  try {
    const tenant = await requireTenant();
    
    // Find the role ID
    const role = await prisma.role.findUnique({
      where: { name: data.role_name }
    });
    if (!role) throw new Error("Role not found");

    // Check if username/email already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: data.username },
          { email: data.email }
        ]
      }
    });

    if (existing) {
      throw new Error("Username or Email already exists");
    }

    // Default password for new employees: printpilot123!
    const defaultPassword = "printpilot123!";
    const password_hash = await bcrypt.hash(defaultPassword, 10);

    const newUser = await prisma.user.create({
      data: {
        tenant_id: tenant.id,
        name: data.name,
        username: data.username,
        email: data.email,
        password_hash,
        role_id: role.id,
        must_change_password: true,
      }
    });

    revalidatePath("/owner/users");
    return { success: true, user: newUser, tempPassword: defaultPassword };
  } catch (error: any) {
    console.error("Error creating employee:", error);
    return { success: false, error: error.message };
  }
}

export async function toggleEmployeeStatus(userId: string, active: boolean) {
  try {
    const tenant = await requireTenant();
    
    // Ensure the user belongs to this tenant
    const user = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id },
      include: { role: true }
    });
    if (!user) throw new Error("User not found");
    if (user.role.name === "owner") throw new Error("Cannot deactivate the owner account");

    await prisma.user.update({
      where: { id: userId },
      data: { 
        active,
        deactivated_at: active ? null : new Date() 
      }
    });

    revalidatePath("/owner/users");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function resetEmployeePassword(userId: string) {
  try {
    const tenant = await requireTenant();
    
    const user = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id },
      include: { role: true }
    });
    if (!user) throw new Error("User not found");
    if (user.role.name === "owner") throw new Error("Owner must use self-service reset");

    const newPassword = "printpilot123!";
    const password_hash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { 
        password_hash,
        must_change_password: true,
        failed_login_count: 0,
        locked_until: null
      }
    });

    revalidatePath("/owner/users");
    return { success: true, newPassword };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
