-- Model harga jasa cetak: satuan + harga dasar per satuan.
-- base_price NULL = harga tetap diketik manual per order (perilaku lama).
ALTER TABLE "Product" ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'PCS';
ALTER TABLE "Product" ADD COLUMN "base_price" DECIMAL(15,2);
