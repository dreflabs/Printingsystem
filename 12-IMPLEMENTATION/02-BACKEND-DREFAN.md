# 🚀 ROADMAP IMPLEMENTASI BACKEND & DEVOPS (DREFAN)

Dokumen ini adalah panduan kerja **END-TO-END** untuk Drefan. Fokus Anda adalah memastikan integritas data, logika State Machine, pengamanan *route* (RBAC), API, dan skalabilitas sistem menggunakan **Next.js 16, Prisma, PostgreSQL, dan NextAuth v5**.

---

## ⚙️ SPRINT 1: Setup Skema Data & Autentikasi (Minggu 1)
*Tujuan: Membangun fondasi database dan tembok keamanan aplikasi.*

- [ ] **Database Setup & Prisma:**
  - [ ] Inisialisasi PostgreSQL.
  - [ ] Terjemahkan seluruh tabel dari `05-DATABASE/TABLES.md` ke dalam `prisma/schema.prisma`.
  - [ ] Buat skrip `prisma/seed.ts` (masukkan 8 Role, 1 Akun Owner default, dan status pesanan).
  - [ ] Jalankan `npx prisma migrate dev`.
- [ ] **NextAuth & Middleware:**
  - [ ] Setup `src/lib/auth.ts` dengan `CredentialsProvider` (Bcrypt untuk hash password).
  - [ ] *Inject* `role`, `id`, dan `name` ke dalam token JWT dan *Session object*.
  - [ ] Setup `src/middleware.ts` untuk memblokir akses rute (Misal: rute `/operator` akan me- *redirect* user jika yang login adalah Designer).
- [ ] **Utility Backend:**
  - [ ] Siapkan `errorHandler` global untuk menangkap *error* Prisma.
  - [ ] Siapkan *logger* sederhana untuk `audit_logs` agar mudah dipanggil (contoh: `logAction(actorId, action, entity)`).

---

## 💼 SPRINT 2: Order Management & POS Engine (Minggu 2-3)
*Tujuan: Jantung finansial aplikasi. Fungsi pembuatan pesanan baik Cetak maupun Eceran.*

- [ ] **CRUD Master Data:**
  - [ ] Buat *Server Actions* untuk manajemen `customers`, `products`, `materials`, `machines`, dan `retail_products`.
- [ ] **Modul POS (Retail):**
  - [ ] Buat fungsi `processRetailOrder(items, total, paymentInfo)`.
  - [ ] *Transaction block:* Insert `orders`, insert `order_items`, update `retail_products.stock_quantity`, dan catat `retail_stock_movements`.
- [ ] **Modul Order (Printing):**
  - [ ] Buat fungsi `createPrintingOrder()`. Kalkulasi otomatis `dp_required` = 50%.
  - [ ] Buat sistem *Approval* Diskon (Status menggantung jika Admin mengajukan diskon).
- [ ] **Modul Pembayaran:**
  - [ ] Fungsi `addPayment()`. Validasi otomatis: Jika `paid_amount` >= `total`, set status menjadi "Lunas". 

---

## 🎨 SPRINT 3: Modul Desain (Minggu 4)
*Tujuan: Orkestrasi versi desain dan approval.*

- [ ] **Manajemen Desain:**
  - [ ] Saat Order PRINTING dibuat, fungsi backend harus otomatis membuat baris kosong di tabel `design_jobs`.
  - [ ] Fungsi *upload* file desain (`uploadDesignVersion()`). (Sementara simpan *path* file ke folder lokal atau S3 palsu).
  - [ ] Logika *Approval* (Walk-in, Makloon, WhatsApp).
  - [ ] *Trigger:* Jika desain di-ACC, otomatis buatkan antrian ke tabel `production_jobs` dengan status `PRODUCTION_ASSIGNED`.

---

## 🏭 SPRINT 4: Core State Machine & Scan Engine (Minggu 5-6)
*Tujuan: Mesin penggerak utama pesanan pabrik (Aturan Validasi Ketat).*

