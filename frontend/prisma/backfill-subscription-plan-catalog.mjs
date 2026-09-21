/**
 * Sinkronkan SELURUH katalog `SubscriptionPlan` (nama, harga, kuota, fitur) ke
 * definisi terbaru di `src/lib/saas-catalog.ts` (SAAS_PLANS).
 *
 *   node prisma/backfill-subscription-plan-catalog.mjs                 # DRY RUN
 *   APPLY=true node prisma/backfill-subscription-plan-catalog.mjs      # benar-benar setel
 *
 * Kenapa ini perlu: `registerTenant()` memakai `subscriptionPlan.upsert({ update: {} })`
 * dan `ensure-subscription-plans.mjs` sengaja CREATE-ONLY (grandfathering). Jadi saat
 * katalog berubah — mis. restrukturisasi 2026-09-21 menjadi 3 paket self-serve
 * (Starter Rp199rb / Pro Rp399rb / Business Rp799rb) — baris lama tetap menyimpan
 * harga & kuota lama, dan tenant baru yang mendaftar pun ikut harga lama.
 *
 * Skrip ini berbeda dari `backfill-subscription-plan-features.mjs` (yang hanya
 * menyentuh features_json). Di sini harga & kuota ikut disamakan. Jalankan
 * `ensure-subscription-plans.mjs` dulu untuk membuat baris yang belum ada.
 *
 * Idempoten: hanya meng-update baris yang benar-benar berbeda. Enterprise tidak
 * punya baris katalog (kontrak manual lewat Sales).
 *
 * Ditulis .mjs tanpa import dari src/ supaya jalan dengan `node` polos. KALAU
 * `SAAS_PLANS` berubah, perbarui `TARGET_PLANS` di bawah agar tetap sinkron.
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
      "purchase_orders", "api",
    ]),
  },
];

const same = (a, b) => (a == null && b == null) || Number(a) === Number(b);

async function main() {
  const changes = [];
  for (const plan of TARGET_PLANS) {
    const row = await prisma.subscriptionPlan.findUnique({ where: { slug: plan.slug } });
    if (!row) {
      console.log(`  (lewati) ${plan.slug} — baris belum ada; jalankan ensure-subscription-plans.mjs dulu.`);
      continue;
    }
    const diffs = [];
    if (row.name !== plan.name) diffs.push(`name ${row.name} → ${plan.name}`);
    if (!same(row.price_monthly, plan.price_monthly)) diffs.push(`harga ${row.price_monthly} → ${plan.price_monthly}`);
    if (!same(row.max_users, plan.max_users)) diffs.push(`max_users ${row.max_users} → ${plan.max_users}`);
    if (!same(row.max_orders_per_month, plan.max_orders_per_month)) diffs.push(`max_orders ${row.max_orders_per_month} → ${plan.max_orders_per_month}`);
    if (row.features_json !== plan.features_json) diffs.push("features_json berbeda");
    if (diffs.length) changes.push({ plan, diffs });
  }

  if (changes.length === 0) {
    console.log("\n✔ Semua SubscriptionPlan sudah sesuai SAAS_PLANS. Tidak ada yang perlu diubah.\n");
    return;
  }

  console.log(`\n${changes.length} SubscriptionPlan akan disinkronkan` + (APPLY ? ":\n" : "  —  DRY RUN, set APPLY=true untuk eksekusi:\n"));
  for (const { plan, diffs } of changes) {
    const subs = await prisma.tenantSubscription.count({ where: { plan_id: (await prisma.subscriptionPlan.findUnique({ where: { slug: plan.slug } })).id, status: "ACTIVE" } });
    console.log(`  ${plan.slug.padEnd(10)} (${subs} tenant aktif)`);
    for (const d of diffs) console.log(`    - ${d}`);
  }

  if (!APPLY) {
    console.log("\nTidak ada perubahan. Jalankan ulang dengan APPLY=true bila rencana di atas benar.\n");
    return;
  }

  let done = 0;
  for (const { plan } of changes) {
    await prisma.subscriptionPlan.update({
      where: { slug: plan.slug },
      data: {
        name: plan.name,
        price_monthly: plan.price_monthly,
        max_users: plan.max_users,
        max_orders_per_month: plan.max_orders_per_month,
        features_json: plan.features_json,
      },
    });
    done++;
  }
  console.log(`\n✔ ${done} SubscriptionPlan disinkronkan.\n`);
}

main()
  .catch((err) => {
    console.error("\n✖ Backfill gagal:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
