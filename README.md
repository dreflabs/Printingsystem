# Print Pilot

Sistem manajemen workflow percetakan multi-tenant (SaaS) — dari order masuk, desain & approval, produksi berbasis scan QR, QC, finishing, storage, hingga pickup konsumen, plus panel Super Admin untuk mengelola seluruh tenant.

## Struktur Repo

```
frontend/          Aplikasi Next.js (app tenant + panel Super Admin) — lihat frontend/README.md
00-PROJECT/         Ringkasan proyek & tujuan
01-BUSINESS/        Aturan & masalah bisnis
02-WORKFLOW/        Alur operasional per modul
03-ROLES/           Definisi hak akses per role (tenant & platform)
04-MODULES/         Spesifikasi modul aplikasi
05-DATABASE/        Arsitektur data
06-SECURITY/        Aturan anti-leakage & kontrol akses
07-REPORTS/         Spesifikasi laporan & export
08-UI-UX/           Kebutuhan antarmuka & mockup
09-TECHNICAL/       Aturan implementasi teknis
10-DATA/            Contoh/seed data
11-FUTURE/          Rencana integrasi mendatang
12-IMPLEMENTATION/  Catatan implementasi per lane (frontend/Rere, backend/Drefan)
13-SAAS/            Spesifikasi SaaS: billing, Super Admin, onboarding tenant
```

Lihat [FOLDER-MAP.md](FOLDER-MAP.md) untuk ringkasan satu baris per folder.

Dokumentasi 00–13 adalah spesifikasi sumber kebenaran (source of truth) untuk perilaku sistem. Kode di `frontend/` adalah implementasinya — kalau ada perbedaan, dokumentasi lebih dulu diperbarui lalu kode menyusul, atau sebaliknya bila kode sudah lebih maju, dokumentasi yang perlu disinkronkan.

## Menjalankan Aplikasi

```bash
cd frontend
npm install
cp .env.example .env   # isi DATABASE_URL, AUTH_SECRET, dll.
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Detail lengkap (env vars, akun default, arsitektur) ada di [frontend/README.md](frontend/README.md).

## Tim

- **Backend & DevOps**: Drefan
- **Frontend**: Rere
