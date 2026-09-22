/**
 * Selaraskan periode langganan tenant ACTIVE dengan data yang sudah ada.
 *
 *   node prisma/backfill-subscription-periods.mjs                 # DRY RUN
 *   APPLY=true node prisma/backfill-subscription-periods.mjs      # eksekusi
 *
 * Kenapa perlu: `Tenant.current_period_start/end` dan `TenantSubscription.ends_at`
 * sering kosong atau basi (sisa era trial) pada tenant yang statusnya ACTIVE.
 * Akibatnya MRR & analitik memakai jendela langganan yang salah.
 *
 * Sumber kebenaran yang dipakai (tidak mengarang tanggal):
 *   1. Invoice PAID terakhir yang punya `period_start`/`period_end` → pakai itu.
 *   2. Bila belum ada invoice lunas → `subscription.started_at` + `term_months`.
 *
 * Tidak memperpanjang masa langganan secara gratis: tenant yang periode
 * hasilnya sudah lewat tetap ditandai di laporan untuk ditindaklanjuti tim.
 *
 * Idempoten: hanya menulis bila nilainya berbeda.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.env.APPLY === "true";

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + Math.max(1, months));
  return d;
}

const sameDay = (a, b) =>
  a && b && new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, slug: true, current_period_start: true, current_period_end: true },
    orderBy: { created_at: "asc" },
  });

  const changes = [];
  const overdue = [];

  for (const t of tenants) {
    const sub = await prisma.tenantSubscription.findFirst({
      where: { tenant_id: t.id, status: "ACTIVE" },
      orderBy: { started_at: "desc" },
      select: { id: true, started_at: true, ends_at: true, term_months: true },
    });
    if (!sub) continue;

    const paid = await prisma.invoice.findFirst({
      where: { tenant_id: t.id, status: "PAID", period_start: { not: null }, period_end: { not: null } },
      orderBy: { period_end: "desc" },
      select: { period_start: true, period_end: true, invoice_number: true },
    });

    const periodStart = paid?.period_start ?? sub.started_at;
    const periodEnd = paid?.period_end ?? addMonths(sub.started_at, sub.term_months ?? 1);
    const source = paid ? `invoice ${paid.invoice_number}` : "started_at + termin";

    const tenantNeeds = !sameDay(t.current_period_start, periodStart) || !sameDay(t.current_period_end, periodEnd);
    const subNeeds = !sameDay(sub.ends_at, periodEnd);
    if (!tenantNeeds && !subNeeds) continue;

    changes.push({ tenant: t, subId: sub.id, periodStart, periodEnd, source, tenantNeeds, subNeeds });
    if (periodEnd.getTime() < Date.now()) {
      overdue.push({ slug: t.slug, periodEnd });
    }
  }

  if (changes.length === 0) {
    console.log("\n✔ Semua periode langganan sudah selaras. Tidak ada yang perlu diubah.\n");
    return;
  }

  console.log(`\n${changes.length} tenant akan diselaraskan` + (APPLY ? ":\n" : "  —  DRY RUN, set APPLY=true untuk eksekusi:\n"));
  for (const c of changes) {
    console.log(
      `  ${c.tenant.slug.padEnd(24)} ${c.periodStart.toISOString().slice(0, 10)} → ${c.periodEnd.toISOString().slice(0, 10)}` +
        `  (sumber: ${c.source})`,
    );
  }

  if (overdue.length > 0) {
    console.log(`\n⚠ ${overdue.length} tenant ACTIVE dengan periode sudah lewat (perlu tindak lanjut komersial):`);
    for (const o of overdue) console.log(`  ${o.slug.padEnd(24)} berakhir ${o.periodEnd.toISOString().slice(0, 10)}`);
  }

  if (!APPLY) {
    console.log("\nTidak ada perubahan. Jalankan ulang dengan APPLY=true bila rencana di atas benar.\n");
    return;
  }

  let done = 0;
  for (const c of changes) {
    await prisma.$transaction(async (tx) => {
      if (c.tenantNeeds) {
        await tx.tenant.update({
          where: { id: c.tenant.id },
          data: { current_period_start: c.periodStart, current_period_end: c.periodEnd },
        });
      }
      if (c.subNeeds) {
        await tx.tenantSubscription.update({ where: { id: c.subId }, data: { ends_at: c.periodEnd } });
      }
    });
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
