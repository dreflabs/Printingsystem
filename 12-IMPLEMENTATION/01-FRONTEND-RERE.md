# 🚀 ROADMAP IMPLEMENTASI FRONTEND & UI/UX (RERE)

Dokumen ini adalah panduan kerja **END-TO-END** untuk Rere. Semua pengembangan menggunakan **Next.js 14 App Router, Tailwind CSS, dan Lucide Icons**. Fokus Anda adalah merealisasikan mockup dari `08-UI-UX` menjadi kode React yang interaktif, tanpa pusing memikirkan *database query*.

---

## 🎨 SPRINT 1: Design System & Fondasi UI (Minggu 1)
*Tujuan: Membangun blok-blok Lego yang akan dipakai di seluruh aplikasi.*

- [ ] **Setup Tema:** Masukkan *color palette* dari `DESIGN-SYSTEM.md` ke dalam `tailwind.config.ts`.
- [ ] **Komponen UI Dasar (`src/components/ui`):**
  - [ ] `<Button>` (Varian: primary, secondary, outline, danger, ghost | Ukuran: sm, md, lg)
  - [ ] `<Input>`, `<Select>`, `<Textarea>` (Beserta *styling* saat error/fokus)
  - [ ] `<Card>` (Container standar dengan bayangan lembut)
  - [ ] `<StatusPill>` (Badge dinamis yang berubah warna sesuai status: GREEN, YELLOW, RED, GRAY, BLUE)
  - [ ] `<Modal>` (Komponen popup dialog yang *reusable*)
  - [ ] `<Toast>` (Untuk notifikasi sukses/gagal di pojok layar)
- [ ] **Komponen Layout (`src/components/shared`):**
  - [ ] `<Sidebar>` (Dinamis, menampilkan menu berdasarkan `role` user yang sedang login)
  - [ ] `<Header>` (Menampilkan nama user, role, dan tombol Hamburger untuk *mobile view*)

---

## 🔐 SPRINT 2: Autentikasi & Halaman Dasar (Minggu 2)
*Tujuan: Gerbang masuk aplikasi dan halaman "blank" untuk setiap role.*

- [ ] **Halaman Login (`src/app/(auth)/login/page.tsx`):**
  - [ ] Buat form dengan *username* dan *password*.
  - [ ] Tambahkan animasi *loading* saat tombol ditekan.
  - [ ] Tangkap pesan *error* jika login gagal.
- [ ] **Layout Dashboard (`src/app/(dashboard)/layout.tsx`):**
  - [ ] Gabungkan `<Sidebar>` dan `<Header>`.
  - [ ] Buat layout *responsive* (Sidebar tersembunyi di layar kecil).
- [ ] **Halaman Kosong Berdasarkan Role:**
  - [ ] `/admin` (Admin Sales Dashboard)
  - [ ] `/designer` (Designer Sales Dashboard)
  - [ ] `/operator`, `/qc`, `/finishing`, `/warehouse`, `/supervisor`, `/owner`

---

## 🛍️ SPRINT 3: Modul Penjualan & Kasir (Minggu 3-4)
*Tujuan: Membuat antarmuka pemesanan untuk Admin Sales dan Kasir.*

- [ ] **Dashboard Admin Sales (`src/app/(dashboard)/admin/page.tsx`):**
  - [ ] Buat 6 Widget Angka (KPI) di bagian atas.
  - [ ] Buat Panel Prioritas (Order Siap Diambil, Notifikasi Gagal, dll).
  - [ ] Buat Tabel Daftar Order (lengkap dengan *search*, *filter* tanggal & status).
- [ ] **Form Order PRINTING Baru:**
  - [ ] Buat modal/halaman *wizard* multi-step (Pilih Produk -> Isi Spesifikasi -> Hitung DP).
- [ ] **Modul POS/Kasir RETAIL (`src/app/(dashboard)/pos/page.tsx`):**
  - [ ] Buat tampilan ala kasir supermarket (kiri: daftar barang RETAIL, kanan: keranjang belanja).
  - [ ] Hitung total secara *real-time*.
  - [ ] Buat modal "Bayar & Lunas".
