/**
 * Ubah semua tenant berstatus TRIAL menjadi ACTIVE — konsekuensi penghapusan
 * free trial (2026-09-21). Tenant yang sedang uji coba tidak diputus aksesnya.
 *
 *   node prisma/backfill-trial-to-active.mjs                 # DRY RUN
 *   APPLY=true node prisma/backfill-trial-to-active.mjs      # eksekusi
 *
 * Idempoten: hanya menyentuh baris yang masih TRIAL. `trial_ends_at`
 * dikosongkan agar tidak ada sisa data trial yang menyesatkan.
 *
 * Setelah ini, `prisma/backfill-churn-stale-trials.mjs` tidak lagi relevan
 * (tidak akan menemukan tenant TRIAL).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.env.APPLY === "true";

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { status: "TRIAL" },
    select: { id: true, slug: true, plan: true },
    orderBy: { created_at: "asc" },
  });

  if (tenants.length === 0) {
    console.log("\n✔ Tidak ada tenant berstatus TRIAL. Tidak ada yang perlu diubah.\n");
    return;
  }

  console.log(`\n${tenants.length} tenant TRIAL akan diubah menjadi ACTIVE` + (APPLY ? ":\n" : "  —  DRY RUN, set APPLY=true untuk eksekusi:\n"));
  for (const t of tenants) {
    console.log(`  ${t.slug.padEnd(24)} plan ${t.plan}`);
  }

  if (!APPLY) {
    console.log("\nTidak ada perubahan. Jalankan ulang dengan APPLY=true bila rencana di atas benar.\n");
    return;
  }

  const result = await prisma.tenant.updateMany({
    where: { status: "TRIAL" },
    data: { status: "ACTIVE", trial_ends_at: null },
  });
  console.log(`\n✔ ${result.count} tenant diubah menjadi ACTIVE.\n`);
}

main()
  .catch((err) => {
    console.error("\n✖ Backfill gagal:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
