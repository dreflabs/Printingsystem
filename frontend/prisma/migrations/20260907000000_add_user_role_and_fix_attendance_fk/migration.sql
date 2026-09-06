-- Perbaiki drift antara schema.prisma dan migration.
--
-- `model UserRole` (multi-role per user) ada di schema sejak awal, tapi TIDAK
-- pernah dibuat oleh migration mana pun — baseline `0_init` diambil dari
-- database yang sudah punya tabel itu lewat `db push`, sehingga tabelnya tidak
-- ikut tercatat. Akibatnya database yang dibangun murni dari migration (yaitu
-- produksi) tidak punya tabel ini, dan SETIAP login gagal: `authorize()`
-- menyertakan `extra_roles`, jadi query-nya melempar
-- "The table public.UserRole does not exist".
--
-- `prisma migrate status` tidak menangkap ini karena ia hanya membandingkan
-- daftar migration yang sudah dijalankan, bukan isi skema sebenarnya.
--
-- SQL dibuat idempoten supaya aman dijalankan pada database yang sudah terlanjur
-- punya tabelnya (mis. mesin dev yang dulu memakai `db push`).

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserRole" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserRole_user_id_role_id_key" ON "UserRole"("user_id", "role_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- `AttendanceRecord.import_id` sudah dijadikan nullable oleh migration
-- 20260829010000, tapi foreign key-nya tidak ikut diubah. Samakan dengan schema:
-- menghapus satu batch impor tidak boleh ikut menghapus catatan absensinya.
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT IF EXISTS "AttendanceRecord_import_id_fkey";
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_import_id_fkey"
  FOREIGN KEY ("import_id") REFERENCES "AttendanceImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
