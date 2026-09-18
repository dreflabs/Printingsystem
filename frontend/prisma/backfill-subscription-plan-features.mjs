/**
 * Sinkronkan `SubscriptionPlan.features_json` ke definisi terbaru di
 * `src/lib/saas-catalog.ts` (SAAS_PLANS).
 *
 *   node prisma/backfill-subscription-plan-features.mjs                 # DRY RUN (lihat saja)
 *   APPLY=true node prisma/backfill-subscription-plan-features.mjs      # benar-benar setel
 *
 * Kenapa ini perlu: `registerTenant()` (src/actions/register.ts) memakai
 * `subscriptionPlan.upsert({ update: {} })` — begitu baris plan untuk sebuah
 * slug ada, `features_json`-nya TIDAK PERNAH disentuh lagi oleh registrasi
 * berikutnya, walau kode `SAAS_PLANS` di repo sudah berubah. Setelah audit
 * 2026-09-17 mengunci "qc" dari paket Starter (SAAS-MODEL.md: Modul QC
 * Pro-only), baris `SubscriptionPlan` yang sudah lama ada di DB masih
 * menyimpan fitur lama sampai skrip ini dijalankan — perubahan kode saja
 * tidak berlaku surut ke tenant yang sudah terdaftar.
 *
 * Idempoten: hanya meng-update baris yang `features_json`-nya BEDA dari
 * daftar di bawah. Tidak menyentuh price/max_users/dll — itu bagian paket
 * berbayar yang mungkin sengaja berbeda per baris lama (grandfathering),
 * hanya daftar fitur yang disamakan.
 *
 * Ditulis .mjs tanpa import dari src/ (sama seperti backfill lain di folder
 * ini) supaya jalan dengan `node` polos di container produksi yang mungkin
 * tidak punya dukungan strip-types TypeScript. KALAU `SAAS_PLANS` di
 * src/lib/saas-catalog.ts berubah lagi, perbarui daftar `TARGET_FEATURES`
 * di bawah secara manual supaya tetap sinkron.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.env.APPLY === "true";

// Harus sama persis dengan SAAS_PLANS.<slug>.features di src/lib/saas-catalog.ts
const TARGET_FEATURES = {
  starter: ["dashboard", "kanban"],
  pro: ["dashboard", "kanban", "qc", "storage", "whatsapp_unlimited", "audit_trail"],
};

async function main() {
  const plan = [];
  for (const [slug, features] of Object.entries(TARGET_FEATURES)) {
    const row = await prisma.subscriptionPlan.findUnique({ where: { slug } });
    if (!row) continue; // belum pernah ada tenant yang daftar paket ini — tidak perlu backfill
    const target = JSON.stringify(features);
    if (row.features_json !== target) {
      plan.push({ row, target });
    }
  }

  if (plan.length === 0) {
    console.log("\n✔ Semua SubscriptionPlan sudah sesuai SAAS_PLANS. Tidak ada yang perlu diubah.\n");
    return;
  }

  console.log(`\n${plan.length} SubscriptionPlan akan disinkronkan` + (APPLY ? ":\n" : "  —  DRY RUN, set APPLY=true untuk eksekusi:\n"));
  for (const { row, target } of plan) {
    const subCount = await prisma.tenantSubscription.count({ where: { plan_id: row.id, status: "ACTIVE" } });
    console.log(`  ${row.slug.padEnd(12)} (${subCount} tenant aktif)`);
    console.log(`    lama : ${row.features_json}`);
    console.log(`    baru : ${target}`);
  }

  if (!APPLY) {
    console.log("\nTidak ada perubahan. Jalankan ulang dengan APPLY=true bila rencana di atas benar.\n");
    return;
  }

  let done = 0;
  for (const { row, target } of plan) {
    await prisma.subscriptionPlan.update({ where: { id: row.id }, data: { features_json: target } });
    done++;
  }
  console.log(`\n✔ ${done} SubscriptionPlan diperbarui.\n`);
}

main()
  .catch((err) => {
    console.error("\n✖ Backfill gagal:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
