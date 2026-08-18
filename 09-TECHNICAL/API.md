# API

Dokumen ini mendefinisikan kontrak API level perencanaan untuk sistem manajemen percetakan. Tujuannya: cukup detail agar tim backend bisa mulai implementasi (Next.js 14 App Router — Route Handlers di `app/api/**/route.ts`, atau typed Server Actions) tanpa banyak pertanyaan susulan. Field-level detail (semua kolom request/response) tidak dicakup di sini — lihat `05-DATABASE/TABLES.md` untuk skema lengkap.

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
- Untuk endpoint yang mengembalikan field sensitif (mis. `customers.phone`, `customers.email`), server memakai serializer berbasis role: field tersebut dihapus dari response JSON sebelum dikirim (bukan cuma disamarkan di frontend). Setiap akses ke field ini oleh role yang berwenang (`admin_sales`, `supervisor`, `owner`) dicatat ke `audit_logs` (`action=VIEW_CUSTOMER_CONTACT`).
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
| `GET /api/customers` | Daftar konsumen (search by nama/kode) — response tanpa `phone`/`email` untuk role selain admin_sales/supervisor/owner | Admin Sales, Supervisor, Owner (list penuh); Designer/Operator/QC/Finishing/Warehouse hanya bisa lihat konsumen dari order yang ditanganinya, via endpoint order |
| `POST /api/customers` | Buat konsumen baru (auto-generate `customer_code`) | Admin Sales, Designer Sales, Owner |
| `GET /api/customers/:id` | Detail konsumen (`phone`/`email` distrip sesuai role) | Semua role login (field sensitif difilter server-side) |
| `PATCH /api/customers/:id` | Update data konsumen | Admin Sales, Supervisor, Owner |

---

## ORDERS

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/orders` | Daftar order (filter: status, tanggal, konsumen, kode, deadline, overdue, designer) | Semua role login (scope sesuai hak akses masing-masing) |
| `POST /api/orders` | Buat order baru (status awal `DRAFT`) | Admin Sales, Designer Sales |
| `GET /api/orders/:id` | Detail order + items | Semua role login |
| `PATCH /api/orders/:id` | Edit order (hanya valid saat status DRAFT/DESIGNING/WAITING_APPROVAL) | Admin Sales, Designer Sales (sesuai batas per status, lihat `02-WORKFLOW/02-ORDER.md`) |
| `POST /api/orders/:id/items` | Tambah item ke order | Admin Sales, Designer Sales |
| `PATCH /api/orders/:id/items/:itemId` | Edit item order | Admin Sales, Designer Sales |
| `DELETE /api/orders/:id/items/:itemId` | Hapus item order (hanya saat DRAFT) | Admin Sales, Designer Sales |
| `POST /api/orders/:id/discount` | Ajukan diskon | Admin Sales |
| `POST /api/orders/:id/discount/approve` | Approve/apply diskon | Owner |
| `POST /api/orders/:id/status` | Ubah status order sesuai state machine (lihat `09-TECHNICAL/STATUS-MACHINE.md`) | Bervariasi per transisi — divalidasi server terhadap tabel transisi |
| `POST /api/orders/:id/hold` | Set order ke `ON_HOLD` | Owner |
| `POST /api/orders/:id/cancel` | Ajukan/lakukan cancel order | Admin Sales (sebelum produksi), Owner (setelah produksi / approval) |
| `GET /api/orders/:id/history` | Riwayat perubahan status & aksi (dari `audit_logs`) | Semua role login (scope read) |

---

## DESIGN

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/orders/:id/design` | Detail design job + daftar versi | Semua role login (kecuali field sensitif konsumen) |
| `POST /api/orders/:id/design/versions` | Upload versi desain baru | Designer Sales, Admin Sales (untuk makloon) |
| `POST /api/design/versions/:id/approve` | Approve desain (walk-in/makloon) | Designer Sales |
| `POST /api/design/versions/:id/approve-wa` | Konfirmasi approval desain via WhatsApp | Admin Sales |
| `POST /api/design/versions/:id/reject` | Reject desain + alasan | Designer Sales, Admin Sales |

---

## PAYMENTS

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/orders/:id/payments` | Riwayat pembayaran order | Admin Sales, Supervisor (tanpa nominal detail), Owner |
| `POST /api/orders/:id/payments` | Catat pembayaran baru (amount, method, reference) | Admin Sales |
| `POST /api/payments/:id/confirm` | Konfirmasi status pembayaran (CONFIRMED/REJECTED) | Admin Sales |
| `POST /api/orders/:id/dp-override` | Ajukan/approve pengecualian DP di bawah 50% | Admin Sales (min 30%), Owner (bebas persentase) |

---

## PRODUCTION

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/production-jobs` | Daftar production job (filter: status, mesin, operator, overdue) | Supervisor, Owner (semua); Operator (hanya job yang di-assign) |
| `POST /api/production-jobs` | Buat production job dari order yang CONFIRMED | Supervisor |
| `POST /api/production-jobs/:id/assign` | Assign/reassign job ke mesin & operator | Supervisor |
| `GET /api/production-jobs/:id` | Detail job | Supervisor, Owner, Operator yang di-assign, QC, Finishing, Warehouse (sesuai tahap) |
| `POST /api/production-jobs/:id/scan/start` | SCAN 1 — mulai produksi (validasi: operator di-assign & status `PRODUCTION_ASSIGNED`) | Operator (yang di-assign) |
| `POST /api/production-jobs/:id/scan/complete` | SCAN 2 — selesai produksi, input `actual_qty`, `waste_qty` (+ alasan jika >0) | Operator (yang di-assign) |
| `POST /api/production-jobs/:id/rework/report` | Laporkan kebutuhan rework (dari QC FAIL) | QC Inspector (via qc endpoint), Operator (penjelasan tambahan) |
| `POST /api/production-jobs/:id/rework/decision` | Keputusan APPROVE REWORK / REJECT→REPRINT / HOLD | Owner, Supervisor (rework ke-1 & ke-2 saja) |

