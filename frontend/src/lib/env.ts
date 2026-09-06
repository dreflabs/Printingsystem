/**
 * Validasi variabel lingkungan saat server booting.
 *
 * Tanpa ini, konfigurasi yang kurang baru ketahuan jauh di dalam aplikasi dan
 * terasa seperti aplikasi rusak, bukan seperti env yang lupa diisi. Contoh
 * nyatanya: `AUDIT_SECRET` kosong membuat `lib/logger.ts` melempar error di
 * produksi, dan karena audit log dipanggil hampir di semua aksi bisnis,
 * gejalanya adalah "semua tombol error" — bukan "ada env yang belum diisi".
 *
 * Yang FATAL menghentikan boot: lebih baik deploy gagal terang-terangan
 * daripada aplikasi hidup dalam kondisi tidak aman atau setengah jalan.
 * Yang PERINGATAN hanya dicatat: fiturnya mati, tapi aplikasi tetap benar.
 */

export type EnvProblem = { level: "fatal" | "warn"; key: string; message: string };

const PLACEHOLDER = /^(ganti|change|replace|xxx|todo|dummy|example)/i;

function blank(v: string | undefined): boolean {
  return !v || v.trim() === "";
}

/**
 * Periksa environment saat ini. Murni — tidak melempar, tidak mencetak, tidak
 * membaca apa pun selain `process.env`, sehingga gampang diuji.
 */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): EnvProblem[] {
  const isProd = env.NODE_ENV === "production";
  const problems: EnvProblem[] = [];

  // ── Selalu wajib ────────────────────────────────────────────────────
  if (blank(env.DATABASE_URL)) {
    problems.push({
      level: "fatal",
      key: "DATABASE_URL",
      message: "belum diisi — aplikasi tidak bisa terhubung ke database.",
    });
  }

  // ── Wajib di produksi ───────────────────────────────────────────────
  if (blank(env.AUTH_SECRET)) {
    problems.push({
      level: isProd ? "fatal" : "warn",
      key: "AUTH_SECRET",
      message: "belum diisi — sesi login tidak bisa ditandatangani. Buat dengan: openssl rand -hex 32",
    });
  } else if (PLACEHOLDER.test(env.AUTH_SECRET!)) {
    problems.push({
      level: isProd ? "fatal" : "warn",
      key: "AUTH_SECRET",
      message: "masih memakai nilai contoh dari .env.example — ganti dengan string acak asli.",
    });
  }

  if (blank(env.AUDIT_SECRET) || env.AUDIT_SECRET === "default_secret") {
    problems.push({
      level: isProd ? "fatal" : "warn",
      key: "AUDIT_SECRET",
      message:
        "belum diisi atau masih 'default_secret' — rantai hash audit tidak sah dan " +
        "hampir semua aksi bisnis akan gagal. Buat dengan: openssl rand -hex 32",
    });
  } else if (PLACEHOLDER.test(env.AUDIT_SECRET!)) {
    problems.push({
      level: isProd ? "fatal" : "warn",
      key: "AUDIT_SECRET",
      message: "masih memakai nilai contoh dari .env.example — ganti dengan string acak asli.",
    });
  }

  // ── Salah konfigurasi yang berbahaya ────────────────────────────────
  // AUTH_BYPASS=1 mematikan SELURUH pemeriksaan login & RBAC di middleware.
  // Itu mode pratinjau UI; kalau lolos ke produksi, semua halaman terbuka.
  if (isProd && env.AUTH_BYPASS === "1") {
    problems.push({
      level: "fatal",
      key: "AUTH_BYPASS",
      message: "bernilai 1 di produksi — seluruh proteksi rute & RBAC mati. Set ke 0.",
    });
  }

  // ── Peringatan: fitur mati, aplikasi tetap benar ─────────────────────
  if (blank(env.JOBS_SECRET) || (env.JOBS_SECRET?.length ?? 0) < 16) {
    problems.push({
      level: "warn",
      key: "JOBS_SECRET",
      message:
        "belum diisi atau kurang dari 16 karakter — endpoint /api/jobs/* menolak semua " +
        "panggilan, jadi notifikasi & alert deadline tidak akan berjalan.",
    });
  }

  if (isProd && (blank(env.APP_URL) || env.APP_URL!.includes("localhost"))) {
    problems.push({
      level: "warn",
      key: "APP_URL",
      message: "belum diisi atau masih localhost — tautan reset password akan salah.",
    });
  }

  return problems;
}

/**
 * Jalankan validasi dan laporkan. Melempar bila ada masalah fatal, sehingga
 * container gagal start alih-alih melayani dalam kondisi rusak.
 */
export function assertEnv(env: NodeJS.ProcessEnv = process.env): void {
  const problems = validateEnv(env);
  if (problems.length === 0) return;

  const fatal = problems.filter((p) => p.level === "fatal");
  const warn = problems.filter((p) => p.level === "warn");

  for (const p of warn) {
    console.warn(`⚠ env ${p.key}: ${p.message}`);
  }

  if (fatal.length === 0) return;

  const detail = fatal.map((p) => `  • ${p.key}: ${p.message}`).join("\n");
  throw new Error(
    `Konfigurasi environment tidak lengkap — server dihentikan.\n\n${detail}\n\n` +
      `Perbaiki di Environment Variables (Coolify) lalu deploy ulang. ` +
      `Daftar lengkapnya ada di frontend/.env.example.`
  );
}
