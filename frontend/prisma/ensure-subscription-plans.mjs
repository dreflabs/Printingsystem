/**
 * Pastikan baris `SubscriptionPlan` untuk setiap paket di `SAAS_PLANS`
 * (src/lib/saas-catalog.ts) ada di database — TANPA menyentuh baris yang
 * sudah ada (harga/kuota lama tetap dihormati, mis. grandfathering).
 *
 *   node prisma/ensure-subscription-plans.mjs                 # DRY RUN (lihat saja)
 *   APPLY=true node prisma/ensure-subscription-plans.mjs      # benar-benar buat
 *
 * Kenapa ini perlu: `registerTenant()` (src/actions/register.ts) memakai
 * `subscriptionPlan.upsert({ update: {} })` per slug — baris plan baru
 * tercipta HANYA saat tenant pertama mendaftar paket itu lewat self-serve.
 * Kalau Super Admin mencoba pindahkan tenant ke paket yang belum pernah
 * dipakai siapa pun (mis. "Pro" di server yang semua tenantnya masih
 * Starter), `changePlanCore()` (src/lib/plan-change.ts) menolak dengan
 * "belum ada di katalog SubscriptionPlan" — baris ini belum pernah dibuat.
 *
 * Aman dijalankan berkali-kali: hanya CREATE untuk slug yang belum ada,
 * tidak pernah UPDATE/DELETE baris yang sudah ada. Jangan pakai
 * `prisma/seed.ts` untuk ini — skrip itu menghapus SEMUA data (user,
 * tenant, dst), tidak boleh dijalankan di database yang sudah berisi data
 * produksi/staging asli.
 *
 * Ditulis .mjs tanpa import dari src/ (sama seperti backfill lain di folder
 * ini) supaya jalan dengan `node` polos di container produksi yang mungkin
 * tidak punya dukungan strip-types TypeScript. KALAU `SAAS_PLANS` di
 * src/lib/saas-catalog.ts berubah, perbarui daftar `TARGET_PLANS` di bawah
 * secara manual supaya tetap sinkron.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.env.APPLY === "true";

// Harus sama persis dengan SAAS_PLANS di src/lib/saas-catalog.ts
const TARGET_PLANS = [
  {
    name: "Starter",
    slug: "starter",
    price_monthly: 199000,
    max_users: 3,
    max_orders_per_month: 200,
    features_json: JSON.stringify(["dashboard", "kanban", "pos", "reports"]),
  },
  {
    name: "Pro",
    slug: "pro",
    price_monthly: 399000,
    max_users: 5,
    max_orders_per_month: null,
    features_json: JSON.stringify([
      "dashboard", "kanban", "pos", "reports", "qc", "storage", "audit_trail",
      "hrm", "inventory", "layout", "reports_finance", "whatsapp_unlimited",
    ]),
  },
  {
    name: "Business",
    slug: "business",
    price_monthly: 799000,
    max_users: 10,
    max_orders_per_month: null,
    features_json: JSON.stringify([
      "dashboard", "kanban", "pos", "reports", "qc", "storage", "audit_trail",
      "hrm", "inventory", "layout", "reports_finance", "whatsapp_unlimited",
      "purchase_orders",
    ]),
  },
];

async function main() {
  const missing = [];
  for (const plan of TARGET_PLANS) {
    const row = await prisma.subscriptionPlan.findUnique({ where: { slug: plan.slug } });
    if (!row) missing.push(plan);
  }

  if (missing.length === 0) {
    console.log("\n✔ Semua paket di SAAS_PLANS sudah punya baris SubscriptionPlan. Tidak ada yang perlu dibuat.\n");
    return;
  }

  console.log(`\n${missing.length} SubscriptionPlan akan dibuat` + (APPLY ? ":\n" : "  —  DRY RUN, set APPLY=true untuk eksekusi:\n"));
  for (const plan of missing) {
    console.log(`  ${plan.slug.padEnd(10)} ${plan.name} — Rp${plan.price_monthly.toLocaleString("id-ID")}/bulan`);
  }

  if (!APPLY) {
    console.log("\nTidak ada perubahan. Jalankan ulang dengan APPLY=true bila rencana di atas benar.\n");
    return;
  }

  let done = 0;
  for (const plan of missing) {
    await prisma.subscriptionPlan.create({ data: plan });
    done++;
  }
  console.log(`\n✔ ${done} SubscriptionPlan dibuat.\n`);
}

main()
  .catch((err) => {
    console.error("\n✖ Gagal:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
