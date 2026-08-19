# IMPLEMENTASI BACKEND & DEVOPS (DREFAN)

Dokumen ini merinci tugas dan arsitektur untuk pengembangan sisi **Backend, Database, dan Server** dari aplikasi PrintFlow. Seluruh logika akan berjalan menggunakan pola **Server-First** di Next.js 14 App Router, dengan Prisma sebagai ORM utama.

---

## ⚙️ Teritori Kerja (Folder)
Sebagai spesialis Backend dan DevOps, fokus kerja Anda berada pada folder berikut:
- `prisma/` (Skema database dan migrasi)
- `src/lib/` (Konfigurasi Prisma Client dan NextAuth)
- `src/server/` (Logika mutasi data `actions` dan pengambilan data `queries`)
- `src/app/api/` (Hanya jika perlu mengekspos endpoint REST publik/eksternal)

---

## 📍 Tahap 1: Setup Skema & Keamanan (Sprint 1)
Fondasi data dan keamanan adalah tanggung jawab utama.
1. **Prisma Schema (`prisma/schema.prisma`):**
   - Transkripsikan semua spesifikasi dari `05-DATABASE/TABLES.md` menjadi model Prisma.
   - Atur relasi Foreign Key, index komposit, dan hapus kolom-kolom untuk tipe RETAIL (ubah `deadline` menjadi opsional/nullable).
   - Buat *seeder* awal untuk memastikan role "Owner" dan data material dasar tersedia saat *deploy*.
2. **Konfigurasi NextAuth v5 (`src/lib/auth.ts`):**
   - Implementasikan *CredentialsProvider* untuk memvalidasi *hash password* ke tabel `users`.
   - Modifikasi *callback* JWT dan Session agar informasi `role_id` tersimpan dan dapat dibaca di semua halaman.
3. **Middleware RBAC (`src/middleware.ts`):**
   - Validasi akses rute berdasarkan matriks pada `06-SECURITY/ACCESS-CONTROL.md`.
   - Cegah staf masuk ke halaman yang bukan porsinya sebelum merender UI.

---

## 📍 Tahap 2: Logika Mutasi & Data Flow (Sprint 2-3)
Rere akan membuat form-nya, Anda yang akan memproses isinya (Server Actions).
1. **Modul Transaksi (Order & POS):**
   - Buat fungsi mutasi seperti `createOrderAction()` yang memastikan order tercatat sekaligus memvalidasi *down payment* (DP).
   - Buat `processRetailTransaction()` yang bertanggung jawab mengurangi stok pada tabel `retail_stock_movements`.
2. **Modul State Machine & Scan:**
   - Implementasikan logika pergeseran status pesanan dari `STATUS-MACHINE.md`. Contoh: `READY_FOR_PICKUP` tidak bisa dilakukan sebelum `FINISHING_COMPLETE`.
   - Pastikan setiap perpindahan status juga menambahkan entri ke tabel `audit_logs`.
3. **Final Audit & Laporan:**
   - Buat fungsi *aggregate query* untuk menyajikan data metrik Laporan Keuangan Harian/Bulanan secara cepat tanpa membebani *client*.

---

## 🔗 Cara Menghubungkan Backend ke UI Rere
1. **Tipe Data Bersama:** Definisikan *interfaces* TypeScript dengan jelas di folder `src/types/` agar Rere tahu tipe data apa saja yang akan masuk ke komponennya.
2. **Pembuatan Action:** Ekspor fungsi *Server Action* dengan menambahkan direktif `"use server"` di bagian paling atas.
3. **Keamanan:** Ingat, selalu lakukan pengecekan otorisasi (`auth()`) *di dalam* setiap fungsi Server Action sebelum melakukan query `prisma.insert`, karena fungsi ini bisa di-*trigger* kapan saja.

*Git Workflow:* Selalu gunakan penamaan *branch* dengan awalan `api/` atau `backend/` (contoh: `api/prisma-setup`) agar kode Anda tidak bertabrakan dengan Rere.
