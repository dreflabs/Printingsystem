/**
 * Arsipkan tenant basi yang sudah menumpuk SEBELUM job tenant-lifecycle ada.
 *
 *   node prisma/backfill-churn-stale-trials.mjs                 # DRY RUN (lihat saja)
 *   APPLY=true node prisma/backfill-churn-stale-trials.mjs      # benar-benar arsipkan
 *
 * Untuk tiap tenant target: status → CHURNED, `churned_at` diisi, dan slug aktif
 * di-rename jadi "<slug>-retired-<id8>" sehingga nama subdomain-nya langsung
 * bebas dipakai pendaftar baru. TIDAK menghapus baris apa pun — penghapusan
 * permanen dilakukan job `tenant-lifecycle` setelah masa tenggang 30 hari,
 * atau manual dari panel Super Admin.
 *
 * Ditulis .mjs (bukan .ts) supaya bisa `node` langsung di container produksi
 * yang sudah memangkas devDependencies (lihat prisma/bootstrap-superadmin.mjs).
 *
 * Variabel lingkungan:
 *   APPLY=true             wajib untuk eksekusi; tanpa ini hanya menampilkan daftar
 *   GRACE_DAYS=14          ambang "basi": TRIAL yang lewat trial_ends_at sekian hari
 *   INCLUDE_SUSPENDED=true ikut arsipkan SUSPENDED yang tak tersentuh > GRACE_DAYS
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const APPLY = process.env.APPLY === "true";
const GRACE_DAYS = Number(process.env.GRACE_DAYS ?? 14);
const INCLUDE_SUSPENDED = process.env.INCLUDE_SUSPENDED === "true";

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function archivedSlug(slug, id) {
  return `${slug}-retired-${id.slice(0, 8)}`;
}

async function main() {
  if (!Number.isFinite(GRACE_DAYS) || GRACE_DAYS < 0) {
    console.error("\n✖ GRACE_DAYS harus angka >= 0.\n");
    process.exitCode = 1;
    return;
  }

  const cutoff = daysAgo(GRACE_DAYS);
  const or = [{ status: "TRIAL", trial_ends_at: { lt: cutoff } }];
  if (INCLUDE_SUSPENDED) or.push({ status: "SUSPENDED", updated_at: { lt: cutoff } });

  const targets = await prisma.tenant.findMany({
    where: { OR: or, retired_slug: null },
    orderBy: { created_at: "asc" },
  });

  if (targets.length === 0) {
    console.log(`\n✔ Tidak ada tenant basi (ambang ${GRACE_DAYS} hari). Tidak ada yang diarsip.\n`);
    return;
  }

  console.log(
    `\n${targets.length} tenant akan di-CHURNED + slug dilepas` +
      (APPLY ? ":\n" : "  —  DRY RUN, set APPLY=true untuk eksekusi:\n")
  );
  for (const t of targets) {
    console.log(
      `  ${t.status.padEnd(9)} ${t.slug.padEnd(26)} → ${archivedSlug(t.slug, t.id).padEnd(40)} ` +
        `"${t.name}"  (dibuat ${t.created_at.toISOString().slice(0, 10)})`
    );
  }

  if (!APPLY) {
    console.log("\nTidak ada perubahan. Jalankan ulang dengan APPLY=true bila daftar di atas benar.\n");
    return;
  }

  let done = 0;
  for (const t of targets) {
    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: t.id },
        data: {
          status: "CHURNED",
          churned_at: new Date(),
          retired_slug: t.slug,
          slug: archivedSlug(t.slug, t.id),
        },
      });
      await tx.tenantAuditLog.create({
        data: {
          tenant_id: t.id,
          actor_type: "SYSTEM",
          action: "TENANT_CHURNED",
          detail_json: JSON.stringify({
            source: "BACKFILL",
            from_status: t.status,
            released_slug: t.slug,
            archived_slug: archivedSlug(t.slug, t.id),
          }),
        },
      });
    });
    done++;
  }

  console.log(
    `\n✔ ${done} tenant diarsip. Nama subdomain aslinya sekarang bebas dipakai pendaftar baru.\n` +
      `  Penghapusan permanen otomatis oleh job "tenant-lifecycle" setelah 30 hari,\n` +
      `  atau manual dari panel Super Admin (Detail tenant → Zona Berbahaya).\n`
  );
}

main()
  .catch((err) => {
    console.error("\n✖ Backfill gagal:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
