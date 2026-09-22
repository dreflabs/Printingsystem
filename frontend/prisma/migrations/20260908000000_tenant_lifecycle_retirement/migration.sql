-- Siklus hidup tenant: churn (arsip) → purge (hapus permanen).
--
-- Masalah yang diselesaikan: Tenant.slug @unique bersifat GLOBAL dan tidak
-- pernah dilepas. Tenant TRIAL yang ditinggalkan / SUSPENDED lama menyandera
-- nama subdomain-nya selamanya, sehingga pendaftar baru tidak bisa memakainya.
--
-- Solusi: saat tenant "mati", status → CHURNED dan slug aktif di-rename jadi
-- "<slug>-retired-<id8>" (tidak akan cocok dengan regex resolusi subdomain
-- ^[a-z0-9]{3,30}$, jadi otomatis tak bisa diakses). Slug asli disimpan di
-- retired_slug. Setelah masa tenggang, purgeTenant() menghapus seluruh baris
-- tenant dan meninggalkan satu baris "RetiredTenant" sebagai nisan.

-- 1. Kolom siklus hidup pada Tenant.
ALTER TABLE "Tenant" ADD COLUMN "churned_at" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "retired_slug" TEXT;

-- 2. Tabel nisan tenant yang sudah di-purge permanen.
CREATE TABLE "RetiredTenant" (
    "id" TEXT NOT NULL,
    "original_slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "owner_name" TEXT,
    "owner_email" TEXT,
    "status_before" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "churned_at" TIMESTAMP(3) NOT NULL,
    "purged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "churn_reason" TEXT,
    "counts_json" TEXT,
    "files_json" TEXT,

    CONSTRAINT "RetiredTenant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RetiredTenant_original_slug_idx" ON "RetiredTenant"("original_slug");
CREATE INDEX "RetiredTenant_purged_at_idx" ON "RetiredTenant"("purged_at");
