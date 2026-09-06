/**
 * Bootstrap satu akun Super Admin — aman dijalankan di produksi.
 *
 *   node prisma/bootstrap-superadmin.mjs
 *
 * Berbeda dari `prisma/seed.ts`, script ini TIDAK PERNAH menghapus apa pun.
 * seed.ts menjalankan puluhan deleteMany() lebih dulu, jadi tidak boleh
 * dipakai untuk membuat Super Admin di database yang sudah berisi tenant.
 *
 * Sengaja ditulis .mjs, bukan .ts: container produksi biasanya sudah
 * memangkas devDependencies, sehingga `tsx` tidak tersedia di sana.
 * File ini hanya butuh @prisma/client + bcryptjs yang keduanya dependensi
 * produksi, jadi bisa langsung dijalankan `node` di dalam container.
 *
 * Variabel lingkungan:
 *   SUPER_ADMIN_EMAIL     (wajib)
 *   SUPER_ADMIN_PASSWORD  (wajib saat membuat akun baru)
 *   SUPER_ADMIN_NAME      (opsional, default "Super Admin")
 *   SUPER_ADMIN_RESET_PASSWORD=true
 *       Akun yang sudah ada akan di-reset kata sandinya + dibuka kuncinya.
 *       Tanpa ini, akun yang sudah ada dibiarkan apa adanya.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LEN = 12;

// Kata sandi yang pernah dipakai contoh/seed — jangan sampai lolos ke produksi.
const BANNED_PASSWORDS = new Set([
  "superadmin123",
  "password123",
  "admin123",
  "printpilot123",
]);

const prisma = new PrismaClient();

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exitCode = 1;
}

async function main() {
  const isProd = process.env.NODE_ENV === "production";
  const email = (process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "";
  const name = (process.env.SUPER_ADMIN_NAME ?? "Super Admin").trim();
  const resetPassword = process.env.SUPER_ADMIN_RESET_PASSWORD === "true";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail("SUPER_ADMIN_EMAIL wajib diisi dan harus berupa email yang valid.");
  }

  const existing = await prisma.superAdmin.findUnique({ where: { email } });

  // Akun sudah ada dan tidak diminta reset → tidak melakukan apa-apa.
  if (existing && !resetPassword) {
    console.log(`\n✔ Super Admin "${email}" sudah ada — tidak ada perubahan.`);
    console.log(`  nama   : ${existing.name}`);
    console.log(`  peran  : ${existing.role}`);
    console.log(`  aktif  : ${existing.active ? "ya" : "TIDAK"}`);
    if (existing.locked_until && existing.locked_until > new Date()) {
      console.log(`  status : TERKUNCI sampai ${existing.locked_until.toISOString()}`);
      console.log("\n  Jalankan ulang dengan SUPER_ADMIN_RESET_PASSWORD=true untuk membuka kunci.");
    }
    if (!existing.active) {
      console.log("\n  Akun nonaktif tidak bisa login. Aktifkan lewat panel, atau");
      console.log("  jalankan ulang dengan SUPER_ADMIN_RESET_PASSWORD=true.");
    }
    return;
  }

  // Mulai sini kita akan menulis kata sandi — validasi ketat.
  if (!password) {
    return fail(
      existing
        ? "SUPER_ADMIN_PASSWORD wajib diisi saat SUPER_ADMIN_RESET_PASSWORD=true."
        : "SUPER_ADMIN_PASSWORD wajib diisi untuk membuat akun baru."
    );
  }
  if (password.length < MIN_PASSWORD_LEN) {
    return fail(`SUPER_ADMIN_PASSWORD minimal ${MIN_PASSWORD_LEN} karakter.`);
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return fail("SUPER_ADMIN_PASSWORD harus mengandung huruf dan angka.");
  }
  if (isProd && BANNED_PASSWORDS.has(password.toLowerCase())) {
    return fail("SUPER_ADMIN_PASSWORD memakai kata sandi contoh yang sudah bocor — ganti.");
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  if (existing) {
    await prisma.superAdmin.update({
      where: { email },
      data: {
        password_hash,
        active: true,
        failed_login_count: 0,
        locked_until: null,
      },
    });
    console.log(`\n✔ Kata sandi Super Admin "${email}" direset, kunci dibuka, akun diaktifkan.`);
    console.log("  Nama dan peran tidak diubah.");
    return;
  }

  const created = await prisma.superAdmin.create({
    data: { name, email, password_hash, role: "SUPER_ADMIN", active: true },
  });
  console.log(`\n✔ Super Admin dibuat.`);
  console.log(`  email : ${created.email}`);
  console.log(`  nama  : ${created.name}`);
  console.log(`  peran : ${created.role}`);
  console.log(`\n  Login di /platform/login. Hapus SUPER_ADMIN_PASSWORD dari environment`);
  console.log(`  setelah ini supaya kata sandi tidak tersimpan di konfigurasi deploy.`);
}

main()
  .catch((err) => {
    console.error("\n✖ Bootstrap gagal:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
