# API

Dokumen ini mendefinisikan kontrak API level perencanaan untuk sistem manajemen percetakan. Tujuannya: cukup detail agar tim backend bisa mulai implementasi (Next.js 16 App Router — Route Handlers di `app/api/**/route.ts`, atau typed Server Actions) tanpa banyak pertanyaan susulan. Field-level detail (semua kolom request/response) tidak dicakup di sini — lihat `05-DATABASE/TABLES.md` untuk skema lengkap.

Semua endpoint di bawah adalah REST-style HTTP. Implementasi boleh memakai Server Actions untuk mutation yang dipicu dari form UI, selama kontrak otorisasi & error yang sama tetap berlaku.

---

## Pola Autentikasi & Sesi

- Autentikasi memakai **NextAuth.js v5 (Auth.js)** dengan credentials provider (username + password).
- Setelah login berhasil, sesi disimpan sebagai **HTTP-only, Secure, SameSite=Strict cookie** — bukan token yang disimpan di localStorage/sessionStorage (lihat `06-SECURITY/DATA-PROTECTION.md`).
- Session expiry: 8 jam (satu shift kerja). Setiap request ke API route membaca sesi dari cookie via `auth()` (server-side helper NextAuth v5), bukan dari header yang dikirim manual oleh client.
- Tidak ada API key/token terpisah untuk klien web internal. Jika suatu saat dibutuhkan integrasi eksternal (mis. webhook WhatsApp provider), endpoint tersebut memakai shared-secret khusus di luar mekanisme sesi ini (lihat `04-MODULES/WHATSAPP-NOTIFICATION.md`).

### Otorisasi per-Role (Server-Side, Wajib)

- Setiap route handler **wajib** memvalidasi sesi (`auth()` tidak null) di baris pertama sebelum logika apapun.
- Setelah sesi valid, route handler memvalidasi `session.user.role` terhadap daftar role yang diizinkan untuk endpoint tersebut (lihat matriks RBAC di `06-SECURITY/ACCESS-CONTROL.md`).
- Otorisasi **tidak pernah** hanya diterapkan di UI (tombol hidden). Jika role tidak berwenang, server mengembalikan `403 Forbidden` — bahkan jika request datang dari luar UI (curl, script, browser devtools).
- Untuk endpoint yang mengembalikan field sensitif (mis. `customers.phone`, `customers.email`), server memakai serializer berbasis role: field tersebut dihapus dari response JSON sebelum dikirim (bukan cuma disamarkan di frontend). Setiap akses ke field ini oleh role yang berwenang (`admin`, `owner`) dicatat ke `audit_logs` (`action=VIEW_CUSTOMER_CONTACT`).
- Tidak ada bypass role via parameter URL atau body request — validasi role selalu dari `session.user.role`, tidak pernah dari input klien.
- Transisi status (state machine) divalidasi dua kali: role harus berwenang ATAS transisi tersebut (lihat `09-TECHNICAL/STATUS-MACHINE.md`) DAN status saat ini (current state di database) harus sesuai prasyarat transisi. Race condition dicegah dengan optimistic locking / transaksi DB pada update status.

---

## Pola Response Sukses

Response sukses berbentuk objek langsung (tanpa envelope tambahan) untuk kesederhanaan, dengan konvensi:

```json
// Single resource
{
  "id": "uuid",
  "...": "..."
}

// List resource (selalu dengan pagination)
{
  "data": [ { "...": "..." }, { "...": "..." } ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 134,
    "total_pages": 7
  }
}
```

HTTP status sukses: `200 OK` (GET/PUT/PATCH), `201 Created` (POST yang membuat entitas baru), `204 No Content` (DELETE/aksi tanpa body balik, jarang dipakai karena sebagian besar "delete" di sistem ini adalah soft-deactivate yang mengembalikan objek terupdate).

---

## Pola Response Error

