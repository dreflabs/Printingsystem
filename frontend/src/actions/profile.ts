"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

/** Profil user berdasarkan ID (dipakai Header untuk user yang sedang login) — hanya profil milik sendiri. */
export async function getUserProfileById(userId: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (userId !== actor.id) return null;
    return await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id },
      select: { id: true, name: true, username: true, email: true, phone: true, avatar_url: true },
    });
  } catch (error) {
    console.error("getUserProfileById:", error);
    return null;
  }
}

export async function updateProfile(userId: string, data: { name: string; username: string; email: string; phone: string; avatar_url: string }) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (userId !== actor.id) throw new Error("Tidak bisa mengubah profil pengguna lain.");

    // Check if user exists and belongs to tenant
    const user = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id }
    });

    if (!user) throw new Error("User not found or access denied");

    // Validate uniqueness of username and email
    if (data.username !== user.username) {
      const existingUsername = await prisma.user.findFirst({
        where: { username: data.username, id: { not: userId } }
      });
      if (existingUsername) throw new Error("Username sudah digunakan oleh akun lain.");
    }

    if (data.email !== user.email) {
      const existingEmail = await prisma.user.findFirst({
        where: { email: data.email, id: { not: userId } }
      });
      if (existingEmail) throw new Error("Email sudah digunakan oleh akun lain.");
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        username: data.username,
        email: data.email,
        phone: data.phone || null,
        avatar_url: data.avatar_url || null
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        avatar_url: true,
        role: true
      }
    });

    revalidatePath("/", "layout");
    
    return { success: true, user: updatedUser };
  } catch (error: unknown) {
    console.error("Error updating profile:", error);
    return { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." };
  }
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (userId !== actor.id) throw new Error("Tidak bisa mengubah password pengguna lain.");

    const user = await prisma.user.findFirst({
      where: { id: userId, tenant_id: tenant.id }
    });
    
    if (!user) throw new Error("User not found or access denied");

    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) {
      throw new Error("Password lama yang Anda masukkan salah.");
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    
    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: newHash, password_changed_at: new Date() }
    });

    return { success: true };
  } catch (error: unknown) {
    console.error("Error changing password:", error);
    return { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." };
  }
}
