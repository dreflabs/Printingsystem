/**
 * Selaraskan `Tenant.max_users` dengan kuota paketnya (`SubscriptionPlan.max_users`).
 *
 *   node prisma/backfill-tenant-plan-quota.mjs                 # DRY RUN
 *   APPLY=true node prisma/backfill-tenant-plan-quota.mjs      # eksekusi
 *
 * Kenapa perlu: registrasi & gating membaca `Tenant.max_users` lebih dulu,
 * sehingga tenant lama bisa menyimpan kuota versi paket yang sudah berubah
 * (mis. Starter 5 user padahal ketentuan sekarang 3). Skrip ini MENYAMAKAN
 * kuota ke nilai paket — keputusan produk 2026-09-21: tidak ada grandfathering
 * kuota.
 *
 * `addon_users` (kursi tambahan berbayar) TIDAK disentuh: kapasitas efektif
 * tenant = max_users + addon_users.
 *
 * Aman: idempoten, hanya menyentuh tenant non-CHURNED yang punya baris paket,
 * dan tidak mengubah data pegawai. Tenant yang jumlah pegawai aktifnya melebihi
 * kuota baru dilaporkan (bisa menambah, tidak bisa merekrut lagi).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.env.APPLY === "true";
const SELF_SERVE = ["STARTER", "PRO", "BUSINESS"];

async function main() {
  const plans = await prisma.subscriptionPlan.findMany({
    select: { slug: true, name: true, max_users: true },
  });
  const bySlug = Object.fromEntries(plans.map((p) => [p.slug, p]));

  const tenants = await prisma.tenant.findMany({
    where: { status: { not: "CHURNED" }, plan: { in: SELF_SERVE } },
    select: { id: true, slug: true, plan: true, max_users: true, addon_users: true },
    orderBy: { created_at: "asc" },
  });

  const changes = [];
  const overQuota = [];

  for (const t of tenants) {
    const plan = bySlug[t.plan.toLowerCase()];
    if (!plan) continue;
    const target = plan.max_users ?? null;
    if (target != null && t.max_users !== target) {
      const staff = await prisma.user.count({
        where: { tenant_id: t.id, active: true, role: { name: { not: "owner" } } },
      });
      changes.push({ tenant: t, target, staff });
      const capacity = target + (t.addon_users ?? 0);
      if (staff > capacity) overQuota.push({ slug: t.slug, staff, capacity });
    }
  }

  if (changes.length === 0) {
    console.log("\n✔ Semua kuota tenant sudah sesuai paket. Tidak ada yang perlu diubah.\n");
    return;
  }

  console.log(`\n${changes.length} tenant akan diselaraskan` + (APPLY ? ":\n" : "  —  DRY RUN, set APPLY=true untuk eksekusi:\n"));
  for (const c of changes) {
    console.log(
      `  ${c.tenant.slug.padEnd(24)} ${c.tenant.plan.padEnd(9)} max_users ${c.tenant.max_users} → ${c.target}` +
        (c.tenant.addon_users ? ` (+${c.tenant.addon_users} add-on)` : "") +
        `  pegawai aktif: ${c.staff}`,
    );
  }

  if (overQuota.length > 0) {
    console.log(`\n⚠ ${overQuota.length} tenant melampaui kuota baru (tidak diputus, tapi tidak bisa menambah pegawai):`);
    for (const o of overQuota) console.log(`  ${o.slug.padEnd(24)} pegawai ${o.staff} > kapasitas ${o.capacity}`);
  }

  if (!APPLY) {
    console.log("\nTidak ada perubahan. Jalankan ulang dengan APPLY=true bila rencana di atas benar.\n");
    return;
  }

  let done = 0;
  for (const c of changes) {
    await prisma.tenant.update({ where: { id: c.tenant.id }, data: { max_users: c.target } });
    done++;
  }
  console.log(`\n✔ ${done} tenant diselaraskan.\n`);
}

main()
  .catch((err) => {
    console.error("\n✖ Backfill gagal:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