Semua error mengembalikan body JSON dengan bentuk konsisten:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Deskripsi human-readable untuk ditampilkan/dilog",
    "details": [
      { "field": "quantity", "issue": "must be greater than 0" }
    ]
  }
}
```

`details` bersifat opsional — hanya diisi untuk error validasi multi-field. Pemetaan HTTP status code:

| Status | Kapan Dipakai | Contoh `code` |
|--------|----------------|----------------|
| 400 | Request malformed (body tidak valid JSON, param salah tipe) | `BAD_REQUEST` |
| 401 | Tidak ada sesi valid / belum login | `UNAUTHENTICATED` |
| 403 | Sesi valid tapi role tidak berwenang untuk aksi ini | `FORBIDDEN` |
| 404 | Entitas dengan ID tersebut tidak ditemukan | `NOT_FOUND` |
| 409 | Konflik state — transisi status tidak valid, double-scan, double-release, lokasi storage penuh, duplicate notification | `CONFLICT` |
| 422 | Validasi bisnis gagal meski format benar (mis. DP < 50% tanpa override, waste tanpa alasan) | `VALIDATION_ERROR` |
| 500 | Error tak terduga di server | `INTERNAL_ERROR` |

Semua mutasi (create/update/delete) yang berhasil maupun ditolak karena otorisasi dicatat ke `audit_logs` — termasuk percobaan yang ditolak dengan 403, agar ada jejak upaya akses tidak sah.

---

## AUTH

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `POST /api/auth/login` | Login via NextAuth credentials provider (username + password), set session cookie | Publik (semua user terdaftar) |
| `POST /api/auth/logout` | Hapus session cookie | User login |
| `GET /api/auth/session` | Ambil info sesi aktif (user id, role, nama) | User login |
| `POST /api/auth/change-password` | Ganti password sendiri (wajib saat `must_change_password=true`) | User login |

Login gagal 5x berturut-turut → akun terkunci 15 menit (`locked_until`). 3x terkunci dalam sehari → butuh unlock manual Owner. Semua percobaan (sukses/gagal) dicatat di `audit_logs`.

---

## USERS (User Management)

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/users` | Daftar user (filter by role, active) | Owner |
| `POST /api/users` | Buat user baru + generate password sementara | Owner |
| `PATCH /api/users/:id` | Ubah data user (nama, email, role) | Owner |
| `PATCH /api/users/:id/deactivate` | Nonaktifkan user | Owner |
| `POST /api/users/:id/reset-password` | Reset password user (diberikan offline) | Owner |
| `POST /api/users/:id/unlock` | Unlock akun yang terkunci >3x/hari | Owner |

---

## CUSTOMERS

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/customers` | Daftar konsumen (search by nama/kode) — response tanpa `phone`/`email` untuk role selain admin/owner | Admin, Owner (list penuh); Designer Sales/Operator/Gudang hanya bisa lihat konsumen dari order yang ditanganinya, via endpoint order |
| `POST /api/customers` | Buat konsumen baru (auto-generate `customer_code`) | Admin, Designer Sales, Owner |
| `GET /api/customers/:id` | Detail konsumen (`phone`/`email` distrip sesuai role) | Semua role login (field sensitif difilter server-side) |
| `PATCH /api/customers/:id` | Update data konsumen | Admin, Owner |

---

## ORDERS

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/orders` | Daftar order (filter: status, tanggal, konsumen, kode, deadline, overdue, designer) | Semua role login (scope sesuai hak akses masing-masing) |
| `POST /api/orders` | Buat order baru (status awal `DRAFT`) | Admin, Designer Sales |
| `GET /api/orders/:id` | Detail order + items | Semua role login |
| `PATCH /api/orders/:id` | Edit order (hanya valid saat status DRAFT/DESIGNING/WAITING_APPROVAL) | Admin, Designer Sales (sesuai batas per status, lihat `02-WORKFLOW/02-ORDER.md`) |
| `POST /api/orders/:id/items` | Tambah item ke order | Admin, Designer Sales |
| `PATCH /api/orders/:id/items/:itemId` | Edit item order | Admin, Designer Sales |
| `DELETE /api/orders/:id/items/:itemId` | Hapus item order (hanya saat DRAFT) | Admin, Designer Sales |
| `POST /api/orders/:id/discount` | Ajukan diskon | Admin |
| `POST /api/orders/:id/discount/approve` | Approve/apply diskon | Owner |
| `POST /api/orders/:id/status` | Ubah status order sesuai state machine (lihat `09-TECHNICAL/STATUS-MACHINE.md`) | Bervariasi per transisi — divalidasi server terhadap tabel transisi |
| `POST /api/orders/:id/hold` | Set order ke `ON_HOLD` | Owner |
| `POST /api/orders/:id/cancel` | Ajukan/lakukan cancel order | Admin (sebelum produksi), Owner (setelah produksi / approval) |
| `GET /api/orders/:id/history` | Riwayat perubahan status & aksi (dari `audit_logs`) | Semua role login (scope read) |

