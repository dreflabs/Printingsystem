# Print Pilot — Frontend

Aplikasi Next.js (App Router) untuk Print Pilot: dashboard tenant per role (Owner/Admin/Designer/Operator/Gudang) dan panel Super Admin (`/platform`) untuk mengelola seluruh tenant SaaS.

Spesifikasi lengkap fitur & aturan bisnis ada di dokumentasi root repo (`../00-PROJECT` s.d. `../13-SAAS`, lihat `../FOLDER-MAP.md`). File ini hanya membahas cara menjalankan & struktur kode.

## Tech Stack

- **Next.js 16** (App Router, Server Actions) + React 19
- **Prisma 5** + PostgreSQL
- **NextAuth v5** (Credentials provider, JWT session) — dua jalur login: user tenant (`users`) dan Super Admin (`super_admins`)
- Tailwind (lihat `STYLE.md` untuk design token)

## Menjalankan Secara Lokal

```bash
npm install
cp .env.example .env        # isi DATABASE_URL, AUTH_SECRET, AUDIT_SECRET, JOBS_SECRET
npx prisma migrate deploy   # terapkan semua migrasi
npx prisma db seed          # buat data contoh + akun Super Admin default (lihat prisma/seed.ts)
npm run dev
```

Buka `http://localhost:3000`. Login tenant contoh dan akun Super Admin dibuat oleh `prisma/seed.ts` — **jangan jalankan seed ini ke database production** (ada guard `NODE_ENV=production` yang akan menolaknya kecuali `ALLOW_PROD_SEED=true` diset eksplisit).

## Struktur Kode

```
src/app/                 Routes (App Router) — grup (auth)/(dashboard) per role, platform/ untuk Super Admin
src/actions/             Server Actions (mutasi/query per domain: orders, platform, design, dst.)
src/lib/                 Auth, resolusi tenant/aktor, rate-limit, notifikasi, dsb.
src/components/          Komponen UI per area (dashboard, platform, orders, shared, ui)
prisma/schema.prisma     Skema database
prisma/migrations/       Migrasi (jalankan lewat `prisma migrate deploy`, bukan `db push`)
prisma/seed.ts           Seed data dev/staging
scripts/                 Skrip bantu one-off (screenshot capture, debug query) — bukan bagian aplikasi
```

## Konsep Kunci

- **Multi-tenant**: tenant diresolusi dari subdomain (`<slug>.printpilot.id`) lewat middleware, lihat `src/lib/tenant.ts`.
- **Super Admin & impersonation**: Super Admin login terpisah di `/platform/login`, bisa "Login sebagai" tenant tertentu (impersonate) untuk investigasi/dukungan. Semua akses lintas-tenant harus lewat `getPlatformActor()` (`src/lib/platform.ts`) yang re-validasi ke DB — jangan pernah percaya klaim `session.user.platform` mentah di jalur baru.
- **Audit trail**: aksi Super Admin (impersonate, ubah plan, suspend) tercatat di `TenantAuditLog`; aksi tenant (order, pembatalan, koreksi) di `AuditLog` dengan rantai hash HMAC (`AUDIT_SECRET`).
- **RBAC**: dicek di `middleware.ts` (per-route berdasar role) dan di server action (`requireUser`/`requireMutableActor` di `src/lib/actor.ts`) untuk otorisasi granular.
