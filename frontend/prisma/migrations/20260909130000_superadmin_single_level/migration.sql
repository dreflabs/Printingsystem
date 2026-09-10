-- Sub-level Super Admin dinonaktifkan — semua akun jadi satu level (akses penuh).
-- Kolom `role` dibiarkan (getPlatformActor selalu memperlakukan sebagai
-- SUPER_ADMIN), tapi baris lama SUPPORT/FINANCE dinaikkan agar data konsisten.
UPDATE "SuperAdmin" SET "role" = 'SUPER_ADMIN' WHERE "role" <> 'SUPER_ADMIN';
