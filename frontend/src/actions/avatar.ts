"use server";

import { requireUser } from "@/lib/actor";
import { getCurrentTenant } from "@/lib/tenant";
import { presignPutUrl } from "@/lib/storage";

const MAX_AVATAR_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export async function createAvatarUploadUrl(fileName: string, fileSize: number, fileType: string) {
  try {
    const actor = await requireUser();
    const tenant = await getCurrentTenant();
    
    if (!tenant) {
      return { success: false, error: "Akses ditolak. Anda tidak berada dalam workspace aktif." };
    }

    if (fileSize > MAX_AVATAR_UPLOAD_BYTES) {
      return { success: false, error: "File terlalu besar. Maksimum 5 MB." };
    }

    if (!fileType.startsWith("image/")) {
      return { success: false, error: "Format file tidak valid. Harap unggah gambar." };
    }

    const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : ".jpg";
    
    // Validasi esktensi
    if (!["jpg", "jpeg", "png", "webp"].includes(extMatch?.[1]?.toLowerCase() || "jpg")) {
      return { success: false, error: "Format gambar harus JPG, PNG, atau WEBP." };
    }
    
    const objectKey = `avatars/${tenant.id}/${actor.id}-${Date.now()}${ext}`;
    const uploadUrl = await presignPutUrl(objectKey);

    return { success: true, data: { uploadUrl, objectKey } };
  } catch (error) {
    console.error("createAvatarUploadUrl error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Gagal menyiapkan upload." };
  }
}
