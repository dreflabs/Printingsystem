-- MFA/OTP email untuk login Super Admin dihapus (keputusan pemilik, 2026-09-08).
-- Login sekarang email + password satu langkah; kolom kode OTP tidak dipakai lagi.
ALTER TABLE "SuperAdmin" DROP COLUMN IF EXISTS "login_otp_hash";
ALTER TABLE "SuperAdmin" DROP COLUMN IF EXISTS "login_otp_expires_at";
ALTER TABLE "SuperAdmin" DROP COLUMN IF EXISTS "login_otp_attempts";
