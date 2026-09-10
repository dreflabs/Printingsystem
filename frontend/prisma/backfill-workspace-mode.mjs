/**
 * Setel `Tenant.workspace_mode` untuk tenant yang dibuat SEBELUM kolom ini ada.
 *
 *   node prisma/backfill-workspace-mode.mjs                 # DRY RUN (lihat saja)
 *   APPLY=true node prisma/backfill-workspace-mode.mjs      # benar-benar setel
 *
 * Migrasi memberi semua tenant default 'SOLO'. Skrip ini menaikkan tenant yang
 * sudah punya staf ke TEAM_SMALL / TEAM_FULL berdasarkan jumlah pegawai aktif
 * (user aktif yang peran UTAMA-nya bukan "owner"):
 *
 *   0 pegawai        → SOLO       (tetap, tidak disentuh)
 *   1–4 pegawai      → TEAM_SMALL
 *   >= 5 pegawai     → TEAM_FULL
 *
 * Idempoten: hanya meng-update tenant yang workspace_mode-nya masih 'SOLO'
 * padahal hasil hitung > SOLO. Tenant yang sudah benar dibiarkan.
 * TIDAK mengubah izin / Role apa pun — murni kolom tampilan.
 *
 * Ditulis .mjs supaya bisa `node` langsung di container produksi yang sudah
 * memangkas devDependencies (lihat prisma/bootstrap-superadmin.mjs).
 *
 * Variabel lingkungan:
 *   APPLY=true          wajib untuk eksekusi; tanpa ini hanya menampilkan rencana
 *   SMALL_MAX=4         batas atas jumlah pegawai untuk TEAM_SMALL (di atas ini TEAM_FULL)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const APPLY = process.env.APPLY === "true";
const SMALL_MAX = Number(process.env.SMALL_MAX ?? 4);

function modeForStaff(n) {
  if (n <= 0) return "SOLO";
  if (n <= SMALL_MAX) return "TEAM_SMALL";
  return "TEAM_FULL";
}

async function main() {
  if (!Number.isFinite(SMALL_MAX) || SMALL_MAX < 1) {
    console.error("\n✖ SMALL_MAX harus angka >= 1.\n");
    process.exitCode = 1;
    return;
  }

  const tenants = await prisma.tenant.findMany({
    orderBy: { created_at: "asc" },
    select: { id: true, slug: true, name: true, workspace_mode: true },
  });

  const plan = [];
  for (const t of tenants) {
    const staff = await prisma.user.count({
      where: { tenant_id: t.id, active: true, role: { name: { not: "owner" } } },
    });
    const target = modeForStaff(staff);
    // Hanya naikkan dari SOLO. Jangan turunkan mode yang sudah disetel manual.
    if (t.workspace_mode === "SOLO" && target !== "SOLO") {
      plan.push({ t, staff, target });
    }
  }

  if (plan.length === 0) {
    console.log("\n✔ Tidak ada tenant yang perlu dinaikkan. Semua sudah sesuai.\n");
    return;
  }

  console.log(
    `\n${plan.length} tenant akan dinaikkan dari SOLO` +
      (APPLY ? ":\n" : "  —  DRY RUN, set APPLY=true untuk eksekusi:\n")
  );
  for (const { t, staff, target } of plan) {
    console.log(`  ${t.slug.padEnd(28)} ${String(staff).padStart(2)} pegawai  →  ${target.padEnd(10)} "${t.name}"`);
  }

  if (!APPLY) {
    console.log("\nTidak ada perubahan. Jalankan ulang dengan APPLY=true bila rencana di atas benar.\n");
    return;
  }

  let done = 0;
  for (const { t, target } of plan) {
    await prisma.tenant.update({ where: { id: t.id }, data: { workspace_mode: target } });
    done++;
  }
  console.log(`\n✔ ${done} tenant diperbarui. Kolom tampilan saja — izin/Role tidak berubah.\n`);
}

main()
  .catch((err) => {
    console.error("\n✖ Backfill gagal:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
