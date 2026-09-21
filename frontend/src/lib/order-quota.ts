import { prisma } from "@/lib/prisma";
import { getTenantEntitlements } from "@/lib/entitlements";

/**
 * Kuota order bulanan paket tenant (mis. Starter 200/bulan).
 *
 * Dipakai bersama oleh pembuatan order cetak (`createOrder`) dan penjualan
 * kasir (`processRetailOrder`) supaya batas paket tidak bisa dilewati lewat
 * jalur POS. Mengembalikan pesan error bila kuota penuh, atau `null` bila masih
 * tersedia / paket tanpa batas.
 */
export async function checkMonthlyOrderQuota(tenantId: string): Promise<string | null> {
  const entitlements = await getTenantEntitlements(tenantId);
  if (entitlements.maxOrdersPerMonth == null) return null;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const ordersThisMonth = await prisma.order.count({
    where: { tenant_id: tenantId, created_at: { gte: startOfMonth } },
  });

  if (ordersThisMonth >= entitlements.maxOrdersPerMonth) {
    return `Kuota order bulanan paket Anda sudah penuh (${ordersThisMonth}/${entitlements.maxOrdersPerMonth}). Owner bisa upgrade paket sendiri di /owner/billing, atau hubungi halo@printpilot.id.`;
  }
  return null;
}
