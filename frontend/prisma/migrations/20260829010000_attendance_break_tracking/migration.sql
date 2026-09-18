-- AlterTable: baris absensi bisa dibuat dari tombol istirahat sebelum import fingerprint
ALTER TABLE "AttendanceRecord" ALTER COLUMN "import_id" DROP NOT NULL;
