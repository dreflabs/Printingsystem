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
    const [machines, materials, printingProducts, retailProducts, storage, staff, orders] = await Promise.all([
      prisma.machine.count({ where: T }),
      prisma.material.count({ where: T }),
      prisma.product.count({ where: T }),
      prisma.retailProduct.count({ where: T }),
      prisma.storageLocation.count({ where: T }),
      // Pegawai selain Owner sendiri.
      prisma.user.count({ where: { ...T, role: { name: { not: "owner" } } } }),
      prisma.order.count({ where: T }),
    ]);

    const items = [
      { key: "machine", done: machines > 0, count: machines },
      { key: "material", done: materials > 0, count: materials },
      { key: "product", done: printingProducts + retailProducts > 0, count: printingProducts + retailProducts },
      { key: "storage", done: storage > 0, count: storage },
      { key: "staff", done: staff > 0, count: staff },
      { key: "order", done: orders > 0, count: orders },
    ];
    const doneCount = items.filter((i) => i.done).length;

    return ok({ items, doneCount, total: items.length, allDone: doneCount === items.length });
  } catch (e) {
    console.error("getSetupChecklist:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat status penyiapan.");
  }
}
