/**
 * Rekonsiliasi `StorageLocation.capacity_current` dengan isi rak yang sebenarnya.
 *
 *   node prisma/backfill-storage-slot-count.mjs              # DRY RUN (lihat saja)
 *   APPLY=true node prisma/backfill-storage-slot-count.mjs   # benar-benar setel
 *
 * Sebelum perbaikan alur order multi-job, `assignStorageLocation` menambah
 * `capacity_current` per job tapi `confirmItemAtCounter` / `releaseOrder` hanya
 * mengurangi untuk job yang di-scan — sisa job order combo membuat slot "terisi
 * hantu" permanen. Skrip ini menyetel ulang `capacity_current` = jumlah
 * `StorageItem` berstatus STORED di lokasi itu.
 *
 * Idempoten & aman dijalankan kapan saja. Tidak menyentuh StorageItem / order.
 * Ditulis .mjs supaya bisa `node` langsung di container produksi.
 *
 * Variabel lingkungan:
 *   APPLY=true   wajib untuk eksekusi; tanpa ini hanya menampilkan rencana
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.env.APPLY === "true";

async function main() {
  const locs = await prisma.storageLocation.findMany({
    orderBy: [{ tenant_id: "asc" }, { location_code: "asc" }],
    select: { id: true, location_code: true, capacity_current: true, capacity_max: true, tenant_id: true },
  });

  const plan = [];
  for (const l of locs) {
    const actual = await prisma.storageItem.count({
      where: { location_id: l.id, status: "STORED" },
    });
    if (actual !== l.capacity_current) {
      plan.push({ l, actual });
    }
  }

  if (plan.length === 0) {
    console.log("\n✔ Semua lokasi sudah konsisten. Tidak ada yang perlu diperbaiki.\n");
    return;
  }

  console.log(
    `\n${plan.length} lokasi tidak konsisten` +
      (APPLY ? ":\n" : "  —  DRY RUN, set APPLY=true untuk eksekusi:\n")
  );
  for (const { l, actual } of plan) {
    const drift = actual - l.capacity_current;
    console.log(
      `  ${l.location_code.padEnd(18)} tercatat ${String(l.capacity_current).padStart(3)}  →  aktual ${String(actual).padStart(3)}  (${drift > 0 ? "+" : ""}${drift})`
    );
  }

  if (!APPLY) {
    console.log("\nTidak ada perubahan. Jalankan ulang dengan APPLY=true bila rencana di atas benar.\n");
    return;
  }

  let done = 0;
  for (const { l, actual } of plan) {
    await prisma.storageLocation.update({
      where: { id: l.id },
      data: { capacity_current: actual },
    });
    done++;
  }
  console.log(`\n✔ ${done} lokasi disetel ulang.\n`);
}

main()
  .catch((err) => {
    console.error("\n✖ Backfill gagal:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
