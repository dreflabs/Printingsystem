# TECH STACK

## Platform

**Web Application & PWA** — diakses via browser di desktop maupun mobile. 
Aplikasi akan dikonfigurasi sebagai **Progressive Web App (PWA)** agar memiliki *Offline Mode Cache* (memastikan UI tidak *crash* jika koneksi internet pabrik terputus sesaat).

Untuk scan QR Code: direkomendasikan menggunakan **Barcode Scanner 2D Fisik (Bluetooth/USB)** yang terhubung ke PC/Tablet untuk kecepatan scan maksimal. 
Sebagai cadangan (backup), tersedia fitur scan via **kamera HP/tablet via browser** (Web API `getUserMedia`).

---

## Stack yang Direkomendasikan

| Layer | Teknologi | Alasan |
|-------|-----------|--------|
| **Framework** | Next.js 16 (App Router) + TypeScript | Full-stack, SSR/SSG, Server Actions terbaru, deployment fleksibel |
| **Database** | PostgreSQL | Relasional, ACID compliant, cocok untuk audit trail immutable |
| **ORM** | Prisma | Type-safe, migration management, mudah schema change |
| **Authentication** | NextAuth.js v5 (Auth.js) | RBAC support, session management, server-side validation |
| **QR Generate** | `qrcode` npm | Generate QR di server, deliver sebagai PNG/SVG untuk dicetak |
| **QR Scan** | Hardware Scanner 2D (Primary) / `html5-qrcode` (Backup) | Kecepatan scan fisik jauh lebih cepat, fallback ke kamera HP |
| **Background Jobs** | Inngest / Redis + BullMQ | Untuk antrian pengiriman WhatsApp agar UI tetap responsif (*non-blocking*) |
| **WhatsApp** | Abstraction layer (Fonnte/Wablas/WABA) | Provider dikonfigurasi via env var, dieksekusi via Background Jobs |
| **File Storage** | MinIO (self-hosted) atau Supabase Storage | Untuk file desain dan preview |
| **PDF/Label** | Puppeteer atau `react-pdf` | Generate label QR untuk dicetak di stasiun kerja |
| **Email (fallback)** | Nodemailer + SMTP / Resend | Notifikasi admin jika WhatsApp gagal |
| **Styling** | Tailwind CSS | Utility-first, konsisten, cepat |
| **Realtime (opsional)** | Supabase Realtime atau Server-Sent Events | Untuk dashboard monitoring real-time |

---

## Infrastruktur

| Pilihan | Rekomendasi |
|---------|------------|
| **Hosting** | VPS (DigitalOcean / Vultr / Contabo) — kontrol penuh, harga terjangkau |
| **Database Hosting** | Di VPS yang sama (awal) atau managed PostgreSQL |
| **Domain** | Custom domain dengan HTTPS wajib |
| **Backup** | Cron otomatis `pg_dump` ke object storage setiap hari |

---

## Arsitektur Scan QR (Web-based)

```
User buka halaman scan di browser HP/tablet
  → Klik "Scan QR"
  → Browser minta izin kamera
  → Kamera aktif, real-time QR detection (javascript)
  → QR terdeteksi → kirim ke server API
  → Server validasi Job ID / Location Code
  → Server cek permission user yang login
  → Response: data + aksi yang diizinkan
  → User konfirmasi aksi di UI
  → Server eksekusi + catat audit log
```

Tidak ada data sensitif yang disimpan di browser (localStorage/sessionStorage).
Session menggunakan HTTP-only cookie.

---

## Aturan Implementasi

- Tidak ada hard-code credential di kode sumber
- Semua secret di environment variable (`.env`) yang tidak di-commit ke Git
- Server-side authorization wajib — jangan rely hanya pada hidden button di UI
- API endpoint harus cek session + role sebelum eksekusi apapun
- Tidak ada bypass role via parameter URL

---

## Format Nomor Order & Job

### Order Code
```
Format  : ORD-YYYYMMDD-XXXX
Contoh  : ORD-20260814-0001

- YYYYMMDD : tanggal order dibuat
- XXXX     : urutan order untuk hari tersebut, zero-padded 4 digit
- Reset    : urutan reset ke 0001 setiap hari baru
- Jika > 9999 order per hari: tambah digit (XXXXX)
```

### Job Code (Production Job)
```
Format  : JOB-YYYYMMDD-XXXX
Contoh  : JOB-20260814-0001

- Urutan global (tidak reset per hari, karena Job ID dipakai di QR label fisik)
- Satu Order bisa punya lebih dari satu Job (jika ada rework / item terpisah)
- Rework job: JOB-20260814-0001-R1, JOB-20260814-0001-R2
```

### Customer Code
```
Format  : CST-XXXXX
Contoh  : CST-00001

- Urutan global, tidak reset
- Konsumen lama tetap punya CST yang sama meski order baru
```

### Location Code (Storage)
```
Format  : LT[lantai]-[ZONA]-[RAK]-[SLOT]
Contoh  : LT3-A-01-01, LT1-COUNTER-01
```

---

## Export

- PDF: label QR, surat jalan, laporan order
- XLSX/CSV: laporan keuangan, laporan produksi, data material
- Semua export tercatat di audit log (siapa, kapan, apa)
