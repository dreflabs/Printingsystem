/**
 * Kode OTP login Super Admin — 6 digit dikirim ke email tiap login (MFA wajib,
 * tanpa aplikasi authenticator).
 *
 * Alur: `/platform/login` → step 1 (`requestPlatformLoginOtp`) verifikasi
 * password lalu email-kan kode → step 2 kirim email+password+kode ke
 * CredentialsProvider yang memverifikasi kode di sini.
 *
 * Keamanan kode 6 digit (ruang cuma 1 juta) bertumpu pada: masa berlaku pendek,
 * batas percobaan salah, dan rate-limit permintaan kode — bukan kekuatan hash.
 */

import { createHash, randomInt, timingSafeEqual } from "crypto";

export const OTP_TTL_MS = 10 * 60 * 1000; // kode berlaku 10 menit
export const OTP_MAX_ATTEMPTS = 5; // salah 5x → kode dibatalkan, minta baru
export const OTP_REQUESTS_PER_WINDOW = 5; // maks. permintaan kode
export const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export function verifyOtpHash(code: string, hash: string | null): boolean {
  if (!hash) return false;
  const a = Buffer.from(hashOtp(code), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
