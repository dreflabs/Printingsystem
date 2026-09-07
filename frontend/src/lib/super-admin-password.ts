/**
 * Aturan kata sandi akun Super Admin. Sengaja lebih ketat dari user tenant —
 * akun ini menjangkau seluruh tenant.
 *
 * Aturan yang sama diduplikasi di `prisma/bootstrap-superadmin.mjs`
 * (file .mjs tidak bisa meng-import modul .ts). Ubah keduanya bila berubah.
 */

export const MIN_SUPER_ADMIN_PASSWORD_LEN = 12;

/** Kata sandi contoh/seed yang pernah bocor — tidak boleh dipakai di produksi. */
export const BANNED_SUPER_ADMIN_PASSWORDS = new Set([
  "superadmin123",
  "password123",
  "admin123",
  "printpilot123",
]);

/** Kembalikan pesan error (string) bila tidak valid, atau null bila lolos. */
export function validateSuperAdminPassword(pw: string): string | null {
  if (!pw || pw.length < MIN_SUPER_ADMIN_PASSWORD_LEN) {
    return `Kata sandi minimal ${MIN_SUPER_ADMIN_PASSWORD_LEN} karakter.`;
  }
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    return "Kata sandi harus mengandung huruf dan angka.";
  }
  if (process.env.NODE_ENV === "production" && BANNED_SUPER_ADMIN_PASSWORDS.has(pw.toLowerCase())) {
    return "Kata sandi ini termasuk contoh yang sudah bocor — ganti.";
  }
  return null;
}
