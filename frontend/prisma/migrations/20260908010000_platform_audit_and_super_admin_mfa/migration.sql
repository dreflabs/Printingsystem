-- Hardening panel Super Admin:
--  1. MFA wajib untuk semua akun — kode 6 digit dikirim ke EMAIL tiap login
--     (kolom login_otp_* di SuperAdmin). Tidak butuh aplikasi authenticator.
--  2. PlatformAuditLog — jejak audit tingkat-platform yang tidak terikat tenant
--     (login, kelola akun Super Admin) + salinan tahan-hapus aksi tenant-scoped
--     supaya tetap terbaca setelah tenant di-purge. FK ON DELETE SET NULL: baris
--     log bertahan walau akun Super Admin pelakunya dihapus (actor_name di-snapshot).

-- AlterTable
ALTER TABLE "SuperAdmin" ADD COLUMN     "login_otp_hash" TEXT,
ADD COLUMN     "login_otp_expires_at" TIMESTAMP(3),
ADD COLUMN     "login_otp_attempts" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PlatformAuditLog" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "actor_sub_level" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "target_label" TEXT,
    "detail_json" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformAuditLog_created_at_idx" ON "PlatformAuditLog"("created_at");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_actor_id_idx" ON "PlatformAuditLog"("actor_id");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_action_idx" ON "PlatformAuditLog"("action");

-- AddForeignKey
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "SuperAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
