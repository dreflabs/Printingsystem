-- Hardening panel Super Admin:
--  1. MFA/TOTP wajib untuk semua akun (kolom totp_* + backup codes di SuperAdmin).
--  2. PlatformAuditLog — jejak audit tingkat-platform yang tidak terikat tenant
--     (login, kelola akun Super Admin, MFA) + salinan aksi tenant-scoped supaya
--     tetap terbaca setelah tenant di-purge. FK ON DELETE SET NULL: baris log
--     bertahan walau akun Super Admin pelakunya dihapus (actor_name di-snapshot).

-- AlterTable
ALTER TABLE "SuperAdmin" ADD COLUMN     "mfa_enrolled_at" TIMESTAMP(3),
ADD COLUMN     "totp_backup_codes" TEXT,
ADD COLUMN     "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totp_secret" TEXT;

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

