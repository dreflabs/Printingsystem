-- Diskon default pelanggan: dari NOMINAL Rp → PERSENTASE (%).
-- Rate tetap ("pelanggan ini selalu dapat X%") lebih masuk akal untuk diskon
-- standing lintas order beda ukuran, dan konsisten dengan dp_override_pct.
-- Nilai Rp lama TIDAK bisa dikonversi otomatis (butuh konteks nilai order) —
-- kolom lama dibuang, Owner isi ulang % per pelanggan.
ALTER TABLE "Customer" DROP COLUMN "default_discount";
ALTER TABLE "Customer" ADD COLUMN "default_discount_pct" DECIMAL(5,2);
