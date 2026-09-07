-- Metadata file desain untuk upload langsung ke Cloudflare R2 (src/lib/r2.ts).
-- file_path kini menyimpan key objek R2 untuk upload baru; baris lama tetap
-- berisi link/teks bebas dan ditangani apa adanya oleh route unduh.

ALTER TABLE "DesignVersion" ADD COLUMN "file_name" TEXT;
ALTER TABLE "DesignVersion" ADD COLUMN "file_size" INTEGER;
ALTER TABLE "DesignVersion" ADD COLUMN "content_type" TEXT;
