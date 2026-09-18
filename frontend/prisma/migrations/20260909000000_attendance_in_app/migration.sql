-- Absen in-app: pegawai absen langsung di Print Pilot (HP pribadi / kiosk),
-- import CSV fingerprint tetap ada sebagai cadangan. Lihat
-- 02-WORKFLOW/18-ABSENSI-IN-APP.md

-- AlterTable: User — PIN kiosk (opsional)
ALTER TABLE "User" ADD COLUMN "kiosk_pin_hash" TEXT;

-- AlterTable: AttendanceRecord — kolom absen in-app
ALTER TABLE "AttendanceRecord" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "AttendanceRecord" ADD COLUMN "check_in_method" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN "check_out_method" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN "check_out_status" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN "check_in_lat" DOUBLE PRECISION;
ALTER TABLE "AttendanceRecord" ADD COLUMN "check_in_lng" DOUBLE PRECISION;
ALTER TABLE "AttendanceRecord" ADD COLUMN "check_in_accuracy_m" DOUBLE PRECISION;
ALTER TABLE "AttendanceRecord" ADD COLUMN "check_out_lat" DOUBLE PRECISION;
ALTER TABLE "AttendanceRecord" ADD COLUMN "check_out_lng" DOUBLE PRECISION;
ALTER TABLE "AttendanceRecord" ADD COLUMN "check_out_accuracy_m" DOUBLE PRECISION;
ALTER TABLE "AttendanceRecord" ADD COLUMN "check_in_ip" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN "check_out_ip" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN "geo_flag" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttendanceRecord" ADD COLUMN "ip_flag" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttendanceRecord" ADD COLUMN "off_day" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttendanceRecord" ADD COLUMN "device_label" TEXT;

-- Baris lama yang berasal dari import fingerprint ditandai sumbernya.
UPDATE "AttendanceRecord" SET "source" = 'FINGERPRINT_IMPORT' WHERE "import_id" IS NOT NULL;

-- CreateIndex
CREATE INDEX "AttendanceRecord_tenant_id_date_idx" ON "AttendanceRecord"("tenant_id", "date");
CREATE INDEX "AttendanceRecord_user_id_date_idx" ON "AttendanceRecord"("user_id", "date");

-- CreateTable
CREATE TABLE "AttendanceSelfie" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'image/webp',
    "bytes" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceSelfie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceSelfie_tenant_id_created_at_idx" ON "AttendanceSelfie"("tenant_id", "created_at");
CREATE INDEX "AttendanceSelfie_record_id_idx" ON "AttendanceSelfie"("record_id");

-- CreateTable
CREATE TABLE "TenantAttendanceSetting" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "work_start" TEXT NOT NULL DEFAULT '09:00',
    "late_after" TEXT NOT NULL DEFAULT '09:15',
    "work_end" TEXT NOT NULL DEFAULT '17:00',
    "workdays" TEXT NOT NULL DEFAULT '1,2,3,4,5,6',
    "break_max_min" INTEGER NOT NULL DEFAULT 60,
    "earliest_clock_in_min" INTEGER NOT NULL DEFAULT 120,
    "geofence_lat" DOUBLE PRECISION,
    "geofence_lng" DOUBLE PRECISION,
    "geofence_radius_m" INTEGER NOT NULL DEFAULT 150,
    "geofence_mode" TEXT NOT NULL DEFAULT 'FLAG',
    "ip_allowlist" TEXT NOT NULL DEFAULT '',
    "ip_mode" TEXT NOT NULL DEFAULT 'OFF',
    "selfie_required" BOOLEAN NOT NULL DEFAULT true,
    "selfie_retention_days" INTEGER NOT NULL DEFAULT 120,
    "kiosk_enabled" BOOLEAN NOT NULL DEFAULT false,
    "personal_device_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_close_at" TEXT NOT NULL DEFAULT '23:59',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAttendanceSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantAttendanceSetting_tenant_id_key" ON "TenantAttendanceSetting"("tenant_id");

-- CreateTable
CREATE TABLE "KioskDevice" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KioskDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KioskDevice_token_hash_key" ON "KioskDevice"("token_hash");
CREATE INDEX "KioskDevice_tenant_id_idx" ON "KioskDevice"("tenant_id");

-- Backfill: satu baris pengaturan absensi untuk tiap tenant yang sudah ada.
INSERT INTO "TenantAttendanceSetting" ("id", "tenant_id", "updated_at")
SELECT gen_random_uuid(), "id", CURRENT_TIMESTAMP FROM "Tenant"
ON CONFLICT ("tenant_id") DO NOTHING;

-- AddForeignKey
ALTER TABLE "AttendanceSelfie" ADD CONSTRAINT "AttendanceSelfie_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceSelfie" ADD CONSTRAINT "AttendanceSelfie_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantAttendanceSetting" ADD CONSTRAINT "TenantAttendanceSetting_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KioskDevice" ADD CONSTRAINT "KioskDevice_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