---

## DESIGN

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/orders/:id/design` | Detail design job + daftar versi | Semua role login (kecuali field sensitif konsumen) |
| `POST /api/orders/:id/design/versions` | Upload versi desain baru | Designer Sales, Admin (untuk makloon) |
| `POST /api/design/versions/:id/approve` | Approve desain (walk-in/makloon) | Designer Sales |
| `POST /api/design/versions/:id/approve-online` | Konfirmasi approval desain untuk order tipe Online | Admin |
| `POST /api/design/versions/:id/reject` | Reject desain + alasan | Designer Sales, Admin |

---

## PAYMENTS

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/orders/:id/payments` | Riwayat pembayaran order | Admin, Owner |
| `POST /api/orders/:id/payments` | Catat pembayaran baru (amount, method, reference) | Admin |
| `POST /api/payments/:id/confirm` | Konfirmasi status pembayaran (CONFIRMED/REJECTED) | Admin |
| `POST /api/orders/:id/dp-override` | Ajukan/approve pengecualian DP di bawah 50% | Admin (min 30%), Owner (bebas persentase) |

---

## PRODUCTION

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/production-jobs` | Daftar production job (filter: status, mesin, operator, overdue) | Admin, Owner (semua); Operator (hanya job yang di-assign) |
| `POST /api/production-jobs` | Buat production job dari order yang CONFIRMED | Admin |
| `POST /api/production-jobs/:id/assign` | Assign/reassign job ke mesin & operator. Maksimal 2x reassign per Job ID dalam 24 jam oleh Admin — percobaan ke-3 otomatis ditolak (403) dan butuh endpoint approval Owner terpisah (lihat `02-WORKFLOW/05-PRODUCTION.md` "Aturan Tegas — Reassignment Berulang") | Admin (maks. 2x/24 jam), Owner (tanpa batas) |
| `GET /api/production-jobs/:id` | Detail job | Admin, Owner, Operator yang di-assign, Gudang (sesuai tahap) |
| `POST /api/production-jobs/:id/scan/start` | SCAN 1 — mulai produksi (validasi: operator di-assign & status `PRODUCTION_ASSIGNED`) | Operator (yang di-assign) |
| `POST /api/production-jobs/:id/scan/complete` | SCAN 2 — selesai produksi, input `actual_qty`, `waste_qty` (+ alasan jika >0) | Operator (yang di-assign) |
| `POST /api/production-jobs/:id/pause` | Jeda produksi (validasi status `PRODUCTION_STARTED`), `pause_reason` wajib | Operator (yang di-assign) |
| `POST /api/production-jobs/:id/resume` | Lanjutkan produksi setelah jeda (validasi status `PRODUCTION_PAUSED`) | Operator (yang di-assign) |
| `POST /api/production-jobs/:id/rework/report` | Laporkan kebutuhan rework (dari QC FAIL) | Gudang (via qc endpoint), Operator (penjelasan tambahan) |
| `POST /api/production-jobs/:id/rework/decision` | Keputusan APPROVE REWORK / REJECT→REPRINT / HOLD | **Owner saja** (semua tingkat — ke-1, ke-2, eskalasi) |

---

## MATERIALS

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/materials` | Daftar material + stok saat ini | Semua role login (scope sesuai kebutuhan) |
| `POST /api/materials` | Tambah material baru | Gudang, Owner |
| `POST /api/materials/:id/movements` | Catat pergerakan stok (IN/OUT/WASTE/ADJUSTMENT) | Gudang, Owner (IN); Operator (OUT — otomatis dari input pemakaian job) |
| `GET /api/materials/:id/movements` | Riwayat pergerakan stok material | Admin, Owner |
| `GET /api/machines` | Daftar mesin + status | Semua role login |
| `PATCH /api/machines/:id/status` | Ubah status mesin (mis. MAINTENANCE) | Admin, Owner |

