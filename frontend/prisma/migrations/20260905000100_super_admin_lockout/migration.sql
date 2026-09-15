-- Tambahkan lockout progresif untuk akun SuperAdmin, sama seperti User biasa.
ALTER TABLE "SuperAdmin" ADD COLUMN "failed_login_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SuperAdmin" ADD COLUMN "locked_until" TIMESTAMP(3);
