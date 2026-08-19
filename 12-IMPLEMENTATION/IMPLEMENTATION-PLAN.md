# 12 - IMPLEMENTATION PLAN (RERE & DREFAN)

Dokumen ini adalah cetak biru teknis (technical blueprint) yang merinci langkah-langkah implementasi aplikasi PrintFlow. Pembagian kerja antara **Frontend (Rere)** dan **Backend (Drefan)** dipetakan dengan jelas pada arsitektur Next.js 14 App Router.

## Arsitektur Aplikasi (Next.js 14 App Router)

Aplikasi akan menggunakan pola **Server-First** untuk keamanan dan performa:
- Akses ke database (Prisma) HANYA terjadi di Server Components dan Route Handlers.
- State UI (interaktivitas pengguna) akan diisolasi pada Client Components (`"use client"`).

### Struktur Folder Rekomendasi (`src/`)

```text
src/
├── app/
│   ├── (auth)/                # [Rere] Halaman Login UI
│   ├── (dashboard)/           # [Rere] Layout utama (Sidebar, Header)
│   │   ├── admin/             # Halaman Admin Sales
│   │   ├── operator/          # Halaman Operator
│   │   └── ...
│   ├── api/                   # [Drefan] REST endpoints untuk eksternal/integrasi
│   ├── layout.tsx             # Root layout (Provider NextAuth, Theme)
│   └── page.tsx               # Redirect otomatis ke dashboard sesuai role
├── components/                # [Rere] Reusable UI (DESIGN-SYSTEM.md)
│   ├── ui/                    # Base components (Button, Input, Badge/StatusPill)
│   ├── forms/                 # Form kompleks (Form Order Baru)
│   └── shared/                # Layout komponen (Sidebar, Navbar)
├── lib/                       # [Drefan] Konfigurasi Server
│   ├── prisma.ts              # Prisma client singleton
│   ├── auth.ts                # Konfigurasi NextAuth v5 & RBAC Validator
│   └── utils.ts               # Helper functions (Tailwind merge, format uang)
├── server/                    # [Drefan] Server Actions (Mutasi Data)
│   ├── actions/               # Fungsi untuk Form Submit (createOrder, dll)
│   └── queries/               # Fungsi pengambilan data (getOrders, getStock)
└── types/                     # [Drefan & Rere] TypeScript interfaces
```

---

## Tahap 1: Setup Fondasi (Sprint 1)

### Tugas Backend & DevOps (Drefan)
1. **Inisialisasi Project:** Menjalankan `create-next-app`, install `prisma`, `next-auth`, dan setup environment variables (`.env`).
2. **Database Schema:** 
   - Konversi `05-DATABASE/TABLES.md` menjadi `prisma/schema.prisma`.
   - Membuat *seeder* (`prisma/seed.ts`) untuk memasukkan akun Owner default dan data master dummy (kategori bahan).
3. **Autentikasi (NextAuth):** 
   - Implementasi Credentials Provider (Username/Password).
   - Memasukkan `role` ke dalam JWT token agar bisa dibaca di middleware.
4. **Middleware RBAC:** 
   - Melindungi rute `/(dashboard)/*` berdasarkan otorisasi di `ACCESS-CONTROL.md`. (Contoh: `/admin` hanya bisa diakses `admin_sales` & `owner`).

### Tugas Frontend & UI/UX (Rere)
1. **Konfigurasi Tema:** 
   - Setup `tailwind.config.ts` dan CSS variables sesuai warna di `08-UI-UX/DESIGN-SYSTEM.md`.
2. **Komponen Dasar (UI Library):** 
   - Membuat komponen inti: `<Button>`, `<Input>`, `<Card>`, dan `<StatusPill>` (dengan varian warna sesuai status: GREEN, YELLOW, RED, GRAY, BLUE).
3. **Layouting Utama:** 
   - Membuat komponen `<Sidebar>` dinamis yang menu-nya berubah tergantung `session.user.role`.
   - Membuat halaman Login statis (mockup).

---

## Tahap 2: Implementasi Modul Utama (Sprint 2-3)

### Modul Order & Kasir POS (Fokus Pertama)
*Karena Admin Sales memegang peranan penting di awal (Order Baru & POS).*

**Drefan (Backend):**
- Membuat `server/queries/orders.ts` untuk mem-fetch daftar order dengan filter.
- Membuat Server Action `createOrderAction()` yang meng-handle transaksi insert order dan order_items.
- Membuat Server Action `processRetailPayment()` yang memotong stok di tabel `retail_products` dan insert ke `retail_stock_movements`.

**Rere (Frontend):**
- Merakit `app/(dashboard)/admin/page.tsx` sesuai mockup `ADMIN-DASHBOARD.md`.
- Membuat form modal "Tambah Order Baru" dan halaman Kasir POS (`POS-DASHBOARD.md`).
- Menggabungkan UI dengan fungsi Server Actions yang sudah disiapkan Drefan.

### Modul Produksi & QR Scan (Fokus Kedua)
*Modul krusial untuk Operator dan QC.*

**Drefan (Backend):**
- Setup endpoint API untuk QR Generator.
- Membuat logika perpindahan State Machine (validasi perpindahan status di server).

**Rere (Frontend):**
- Mendesain UI khusus mobile/tablet untuk halaman `/scan/job/[id]`.
- Membuat UI Scanner QR Code di browser (bisa menggunakan library HTML5 QR Code).
- Menyiapkan halaman Operator Dashboard dengan tombol besar (Mulai Produksi / Selesai Produksi).

---

## Tahap 3: Laporan & Final Audit (Sprint 4)

- **Drefan:** Menulis agregasi query SQL/Prisma rumit untuk Laporan Keuangan Harian & Bulanan, mengeksposnya via fungsi getReports().
- **Rere:** Menampilkan data dalam bentuk Tabel Data Grid (dengan fitur ekspor jika memungkinkan), dan membuat form checklist Final Audit untuk Admin Sales.

---

## Cara Rere & Drefan Berkomunikasi Secara Kode

1. **Pengambilan Data (GET):** Drefan menulis fungsi di `server/queries/` yang dipanggil langsung oleh *Server Component* milik Rere. Data mentah di-*passing* sebagai *props* ke *Client Component*.
2. **Mutasi Data (POST/PUT/DELETE):** Rere memanggil fungsi *Server Action* bawaan Next.js yang dibuat oleh Drefan di dalam `<form action={drefanAction}>` atau melalui event `onClick`.
3. **Branching Git:** Rere bekerja pada branch awalan `ui/` atau `frontend/`, sementara Drefan bekerja pada branch `api/` atau `backend/`. Keduanya berpatokan pada kontrak data yang ada di `API.md`.
