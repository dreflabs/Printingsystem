/**
 * Password sementara acak untuk pegawai baru / reset password oleh Owner.
 *
 * Menggantikan konstanta lama `printpilot123!` yang identik untuk semua pegawai
 * di semua tenant — siapa pun yang pernah melihat UI bisa masuk ke akun baru
 * mana pun selama jendela sebelum login pertama.
 *
 * Sifat:
 *  - alfabet tanpa karakter ambigu (tanpa 0/O/1/l/I) supaya enak didikte lisan
 *  - dijamin mengandung minimal 1 huruf + 1 angka → lolos semua validasi hilir
 *  - selalu diikuti alur ganti-sandi paksa (`must_change_password = true`)
 */

import { randomInt } from "crypto";

const LETTERS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"; // tanpa l, I, O
const DIGITS = "23456789"; // tanpa 0, 1
const ALL = LETTERS + DIGITS;

/** Panjang default 12; tampil sebagai 3 blok "xxxx-xxxx-xxxx" agar mudah disalin/diketik. */
export function generateTempPassword(len = 12): string {
  const chars: string[] = [
    LETTERS[randomInt(LETTERS.length)]!,
    DIGITS[randomInt(DIGITS.length)]!,
  ];
  while (chars.length < len) chars.push(ALL[randomInt(ALL.length)]!);
  // Acak posisi supaya huruf & angka wajib tidak selalu di depan.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  const raw = chars.join("");
  return raw.replace(/(.{4})(?=.)/g, "$1-");
}
