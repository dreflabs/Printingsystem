"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

/** Password bawaan sistem untuk pegawai baru (lihat createEmployee). Dilarang dipakai sebagai password permanen. */
const DEFAULT_EMPLOYEE_PASSWORD = "printpilot123!";

/** Slug + nama workspace milik user yang sedang login — dipakai untuk menampilkan alamat login pegawai. */
export async function getMyWorkspace(): Promise<{ slug: string; name: string } | null> {
  try {
    const tenant = await requireTenant();
    await requireUser();
    const row = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { slug: true, name: true },
    });
    return row ? { slug: row.slug, name: row.name } : null;
  } catch (error) {
    console.error("getMyWorkspace:", error);
    return null;
  }
}

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

    // Username & email hanya unik PER TENANT, jadi pemeriksaannya dibatasi ke
    // percetakan ini. Tanpa `tenant_id`, pengguna ditolak hanya karena percetakan
    // lain memakai nama yang sama — dan pesan galatnya bisa dipakai menebak akun
    // di percetakan lain.
    if (data.username !== user.username) {
      const existingUsername = await prisma.user.findFirst({
        where: { tenant_id: tenant.id, username: data.username, id: { not: userId } }
      });
      if (existingUsername) throw new Error("Username sudah digunakan oleh akun lain.");
    }

    if (data.email !== user.email) {
      const existingEmail = await prisma.user.findFirst({
        where: { tenant_id: tenant.id, email: data.email, id: { not: userId } }
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
      data: { password_hash: newHash, password_changed_at: new Date(), must_change_password: false }
    });

    return { success: true };
  } catch (error: unknown) {
    console.error("Error changing password:", error);
    return { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." };
  }
}

/**
 * Ganti password wajib pada login pertama. Tidak meminta password lama karena
 * sesi sudah membuktikan identitas; sebagai gantinya password baru harus benar-
 * benar berbeda dari bawaan sistem. Setelah sukses `must_change_password` dimatikan
 * dan `password_changed_at` di-bump — sesi lama otomatis tidak berlaku, klien
 * harus login ulang.
 */
export async function forcePasswordChange(newPassword: string) {
  try {
    await requireTenant();
    const actor = await requireUser();

    if (newPassword.length < 8) {
      return { success: false, error: "Kata sandi baru minimal 8 karakter." };
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return { success: false, error: "Kata sandi harus mengandung huruf dan angka." };
    }
    if (newPassword === DEFAULT_EMPLOYEE_PASSWORD) {
      return { success: false, error: "Gunakan kata sandi baru, bukan password bawaan sistem." };
    }

    const user = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!user) return { success: false, error: "Akun tidak ditemukan." };

    const sameAsOld = await bcrypt.compare(newPassword, user.password_hash);
    if (sameAsOld) {
      return { success: false, error: "Kata sandi baru tidak boleh sama dengan yang lama." };
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: actor.id },
      data: { password_hash: newHash, password_changed_at: new Date(), must_change_password: false },
    });

    return { success: true };
  } catch (error: unknown) {
    console.error("Error forcing password change:", error);
    return { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." };
  }
}