---

## QC

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/qc/queue` | Antrian job berstatus `QC_PENDING` | Gudang, Admin, Owner |
| `POST /api/production-jobs/:id/qc` | SCAN 3 — submit hasil QC (checklist, PASS/FAIL, foto) | Gudang |
| `GET /api/qc-records/:id` | Detail record QC | Gudang, Admin, Owner |

Validasi server: FAIL wajib disertai kategori masalah + deskripsi (min 20 karakter). PASS tidak butuh approval tambahan dan langsung memindahkan job ke antrian finishing.

---

## FINISHING

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/finishing/queue` | Antrian job berstatus `QC_PASSED` | Gudang, Admin, Owner |
| `POST /api/production-jobs/:id/finishing/start` | SCAN 4 — mulai finishing (validasi status `QC_PASSED`) | Gudang |
| `POST /api/production-jobs/:id/finishing/complete` | SCAN 5 — selesai finishing, input `actual_qty` | Gudang |
| `POST /api/production-jobs/:id/label` | Generate & cetak label QR (PDF) | Gudang |

---

## STORAGE

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/storage/locations` | Peta lokasi storage + kapasitas | Gudang, Admin, Owner |
| `POST /api/storage/locations` | Daftarkan lokasi storage baru | Owner, Admin |
| `POST /api/production-jobs/:id/storage/initiate` | SCAN 6 — inisiasi simpan (validasi status `FINISHING_COMPLETE`) | Gudang |
| `POST /api/storage/locations/:code/confirm` | SCAN 7 — konfirmasi lokasi penyimpanan (validasi kapasitas & duplikasi) | Gudang |
| `POST /api/storage-items/:id/transit` | SCAN 9 — tandai barang pindah ke counter LT1 | Gudang |
| `POST /api/storage-items/:id/incident` | Laporkan insiden barang tidak ditemukan | Gudang |

---

## PICKUP

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/pickup/lookup` | SCAN 8 — cari & verifikasi order konsumen (by scan atau nama/kode) | Admin |
| `POST /api/orders/:id/pickup/release` | SCAN 10 — release final ke konsumen (validasi: status `READY_FOR_PICKUP`, payment lunas/override, belum pernah di-release) | Admin |

---

## AUDIT

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/audit-logs` | Baca audit log (filter: actor, entity, tanggal, action) | Admin (read-only), Owner |
| `DELETE /api/audit-logs/:id` | Hapus audit log (panel khusus, penghapusan sendiri tercatat) | Owner saja |
| `GET /api/orders/:id/final-audit` | Detail final audit order | Admin, Owner |
| `POST /api/orders/:id/final-audit` | Submit hasil final audit (GREEN/YELLOW/RED) | Admin |
| `POST /api/orders/:id/final-audit/approve` | Approve hasil audit YELLOW sebelum CLOSED | **Owner saja** (sengaja tidak diberikan ke Admin — Admin yang submit hasil audit tidak boleh juga jadi approver, untuk menjaga separation of duties) |
| `POST /api/orders/:id/corrections` | Catat correction/adjustment pasca-CLOSED | Owner, Admin (sesuai kategori) |

---

## REPORTS

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/reports/daily` | Laporan harian | Admin, Owner |
| `GET /api/reports/financial` | Laporan keuangan | Admin (lihat), Owner |
| `GET /api/reports/production` | Laporan produksi | Admin, Owner |
| `GET /api/reports/material` | Laporan material | Admin, Owner |
| `GET /api/reports/employee` | Laporan pegawai/absensi | Owner |
| `GET /api/reports/monthly-owner` | Laporan bulanan ringkasan Owner | Owner |
| `POST /api/reports/:type/export` | Export laporan (PDF/XLSX/CSV) — tercatat di audit log | Sesuai role laporan terkait |

