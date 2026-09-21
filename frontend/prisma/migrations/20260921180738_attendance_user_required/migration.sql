-- Absensi wajib terikat ke satu user: unique (tenant_id, user_id, attendance_day)
-- hanya benar-benar menjaga "satu baris per pegawai per hari" bila user_id
-- terisi (di Postgres, NULL tidak saling bentrok).
--
-- Guard: hentikan migrasi dengan pesan jelas bila masih ada baris tanpa user_id
-- supaya direkonsiliasi manual dulu (data absensi tidak boleh dihapus diam-diam).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "AttendanceRecord" WHERE "user_id" IS NULL) THEN
    RAISE EXCEPTION 'Ada AttendanceRecord tanpa user_id. Rekonsiliasi baris tersebut (cocokkan ke User) sebelum menjalankan migrasi attendance_user_required.';
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT "AttendanceRecord_user_id_fkey";

-- AlterTable
ALTER TABLE "AttendanceRecord" ALTER COLUMN "user_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
