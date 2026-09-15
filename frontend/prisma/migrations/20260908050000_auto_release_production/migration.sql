-- Auto-release ke produksi (hapus approval Admin manual).
-- 1. ProductionJob boleh belum punya operator — operator mengklaim job dari antrian sendiri.
ALTER TABLE "ProductionJob" ALTER COLUMN "operator_id" DROP NOT NULL;

-- 2. Produk punya mesin default untuk routing job otomatis saat auto-release.
ALTER TABLE "Product" ADD COLUMN "default_machine_id" TEXT;
ALTER TABLE "Product" ADD CONSTRAINT "Product_default_machine_id_fkey"
  FOREIGN KEY ("default_machine_id") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
