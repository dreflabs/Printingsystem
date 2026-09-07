/**
 * TOTP (RFC 6238) + base32, tanpa dependensi eksternal.
 *
 * Dipakai untuk MFA wajib akun Super Admin. Cukup untuk kebutuhan panel internal:
 * HMAC-SHA1, digit 6, periode 30 detik, toleransi ±1 langkah (jam yang meleset).
 * QR dirender di klien dengan `qrcode.react` dari URI `otpauth://` — server hanya
 * menyimpan secret base32 dan memverifikasi kode.
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DIGITS = 6;
const PERIOD = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Secret baru: 20 byte acak (standar), dikodekan base32. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  // counter 53-bit aman lewat pembagian; cukup sampai tahun ~10889.
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const digest = createHmac("sha1", secret).update(buf).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const bin =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return (bin % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/** Verifikasi kode TOTP dengan toleransi ±`window` langkah (default ±1 = ±30 dtk). */
export function verifyTotp(secretB32: string, token: string, window = 1): boolean {
  const code = (token || "").replace(/\D/g, "");
  if (code.length !== DIGITS) return false;
  const secret = base32Decode(secretB32);
  if (secret.length === 0) return false;
  const counter = Math.floor(Date.now() / 1000 / PERIOD);
  for (let i = -window; i <= window; i++) {
    const expected = hotp(secret, counter + i);
    if (expected.length === code.length && timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
      return true;
    }
  }
  return false;
}

/** URI otpauth:// untuk QR / entri manual di authenticator app. */
export function totpUri(secretB32: string, account: string, issuer = "Print Pilot Platform"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secretB32,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** N kode cadangan sekali-pakai, format "xxxx-xxxx" (huruf/angka tanpa yang mirip). */
export function generateBackupCodes(n = 10): string[] {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    let raw = "";
    for (let j = 0; j < 8; j++) raw += alphabet[randomBytes(1)[0]! % alphabet.length];
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}

/** Normalisasi kode cadangan yang diketik user (buang spasi/tanda hubung, uppercase). */
export function normalizeBackupCode(input: string): string {
  return (input || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}