- [ ] **Panel Final Audit (Khusus Admin Sales):**
  - [ ] Buat form *checklist* dengan tombol hasil GREEN/YELLOW/RED.

---

## 🎨 SPRINT 4: Modul Desain (Minggu 5)
*Tujuan: Halaman khusus untuk tim desain mengerjakan pesanan.*

- [ ] **Dashboard Designer (`src/app/(dashboard)/designer/page.tsx`):**
  - [ ] Tabel antrian desain (Urut berdasarkan deadline dan status `DESIGNING`).
  - [ ] Form *upload* file desain (dummy upload) dan form URL *preview*.
- [ ] **Alur Approval Desain:**
  - [ ] Buat UI untuk merekam konfirmasi ACC desain (Walk-in, Makloon, WhatsApp).

---

## 🏭 SPRINT 5: Produksi, Finishing & QC (Minggu 6-7)
*Tujuan: UI untuk pekerja di pabrik (Mobile First).*

- [ ] **Dashboard Operator & Finishing:**
  - [ ] UI berupa antrian pekerjaan yang besar dan mudah diklik (*Mobile/Tablet Friendly*).
  - [ ] Form Selesai Produksi (Input jumlah berhasil dan jumlah *waste*).
- [ ] **Dashboard QC (`src/app/(dashboard)/qc/page.tsx`):**
  - [ ] Buat form *checklist* inspeksi (Ukuran, Warna, Material).
  - [ ] Tombol raksasa **PASS** (Hijau) dan **FAIL** (Merah).
- [ ] **Fitur QR Code Scanner:**
  - [ ] Halaman khusus scanner: `/scan`
  - [ ] Integrasikan library (seperti `html5-qrcode`) agar kamera HP menyala langsung di *browser*.
  - [ ] Tampilkan detail *job* yang baru di-scan secara elegan (seperti nota digital).

---

## 📦 SPRINT 6: Gudang & Serah Terima (Minggu 8)
*Tujuan: Pengecekan stok dan penyerahan ke konsumen.*

- [ ] **Dashboard Warehouse (`src/app/(dashboard)/warehouse/page.tsx`):**
  - [ ] Tabel rak penyimpanan Lantai 3.
  - [ ] Alur SCAN 6 & 7 (Simpan barang ke rak).
  - [ ] Alur SCAN 9 (Konfirmasi barang turun ke counter).
- [ ] **Fitur Pickup / Serah Terima (SCAN 8 & 10):**
  - [ ] Form verifikasi pembayaran konsumen yang datang.
  - [ ] Layar peringatan jika status pembayaran masih "Belum Lunas".

---

## 📈 SPRINT 7: Laporan & Manajemen Data (Minggu 9-10)
*Tujuan: Kebutuhan Supervisor dan Owner.*

- [ ] **Dashboard Owner & Supervisor:**
  - [ ] Buat *Chart* (grafik) sederhana omset bulanan (opsional, gunakan `recharts`).
  - [ ] Tabel persetujuan diskon dan pembatalan order (Tombol Approve/Reject).
- [ ] **Laporan:**
  - [ ] Tabel Laporan Keuangan Harian/Bulanan.
  - [ ] Tabel Laporan Kinerja Operator/Mesin.
  - [ ] Tampilan halaman *Audit Log* (read-only).
- [ ] **Master Data Management:**
  - [ ] Halaman CRUD sederhana untuk mengelola Produk, Mesin, dan Bahan (Material).

---

## 🤝 KONTRAK KERJA DENGAN BACKEND (DREFAN)

Untuk setiap poin di atas, langkah kerja Anda:
1. Buat UI menggunakan **data palsu (dummy JSON)** terlebih dahulu. 
2. Fokus pada estetika, *state* lokal (buka/tutup modal), dan *responsiveness*.
3. Setelah UI jadi, tanya ke Drefan: *"Fungsi `action` apa yang harus dipanggil saat form ini di-submit?"* atau *"Props apa yang akan dilempar dari Server Component untuk tabel ini?"*
4. Ganti data palsu Anda dengan data asli dari Drefan.

**Tips:** Gunakan *branch* dengan format `ui/[nama-fitur]` (Contoh: `ui/pos-kasir`). Jangan koding di `main`.