---

## MATERIALS

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/materials` | Daftar material + stok saat ini | Semua role login (scope sesuai kebutuhan) |
| `POST /api/materials` | Tambah material baru | Admin Sales, Owner |
| `POST /api/materials/:id/movements` | Catat pergerakan stok (IN/OUT/WASTE/ADJUSTMENT) | Admin Sales, Owner (IN); Operator (OUT — otomatis dari input pemakaian job); Warehouse (IN) |
| `GET /api/materials/:id/movements` | Riwayat pergerakan stok material | Supervisor, Owner, Admin Sales |
| `GET /api/machines` | Daftar mesin + status | Semua role login |
| `PATCH /api/machines/:id/status` | Ubah status mesin (mis. MAINTENANCE) | Supervisor, Owner |

---

## QC

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/qc/queue` | Antrian job berstatus `QC_PENDING` | QC Inspector, Supervisor, Owner |
| `POST /api/production-jobs/:id/qc` | SCAN 3 — submit hasil QC (checklist, PASS/FAIL, foto) | QC Inspector |
| `GET /api/qc-records/:id` | Detail record QC | QC Inspector, Supervisor, Owner |

Validasi server: FAIL wajib disertai kategori masalah + deskripsi (min 20 karakter). PASS tidak butuh approval tambahan dan langsung memindahkan job ke antrian finishing.

---

## FINISHING

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/finishing/queue` | Antrian job berstatus `QC_PASSED` | Finishing Staff, Supervisor, Owner |
| `POST /api/production-jobs/:id/finishing/start` | SCAN 4 — mulai finishing (validasi status `QC_PASSED`) | Finishing Staff |
| `POST /api/production-jobs/:id/finishing/complete` | SCAN 5 — selesai finishing, input `actual_qty` | Finishing Staff |
| `POST /api/production-jobs/:id/label` | Generate & cetak label QR (PDF) | Finishing Staff |

---

## STORAGE

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/storage/locations` | Peta lokasi storage + kapasitas | Warehouse, Supervisor, Owner |
| `POST /api/storage/locations` | Daftarkan lokasi storage baru | Owner, Supervisor |
| `POST /api/production-jobs/:id/storage/initiate` | SCAN 6 — inisiasi simpan (validasi status `FINISHING_COMPLETE`) | Warehouse Staff |
| `POST /api/storage/locations/:code/confirm` | SCAN 7 — konfirmasi lokasi penyimpanan (validasi kapasitas & duplikasi) | Warehouse Staff |
| `POST /api/storage-items/:id/transit` | SCAN 9 — tandai barang pindah ke counter LT1 | Warehouse Staff |
| `POST /api/storage-items/:id/incident` | Laporkan insiden barang tidak ditemukan | Warehouse Staff |

---

## PICKUP

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/pickup/lookup` | SCAN 8 — cari & verifikasi order konsumen (by scan atau nama/kode) | Admin Sales |
| `POST /api/orders/:id/pickup/release` | SCAN 10 — release final ke konsumen (validasi: status `READY_FOR_PICKUP`, payment lunas/override, belum pernah di-release) | Admin Sales |

---

## AUDIT

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/audit-logs` | Baca audit log (filter: actor, entity, tanggal, action) | Supervisor, Owner, Auditor (read-only) |
| `DELETE /api/audit-logs/:id` | Hapus audit log (panel khusus, penghapusan sendiri tercatat) | Owner saja |
| `GET /api/orders/:id/final-audit` | Detail final audit order | Auditor, Owner, Supervisor |
| `POST /api/orders/:id/final-audit` | Submit hasil final audit (GREEN/YELLOW/RED) | Auditor |
| `POST /api/orders/:id/final-audit/approve` | Approve hasil audit YELLOW sebelum CLOSED | Supervisor, Owner |
| `POST /api/orders/:id/corrections` | Catat correction/adjustment pasca-CLOSED | Owner, Supervisor (sesuai kategori) |

---

## REPORTS

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/reports/daily` | Laporan harian | Supervisor, Owner |
| `GET /api/reports/financial` | Laporan keuangan | Admin Sales (lihat), Supervisor, Owner |
| `GET /api/reports/production` | Laporan produksi | Supervisor, Owner |
| `GET /api/reports/material` | Laporan material | Supervisor, Owner, Admin Sales |
| `GET /api/reports/employee` | Laporan pegawai/absensi | Owner |
| `GET /api/reports/monthly-owner` | Laporan bulanan ringkasan Owner | Owner |
| `POST /api/reports/:type/export` | Export laporan (PDF/XLSX/CSV) — tercatat di audit log | Sesuai role laporan terkait |

---

## Catatan Implementasi

- Semua endpoint yang menerima input numerik (qty, harga, waste) divalidasi terhadap aturan di `09-TECHNICAL/VALIDATION-RULES.md` sebelum menyentuh database.
- Endpoint scan (`/scan/*`, `/storage/*confirm*`) menerima `job_code` atau `location_code` sebagai identitas — QR hanya membawa identitas, bukan otorisasi (lihat `02-WORKFLOW/13-QR-SCAN-FLOW.md`); server tetap memvalidasi ulang assignment/role/status setiap request.
- Endpoint list mendukung pagination (`?page=&page_size=`), dan filter spesifik per domain (lihat dokumen workflow terkait untuk daftar filter yang dibutuhkan UI).