- [ ] **Logika QR Code:**
  - [ ] Buat API endpoint `/api/scan` yang menerima `job_id` dan `user_id`.
  - [ ] *Router Scan:* Berdasarkan `role` pengguna yang melakukan scan, arahkan *action* apa yang terjadi. (Contoh: Operator scan -> Tampilkan form Produksi. QC scan -> Tampilkan form Checklist).
- [ ] **Transisi Status (State Machine):**
  - [ ] Implementasikan aturan `STATUS-MACHINE.md` secara *hardcoded* di server.
  - [ ] Fungsi `startProduction()`: Set status ke `PRODUCTION_STARTED`.
  - [ ] Fungsi `finishProduction()`: Catat `actual_qty`, `waste`, update stok di `material_movements` (WAJIB).
  - [ ] Fungsi `submitQC()`: Jika FAIL, wajib memicu fungsi `createReworkJob()` yang akan melahirkan baris baru di `production_jobs` dengan *parent_job_id* terisi, agar bisa di-*scan* ulang tanpa merusak log lama. Jika PASS, oper ke `FINISHING`.
  - [ ] Fungsi `finishFinishing()`: Mengubah status ke `FINISHING_COMPLETE`.

---

## 📦 SPRINT 5: Storage & Serah Terima (Minggu 7)
*Tujuan: Manajemen inventori rak dan keamanan pelepasan barang.*

- [ ] **Modul Warehouse:**
  - [ ] Fungsi `assignStorageLocation()` (SCAN 6 & 7): Cek kapasitas rak di Lantai 3. Cegah bentrok (jika lokasi penuh, tolak).
  - [ ] *Trigger:* Begitu masuk rak, ubah status Order ke `READY_FOR_PICKUP`.
  - [ ] **Background Job:** Kirim *event* notifikasi ke *Message Queue* (misal: Inngest/BullMQ) agar pesan WhatsApp dieksekusi di *background* tanpa mem-blok UI staf Gudang.
- [ ] **Modul Serah Terima (Pickup):**
  - [ ] Fungsi `confirmItemAtCounter()` (SCAN 9).
  - [ ] Fungsi `releaseOrder()` (SCAN 10): Validasi keras -> Pastikan pembayaran lunas. Jika tidak, gagalkan eksekusi!

---

## 📈 SPRINT 6: Final Audit, Reports & Corrections (Minggu 8-9)
*Tujuan: Rekapitulasi, laporan, dan keamanan anti-fraud akhir.*

- [ ] **Final Audit Engine:**
  - [ ] Fungsi `submitFinalAudit()` oleh Admin Sales.
  - [ ] Jika hasil GREEN -> ubah status order ke `CLOSED`.
  - [ ] Jika hasil YELLOW/RED -> hold status, kirim ke dashboard Owner.
- [ ] **Laporan Finansial & Operasional:**
  - [ ] Query agregasi kompleks menggunakan Prisma `groupBy` atau raw SQL untuk: Laporan Pemasukan Harian, Kinerja Operator (jumlah waste), dan Laporan Piutang (*Overdue*).
- [ ] **Corrections & Audit Logs:**
  - [ ] Pastikan tidak ada fungsi `DELETE` untuk data transaksi. Semua perubahan pasca-`CLOSED` dimasukkan ke tabel `corrections`.
  - [ ] Buat API Endpoint `/api/audit-logs` (read-only) untuk menarik riwayat sistem.

---

## 🤝 KONTRAK KERJA DENGAN FRONTEND (RERE)

Untuk setiap tugas Anda, langkah kerjanya:
1. Pikirkan struktur tabel dan alur validasinya terlebih dahulu.
2. Buat fungsi `export async function myAction(formData)` (Server Action) atau *Query Getter* (untuk *Server Components*).
3. Buat dan ekspor **TypeScript Interface** di `src/types/` agar Rere tahu bentuk data yang akan ia terima.
4. Beri tahu Rere: *"Re, fungsi `createOrder` sudah siap dipakai. Form milikmu tinggal panggil fungsi ini."*

**Tips:** Gunakan *branch* dengan format `api/[nama-fitur]` atau `backend/[nama-fitur]`. Pastikan setiap *pull request* dites secara mandiri menggunakan `console.log` sebelum diserahkan ke Rere.