---

## RETAIL POS (Direct Sales)

Endpoint untuk modul Kasir Cepat / Penjualan Langsung barang retail (order_type = RETAIL).
State machine RETAIL: `NEW_RETAIL_ORDER → RETAIL_PAYMENT_COMPLETED → CLOSED` (lihat `09-TECHNICAL/STATUS-MACHINE.md`).

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/retail-products` | Daftar katalog produk retail (nama, SKU, stok, harga) | Admin, Owner |
| `POST /api/retail-products` | Tambah produk retail baru | Admin, Owner |
| `PATCH /api/retail-products/:id` | Edit produk retail (nama, harga, kategori) | Admin, Owner |
| `PATCH /api/retail-products/:id/deactivate` | Nonaktifkan produk retail | Admin, Owner |
| `GET /api/retail-products/:id/movements` | Riwayat mutasi stok produk retail | Admin, Owner |
| `POST /api/retail-products/:id/movements` | Input stok masuk / adjustment stok retail (movement_type: IN/ADJUSTMENT) | Admin, Owner |
| `POST /api/retail/orders` | Buat transaksi RETAIL baru (pilih produk + qty, customer opsional) — status awal `NEW_RETAIL_ORDER` | Admin, Owner |
| `GET /api/retail/orders` | Daftar transaksi RETAIL (filter: tanggal, status, kasir) | Admin, Owner |
| `GET /api/retail/orders/:id` | Detail transaksi RETAIL | Admin, Owner |
| `POST /api/retail/orders/:id/payment` | Konfirmasi pembayaran RETAIL (method: CASH/QRIS) — memicu pemotongan stok otomatis & status → `RETAIL_PAYMENT_COMPLETED` | Admin, Owner |
| `POST /api/retail/orders/:id/close` | Tutup transaksi RETAIL setelah barang diserahkan — status → `CLOSED` | Admin, Owner |
| `POST /api/retail/orders/:id/cancel` | Batalkan transaksi RETAIL (hanya sebelum `RETAIL_PAYMENT_COMPLETED`) | Admin, Owner |
| `GET /api/reports/retail` | Laporan penjualan retail (harian/bulanan, per produk) | Admin, Owner |

**Catatan:**
- Pemotongan `retail_products.stock_quantity` dan pencatatan `retail_stock_movements` dilakukan secara atomik dalam satu transaksi DB saat `RETAIL_PAYMENT_COMPLETED`.
- Jika stok tidak mencukupi (stock_quantity < qty yang diminta), sistem mengembalikan `409 CONFLICT` — kasir harus melakukan adjustment stok dulu.
- Transaksi RETAIL dicatat di `audit_logs` sama seperti transaksi PRINTING.

---

## Catatan Implementasi

- Semua endpoint yang menerima input numerik (qty, harga, waste) divalidasi terhadap aturan di `09-TECHNICAL/VALIDATION-RULES.md` sebelum menyentuh database.
- Endpoint scan (`/scan/*`, `/storage/*confirm*`) menerima `job_code` atau `location_code` sebagai identitas — QR hanya membawa identitas, bukan otorisasi (lihat `02-WORKFLOW/13-QR-SCAN-FLOW.md`); server tetap memvalidasi ulang assignment/role/status setiap request.
- Endpoint list mendukung pagination (`?page=&page_size=`), dan filter spesifik per domain (lihat dokumen workflow terkait untuk daftar filter yang dibutuhkan UI).

