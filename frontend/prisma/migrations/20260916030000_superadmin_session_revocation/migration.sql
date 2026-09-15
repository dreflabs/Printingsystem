-- Menyimpan waktu perubahan password untuk mencabut JWT platform lama.
ALTER TABLE "SuperAdmin"
ADD COLUMN "password_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
