import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export interface Actor {
  id: string;
  name: string;
  role: string;
}

/**
 * User yang sedang menjalankan aksi.
 *
 * Sumber utama: sesi NextAuth. Selama middleware masih mem-bypass auth
 * (mode preview UI), fallback ke user admin/owner pertama milik tenant
 * supaya Server Action tetap bisa dites. Hapus fallback begitu RBAC aktif
 * (lihat task "Aktifkan RBAC guard di middleware").
 */
export async function getCurrentUser(): Promise<Actor | null> {
  const session = await auth();
  const sid = session?.user?.id;
  if (sid) {
    const u = await prisma.user.findUnique({ where: { id: sid }, include: { role: true } });
    if (u) {
      // Revoke sesi lama: token yang terbit sebelum password terakhir diganti ditolak.
      const tokenPw = session.user.pwChangedAt ?? 0;
      if (u.password_changed_at && u.password_changed_at.getTime() > tokenPw) return null;
      return { id: u.id, name: u.name, role: u.role.name };
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const tenant = await requireTenant();
    const fallback = await prisma.user.findFirst({
      where: { tenant_id: tenant.id, active: true, role: { name: { in: ["owner", "admin"] } } },
      include: { role: true },
      orderBy: { created_at: "asc" },
    });
    if (fallback) {
      console.warn("⚠️ actor: DEVELOPMENT FALLBACK user:", fallback.username);
      return { id: fallback.id, name: fallback.name, role: fallback.role.name };
    }
  }

  return null;
}

export async function requireUser(): Promise<Actor> {
  const actor = await getCurrentUser();
  if (!actor) throw new Error("Sesi tidak valid. Silakan login ulang.");
  return actor;
}
