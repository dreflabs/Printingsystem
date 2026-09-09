"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { ok, fail } from "@/types";

/**
 * Status kesiapan toko untuk checklist di Dashboard Owner. Ringan — hanya
 * hitung baris. Owner-only (setup toko memang tugas Owner).
 */
export async function getSetupChecklist() {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!actor.roles.includes("owner")) return fail("Hanya Owner yang boleh melihat checklist penyiapan.");

    const T = { tenant_id: tenant.id };
    const [machines, materials, printingProducts, printingWithMachine, retailProducts, storage, staff, orders] =
      await Promise.all([
        prisma.machine.count({ where: T }),
        prisma.material.count({ where: T }),
        prisma.product.count({ where: T }),
        prisma.product.count({ where: { ...T, default_machine_id: { not: null } } }),
        prisma.retailProduct.count({ where: T }),
        prisma.storageLocation.count({ where: T }),
        // Pegawai selain Owner sendiri.
        prisma.user.count({ where: { ...T, role: { name: { not: "owner" } } } }),
        prisma.order.count({ where: T }),
      ]);

    // Owner yang menjalankan sendiri (Solo Mode) = punya peran operasional
    // tambahan → item "pegawai" dianggap tuntas (memang tak perlu staf).
    const soloOwner = ["admin", "designer_sales", "operator", "gudang"].some((r) => actor.roles.includes(r));
    const totalProducts = printingProducts + retailProducts;
    // Mode SOLO: langkah "tambah pegawai" tidak relevan — buang dari checklist
    // (bukan sekadar ditandai selesai) supaya daftar penyiapan lebih ringkas.
    const soloView = (tenant as { workspace_mode?: string }).workspace_mode === "SOLO";

    const items = [
      { key: "machine", done: machines > 0, count: machines },
      { key: "material", done: materials > 0, count: materials },
      {
        key: "product",
        // Toko jasa cetak: minimal 1 produk cetak wajib punya Mesin Default,
        // kalau tidak auto-release tak pernah jalan. Toko retail-only lolos.
        done: totalProducts > 0 && (printingProducts === 0 || printingWithMachine > 0),
        count: totalProducts,
      },
      { key: "storage", done: storage > 0, count: storage },
      { key: "staff", done: staff > 0 || soloOwner, count: staff },
      { key: "order", done: orders > 0, count: orders },
    ].filter((it) => !(soloView && it.key === "staff"));
    const doneCount = items.filter((i) => i.done).length;

    return ok({ items, doneCount, total: items.length, allDone: doneCount === items.length });
  } catch (e) {
    console.error("getSetupChecklist:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat status penyiapan.");
  }
}
