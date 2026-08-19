

==================================================
FILE: FOLDER-MAP.md
==================================================

# Folder Map

00-PROJECT = project instructions
01-BUSINESS = business problems and rules
02-WORKFLOW = operational workflows
03-ROLES = permissions per role
04-MODULES = application modules
05-DATABASE = data architecture
06-SECURITY = anti-leakage and access control
07-REPORTS = reports and exports
08-UI-UX = interface requirements
09-TECHNICAL = implementation rules
10-DATA = sample/seed data
11-FUTURE = future integrations


==================================================
FILE: 01-BUSINESS/BUSINESS-FLOW.md
==================================================

# Business Flow

Customer -> Designer/Sales -> Order -> Design -> Approval -> Payment -> Production -> QC -> Finishing -> Storage -> Pickup/Delivery -> Final Audit -> Closed

Parallel control layer:
Audit Log records every critical activity across the flow.


==================================================
FILE: 01-BUSINESS/BUSINESS-PROBLEM.md
==================================================

# Business Problems

## 1. Order leakage
Designer can receive money, coordinate production, take finished goods, and deliver directly to customer.

Risk: unrecorded revenue and customer leakage.

## 2. Customer leakage
Designer can exchange personal contact information with customers and receive future orders privately.

Control: customer identity and order history belong to the company database. Customer can still communicate with designer, but official transaction must exist in the system.

## 3. Material leakage
Banner, A3, flag, sublimation, DTF, indoor, and UV operators do not consistently record material usage.

Control: material movements linked to Job ID, waste reasons, stock reconciliation.

## 4. Finished goods loss
Completed orders are sometimes misplaced.

Control: QR Job ID + storage Location ID + scan-in/scan-out.


==================================================
FILE: 01-BUSINESS/BUSINESS-RULES.md
==================================================

# Business Rules — Sistem Percetakan PrintFlow

## Aturan Bisnis Inti

1. Konsumen dapat datang langsung ke toko, menghubungi via WhatsApp, atau makloon (bawa file sendiri).
2. Admin Sales atau Designer yang membuat order resmi di sistem — konsumen tidak punya akses ke sistem.
3. Semua transaksi keuangan (DP, pelunasan) adalah milik catatan keuangan perusahaan dan tidak bisa diedit setelah dikonfirmasi.
4. Produksi hanya bisa dimulai jika desain sudah berstatus APPROVED dan ada Job ID yang valid.
5. Semua pemakaian material PRINTING harus terhubung ke Job ID — tidak ada pengeluaran material produksi tanpa job. *(Pengecualian: pesanan `order_type = RETAIL` tidak memiliki Job ID; pemotongan stok barang jadi dicatat via `retail_stock_movements` dengan referensi ke `order_id`)*
6. Waste (bahan terbuang) wajib dicatat dengan alasan.
7. QC PASS wajib terpenuhi sebelum lanjut ke finishing dan penyimpanan.
8. Barang selesai finishing wajib disimpan ke lokasi gudang yang terdaftar di sistem (LT3).
9. Penyerahan barang ke konsumen wajib ada otorisasi release dan konfirmasi status payment lunas (atau override Owner).
10. Final Audit wajib dilakukan sebelum order PRINTING bisa di-CLOSED. *(Pengecualian: pesanan `order_type = RETAIL` tidak melalui Final Audit — alurnya langsung `PAYMENT_COMPLETED → CLOSED` setelah barang diserahkan)*
11. Hasil audit RED memblokir penutupan order — harus diselesaikan dulu.
12. Order yang sudah CLOSED tidak bisa diedit langsung — harus lewat workflow Correction/Adjustment.
13. DP minimum 50% untuk konsumen walk-in. Override hanya oleh Admin (min 30%) atau Owner (bebas), dengan alasan wajib tercatat.
14. Diskon hanya bisa diberikan atas persetujuan Owner — Admin hanya bisa mengajukan permintaan diskon.
15. Order yang dibatalkan setelah produksi berjalan: DP hangus, harus ada persetujuan Owner.
16. Stok material tidak bisa dikurangi secara manual tanpa Job ID yang valid (kecuali Adjustment dengan alasan dan approval).
17. Mesin yang sedang MAINTENANCE tidak bisa menerima assignment job baru.
18. Data kontak konsumen (phone, email) tidak pernah tampil di layar untuk role Designer, Operator, QC, Finishing, Warehouse.
19. Audit log bersifat immutable — tidak ada edit atau delete oleh siapapun kecuali Owner via panel khusus yang juga dicatat.
20. Absensi (jam masuk dari fingerprint dan waktu istirahat dari sistem) tidak bisa diubah — Owner hanya bisa menambahkan catatan.

---

## Aturan Deadline

- Peringatan otomatis H-1 (24 jam sebelum deadline) muncul di dashboard Owner, Supervisor, dan Admin Sales.
- Order yang melewati deadline tanpa selesai mendapat label OVERDUE (merah) di semua dashboard.
- Overdue tidak otomatis memblokir produksi — tapi harus menjadi prioritas tertinggi.

---

## Aturan Stok Material

- Alert stok minimum dikirim ke Owner + Admin Sales saat stok ≤ batas minimum.
- Alert tidak memblokir produksi — hanya peringatan.
- Stok roll diukur per Roll untuk pencatatan, tapi pemakaian operator diinput per Meter (sistem konversi otomatis).
- Bahan shared (Graftac dll) memiliki satu stok terpusat yang bisa dipakai dari 2 mesin.
- Admin Sales dan Owner bisa menambahkan jenis bahan baru kapan saja langsung di sistem.

---

## Aturan Absensi

- Batas masuk: 09:15 WIB. Lebih dari itu otomatis tercatat TERLAMBAT.
- Istirahat maksimal 60 menit. Peringatan dikirim di menit ke-45.
- Lebih dari 60 menit: alert ke Owner dan Admin Sales.
- Data absensi tidak bisa diubah oleh siapapun (immutable). Owner hanya bisa tambah catatan.

---

## Aturan Keamanan

- RBAC diterapkan di server-side — menyembunyikan tombol di UI saja tidak cukup.
- Semua aksi kritis diblokir di level API jika role tidak sesuai.
- Login gagal 5 kali: akun terkunci 15 menit otomatis.
- Tidak ada registrasi mandiri — akun dibuat hanya oleh Owner.
- Password reset hanya oleh Owner secara offline.

---

## Aturan Direct Sales / Retail (POS)

Aturan khusus untuk pesanan `order_type = RETAIL` (Penjualan Langsung Barang Jadi):

- Pesanan RETAIL menggunakan "Fast-Track Workflow": `NEW_RETAIL_ORDER → PAYMENT_COMPLETED → CLOSED`.
- Tidak ada proses Desain, Produksi, QC, Finishing, Gudang, atau Final Audit untuk pesanan RETAIL.
- Stok barang jadi (`retail_products`) dipotong otomatis saat status mencapai `PAYMENT_COMPLETED`.
- `customer_id` bersifat opsional (boleh `null`) untuk pelanggan walk-in/guest yang tidak terdaftar.
- Diskon pada pesanan RETAIL mengikuti aturan yang sama dengan PRINTING — hanya bisa diapply oleh Owner.
- Pesanan RETAIL dan PRINTING **tidak boleh digabung dalam satu nota** — jika pelanggan membeli keduanya, dibuat dua transaksi terpisah.
- Pembatalan pesanan RETAIL hanya bisa dilakukan sebelum pembayaran dikonfirmasi; setelah `PAYMENT_COMPLETED` dianggap final.


==================================================
FILE: 01-BUSINESS/DEADLINE-DISCOUNT.md
==================================================

# DEADLINE & OVERDUE — Sistem Peringatan

## Aturan Peringatan Deadline

### H-1 (1 Hari Sebelum Deadline)
Sistem otomatis memberi peringatan kepada:
- **Owner** — via badge/notifikasi di dashboard
- **Supervisor** — via badge/notifikasi di dashboard
- **Admin Sales** — via badge/notifikasi di dashboard (agar bisa persiapan komunikasi ke konsumen)

**Kondisi peringatan muncul:** Order belum berstatus READY_FOR_PICKUP dan deadline tinggal ≤ 24 jam.

**Tampilan di dashboard:** Badge kuning/oranye dengan tanda "⚠ DEADLINE BESOK" di daftar order.

### H-0 (Hari Deadline — Sudah Lewat)
Jika order belum selesai saat deadline tiba:
- Badge berubah merah dengan tanda "🔴 OVERDUE"
- Tampil di semua dashboard (Owner, Supervisor, Admin Sales)
- Muncul di laporan harian sebagai item yang harus ditangani
- **Tidak ada aksi otomatis** — hanya peringatan visual yang jelas

### Eskalasi Manual
- Supervisor yang memutuskan apakah perlu komunikasi ke konsumen tentang keterlambatan
- Admin Sales yang komunikasi ke konsumen (jika diperlukan)
- Owner yang putuskan apakah ada kompensasi atau tidak

---

## Aturan Teknis

- Pengecekan deadline dilakukan setiap jam oleh sistem (cron job)
- Peringatan tidak duplikat — jika sudah ada badge H-1, tidak muncul lagi keesokan harinya (langsung jadi OVERDUE)
- Peringatan hilang otomatis setelah order mencapai READY_FOR_PICKUP
- Semua peringatan yang muncul dicatat di sistem (bukan di audit_logs tapi di tabel `deadline_alerts`)

---

## Dashboard

Di halaman order list, kolom deadline menampilkan:
| Sisa Waktu | Tampilan |
|-----------|---------|
| > 2 hari | Teks normal |
| 1-2 hari | 🟡 Kuning — "Besok" |
| < 24 jam | 🟠 Oranye — "Hari ini" |
| Sudah lewat | 🔴 Merah — "OVERDUE X hari" |

---

## Database Tambahan

Tabel `deadline_alerts`:
```
id
order_id
alert_type    (H1_WARNING / OVERDUE)
triggered_at
resolved_at   (diisi saat order READY_FOR_PICKUP)
```

---

## Diskon — Aturan

Hanya **Owner** yang dapat memberikan diskon pada order.

**Alur:**
```
Admin Sales buka halaman order
  → Klik "Ajukan Diskon" (tombol ini tampil untuk Admin Sales dan Owner)
  → Admin Sales: hanya bisa ajukan, tidak bisa langsung apply
  → Request masuk ke Owner
  → Owner review → input jumlah/persen diskon + alasan
  → Owner klik "Setujui & Apply Diskon"
  → Harga order diupdate, audit log dicatat
```

**Catatan:**
- Diskon tidak bisa diberikan setelah order CLOSED
- Setiap diskon tercatat: siapa yang approve, berapa, alasan apa
- Admin Sales tidak bisa apply diskon sendiri tanpa Owner
- Designer tidak bisa ajukan diskon sama sekali


==================================================
FILE: 06-SECURITY/ACCESS-CONTROL.md
==================================================

# ACCESS CONTROL

## Prinsip Dasar

Sistem menggunakan **Role-Based Access Control (RBAC)** dengan 8 role: Owner, Supervisor, Admin Sales, Designer Sales, Operator, QC Inspector, Finishing Staff, Warehouse Staff. (User Management adalah fungsi yang hanya bisa dijalankan Owner, bukan role terpisah.)

**RBAC diterapkan di server, bukan di UI.** Setiap API route/Server Action wajib memvalidasi `session.user.role` sebelum menjalankan logika apapun. Hidden button, disabled input, atau menu yang disembunyikan di frontend **bukan** kontrol akses — itu hanya kenyamanan tampilan. Tanpa pengecekan role di server, siapapun yang tahu endpoint-nya (via devtools, curl, script) bisa mem-bypass UI. Detail kontrak otorisasi per endpoint ada di `09-TECHNICAL/API.md`.

Rangkuman ini disusun dari definisi hak akses yang sudah tersebar di `03-ROLES/*.md` per role — bukan aturan baru. Tujuannya satu titik referensi agar tim tidak perlu membuka 10 file terpisah untuk tahu "siapa boleh apa".

---

## Matriks RBAC

Legenda: ✅ = akses penuh, 📖 = read-only / lihat saja, ❌ = tidak ada akses.

| Modul / Aksi | Owner | Supervisor | Admin Sales | Designer Sales | Operator | QC Inspector | Finishing Staff | Warehouse Staff |
|---|---|---|---|---|---|---|---|---|
| **Order** — buat/edit (DRAFT–CONFIRMED) | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Order** — lihat | ✅ | 📖 | ✅ | 📖 (order sendiri) | 📖 (job sendiri) | 📖 (job sendiri) | 📖 (job sendiri) | 📖 (job sendiri) |
| **Order** — approve diskon | ✅ | ❌ | ❌ (hanya ajukan) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Order** — cancel sebelum produksi | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Order** — cancel setelah produksi | ✅ | ❌ | ❌ (hanya ajukan) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Order** — freeze (ON_HOLD) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Design** — upload & approve walk-in/makloon | ❌ | ❌ | ❌ (approve WA saja) | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Design** — approve via WhatsApp | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Payment** — konfirmasi DP/pelunasan | ❌ | 📖 (tanpa nominal detail) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Payment** — override DP di bawah 50% | ✅ (bebas %) | ❌ | ✅ (min 30%) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Production** — assign/reassign job | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Production** — scan mulai/selesai (job sendiri) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Production** — approve rework ke-1 & ke-2 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Production** — approve eskalasi rework setelah 2x FAIL | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Material** — input stok masuk | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Material** — tambah bahan baru | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Material** — input pemakaian per job | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **QC** — submit hasil (PASS/FAIL) | ❌ | 📖 | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Finishing** — scan mulai/selesai + cetak label | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Storage** — scan simpan (Job QR + Location QR) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Storage** — laporkan insiden | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Pickup** — release final ke konsumen | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ (hanya konfirmasi barang di counter) |
| **Audit** — submit hasil final audit (GREEN/YELLOW/RED) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Audit** — approve hasil YELLOW sebelum CLOSED | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Audit** — lihat audit log | ✅ | 📖 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Audit** — hapus audit log | ✅ (panel khusus, tercatat) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Reports** — keuangan | ✅ | 📖 | 📖 | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Reports** — produksi | ✅ | 📖 (+ export) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Reports** — material | ✅ | 📖 | 📖 | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Reports** — pegawai/absensi | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Reports** — export semua laporan | ✅ | ✅ (produksi) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Data konsumen** — phone/email | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **User Management** — buat/nonaktifkan/reset password/unlock | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **POS / Direct Sales** — buat transaksi RETAIL | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **POS / Direct Sales** — konfirmasi pembayaran RETAIL | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Retail Inventory** — lihat katalog & stok barang retail | ✅ | 📖 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Retail Inventory** — tambah/edit produk retail | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Retail Inventory** — input stok masuk barang retail | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Retail Inventory** — adjustment stok barang retail | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Reports** — laporan penjualan retail | ✅ | 📖 | 📖 | ❌ | ❌ | ❌ | ❌ | ❌ |

<!-- perlu klarifikasi: 03-ROLES/OWNER.md tidak eksplisit menyebut Owner bisa submit QC atau scan produksi langsung — mengikuti prinsip "Owner akses penuh ke semua data" secara umum, tapi aksi operasional harian (scan QR, submit QC) di file per-role hanya didefinisikan untuk role eksekutor terkait (Operator/QC/Finishing/Warehouse). Matriks di atas menandai kolom Owner ❌ untuk aksi operasional harian tersebut karena tidak disebut eksplisit sebagai hak Owner di file manapun, meski secara praktik Owner mungkin bisa override lewat panel admin. -->

<!-- perlu klarifikasi: hak "Reports produksi — export" untuk Supervisor eksplisit ✅ di SUPERVISOR.md, tapi tidak ada penyebutan setara untuk laporan keuangan/material — diasumsikan Supervisor hanya read-only untuk keduanya kecuali disebutkan lain. -->

---

## Prinsip Least Privilege

- Setiap role hanya diberi akses **minimum yang dibutuhkan** untuk menjalankan tugasnya — bukan akses default luas yang dipersempit belakangan.
- Operator, QC Inspector, dan Finishing Staff hanya melihat job yang relevan dengan tugasnya (job yang di-assign / dalam antrian tahap masing-masing), bukan seluruh data order.
- Data sensitif konsumen (`phone`, `email`) hanya terbuka untuk role yang memang berinteraksi langsung dengan konsumen atau butuh data finansial (Admin Sales, Supervisor, Owner). Data konsumen difilter berdasarkan role.
- Penambahan hak akses baru ke suatu role harus eksplisit didokumentasikan di `03-ROLES/<ROLE>.md` dan direfleksikan ke matriks ini — tidak ada hak akses implisit "karena role tersebut senior".

---

## Audit atas Perubahan Permission

- Perubahan role user (`PATCH /api/users/:id` yang mengubah `role_id`) hanya bisa dilakukan Owner, dan setiap perubahan dicatat di `audit_logs` (`action=USER_ROLE_CHANGED`, dengan `old_value_json`/`new_value_json`).
- Role tidak boleh diubah selagi user memiliki job/order aktif berstatus IN_PROGRESS — job aktif harus di-reassign dulu sebelum perubahan role diterapkan (lihat `03-ROLES/USER-MANAGEMENT.md`).
- Nonaktifkan user, reset password, dan unlock akun terkunci — ketiganya aksi Owner-only dan seluruhnya tercatat di `audit_logs` dengan actor, target user, dan timestamp.
- Karena matriks RBAC di atas menentukan otorisasi server, setiap perubahan pada matriks ini (menambah/mengurangi hak suatu role) berarti perubahan pada validasi server yang mengacunya — perubahan seperti ini wajib direview seperti perubahan kode keamanan lain, bukan sekadar edit dokumentasi.


==================================================
FILE: 06-SECURITY/ANTI-LEAKAGE.md
==================================================

# Anti-Leakage Controls

## Customer Data Leakage

### Aturan Kontak Konsumen
- Designer/Sales boleh berkomunikasi langsung dengan konsumen untuk keperluan desain
- Namun setelah data masuk sistem, designer TIDAK DAPAT mengakses nomor HP atau email konsumen
- Nomor HP konsumen hanya tersedia untuk Admin Sales, Supervisor, dan Owner
- Sistem WhatsApp dikirim otomatis — tidak ada manual copy-paste nomor ke luar sistem
- Pelanggaran: designer yang mencoba akses data kontak lewat cara apapun harus tercatat dan dilaporkan

### Setiap order resmi harus memiliki:
- Customer ID
- Order ID
- payment record
- design record
- production Job ID

---

## Financial Leakage

Designer/Designer-Sales TIDAK DAPAT:
- menghapus payment
- menandai payment sebagai diterima
- menutup order
- melepas (release) barang jadi
- mengubah harga order setelah disetujui

---

## Production Leakage

- Produksi membutuhkan Job ID valid dan desain yang sudah disetujui
- Tanpa Job ID resmi = tidak ada produksi resmi
- Material keluar harus selalu terkait Job ID

---

## Material Leakage

- Material OUT membutuhkan Job ID
- Waste dan adjustment harus disertai alasan yang tercatat
- Perbedaan antara planned_qty dan actual_qty wajib dicatat beserta alasannya

---

## Finished Goods Leakage

Release barang membutuhkan:
- order valid dengan status READY_FOR_PICKUP
- payment verified (cek apakah sudah lunas atau override disetujui)
- user yang berwenang (hanya Admin Sales)
- pickup record yang lengkap

Override aturan release hanya bisa dilakukan oleh Supervisor atau Owner dengan approval eksplisit dan tercatat di audit.

---

## QR/Barcode adalah Identitas, Bukan Otorisasi

Scan QR tidak pernah otomatis memberikan izin apapun.
Setelah QR di-scan, sistem masih melakukan pengecekan:
1. Apakah user yang scan punya izin untuk aksi ini?
2. Apakah status order cocok dengan aksi yang diminta?
3. Semua aksi setelah scan tetap divalidasi server-side

---

## WhatsApp Control

- Notifikasi konsumen hanya dipicu setelah STORAGE_CONFIRMED
- Mengirim pesan tidak mengubah status order
- Nomor HP konsumen tidak pernah ditampilkan kepada operator, designer, atau finishing staff
- Jika pengiriman gagal: alert ke Admin, notifikasi tidak otomatis diulang tanpa perintah manual dari Admin


==================================================
FILE: 06-SECURITY/AUDIT-TRAIL.md
==================================================

# AUDIT TRAIL

## Prinsip Dasar

Audit trail adalah catatan permanen dan tidak dapat diubah dari semua aksi kritis di sistem.
Setiap perubahan status, aksi sensitif, dan keputusan penting harus tercatat secara otomatis.

---

## Real-Time

- Audit log ditulis **secara sinkron** bersamaan dengan setiap transaksi database
- Jika audit log gagal ditulis, transaksi utamanya juga harus di-rollback
- Tidak ada batch atau delay — setiap aksi langsung tercatat

---

## Siapa yang Bisa Menghapus

| Role | Hapus Audit Log |
|------|----------------|
| Owner | **YA, dengan konfirmasi 2 langkah** (hanya dalam keadaan sangat khusus, seperti data PII yang harus dihapus karena regulasi) |
| Supervisor | TIDAK BISA |
| Admin Sales | TIDAK BISA |
| Designer | TIDAK BISA |
| Operator | TIDAK BISA |
| Sistem/API | TIDAK BISA (tidak ada endpoint DELETE) |

> Penghapusan oleh Owner pun harus mengisi alasan dan dikonfirmasi ulang.
> Aksi penghapusan itu sendiri dicatat di audit log terpisah yang tidak bisa dihapus.

---

## Dimana Menyimpan Audit Log

### Rekomendasi: Database Utama + Proteksi Berlapis

**Opsi yang direkomendasikan (paling praktis untuk skala ini):**

```
PostgreSQL (database utama)
  └── tabel: audit_logs
       ├── Tidak ada endpoint DELETE di API
       ├── PostgreSQL Role khusus: audit_writer (INSERT only, no UPDATE/DELETE)
       ├── Aplikasi menggunakan audit_writer untuk menulis log
       └── Hanya Owner via panel khusus yang bisa trigger DELETE (dengan logging)
```

**Mengapa bukan database terpisah?**
- Untuk percetakan skala ini, database terpisah menambah kompleksitas operasional yang tidak perlu
- Selama akses API-nya dikunci (tidak ada DELETE endpoint kecuali Owner), risiko sudah sangat rendah
- Cukup amankan dengan: Role PostgreSQL + tidak ada endpoint hapus + monitor akses database langsung

**Jika di masa depan butuh level keamanan lebih tinggi:**
- Pertimbangkan replikasi audit_logs ke object storage (S3/MinIO) sebagai cold backup
- Setiap baris audit_logs bisa diberi hash dari konten sebelumnya (blockchain-style) untuk deteksi tampering

---

## Retention Period

- Audit log disimpan minimal **2 tahun** (24 bulan)
- Setelah 2 tahun: arsip ke cold storage, tidak dihapus
- Log terkait kasus sengketa: disimpan selama kasus berlangsung + 1 tahun setelahnya

---

## Aksi yang Wajib Dicatat

| Kategori | Aksi |
|----------|------|
| **User Management** | Login, logout, gagal login, ubah password, buat user, nonaktifkan user |
| **Order** | Buat order, ubah harga, ubah deadline, cancel order, close order |
| **Payment** | Konfirmasi payment, override DP, ubah status payment |
| **Design** | Upload file, minta approval, approve/reject desain |
| **Production** | Buat Job, mulai produksi, selesai produksi, rework |
| **QC** | QC PASS, QC FAIL, approve rework, reject rework |
| **Storage** | Scan masuk storage, scan keluar storage, barang tidak ditemukan |
| **Pickup/Delivery** | Release barang, override release, konfirmasi delivery |
| **Audit** | Buat audit, beri hasil PASS/FAIL/HOLD, close order setelah audit |
| **Data Sensitif** | Akses data phone/email konsumen (siapapun yang mengaksesnya) |

---

## Format Pencatatan

Setiap baris di `audit_logs`:
```
id            : UUID
actor_id      : user_id yang melakukan aksi
action        : string aksi (e.g., ORDER_CREATED, QC_FAIL_REWORK_APPROVED)
entity_type   : jenis objek (order, production_job, payment, dll)
entity_id     : ID objek yang diubah
old_value_json: nilai sebelum perubahan (JSON)
new_value_json: nilai setelah perubahan (JSON)
ip_address    : IP address actor
user_agent    : browser/device info
notes         : keterangan tambahan (alasan override, dll)
created_at    : timestamp (UTC, tidak bisa diubah)
```

---

## Akses ke Audit Log

- **Owner**: Lihat semua, filter semua, export CSV/PDF
- **Supervisor**: Lihat log terkait area mereka, tidak bisa export
- **Admin Sales**: Hanya lihat log terkait order dan notifikasi mereka sendiri
- **Role lain**: Tidak bisa akses audit log


==================================================
FILE: 06-SECURITY/DATA-PROTECTION.md
==================================================

# DATA PROTECTION

## Prinsip Dasar

Least-privilege access, secure password hashing, session security,
restricted customer/financial data, backups and recovery.

---

## Proteksi Data Konsumen — WAJIB

### Field yang Diklasifikasikan Sensitif

| Field | Tabel | Klasifikasi |
|-------|-------|-------------|
| `phone` | customers | **RAHASIA** |
| `email` | customers | **RAHASIA** |
| `address` | customers | Terbatas |
| `company` | customers | Terbatas |
| `name` | customers | Dapat dilihat semua role |

### Aturan Akses Data Konsumen

**DESIGNER / DESIGNER-SALES:**
- BOLEH: lihat nama konsumen, order ID, status order, deadline, deskripsi produk
- DILARANG KERAS: akses nomor HP, email, alamat konsumen dalam bentuk apapun
- DILARANG KERAS: export atau download data konsumen
- DILARANG KERAS: akses daftar semua konsumen (hanya boleh lihat konsumen dari order yang ditanganinya)

**OPERATOR / QC / FINISHING:**
- BOLEH: lihat nama konsumen (sebatas info job), Job ID, spesifikasi produk
- DILARANG KERAS: akses phone, email, alamat konsumen

**WAREHOUSE:**
- BOLEH: lihat nama konsumen, Job ID, lokasi storage, status
- DILARANG KERAS: akses phone, email konsumen

**ADMIN SALES:**
- BOLEH: lihat semua data konsumen termasuk phone dan email
- BOLEH: kirim notifikasi manual jika WhatsApp gagal
- TIDAK BOLEH: export data konsumen tanpa log

**SUPERVISOR:**
- BOLEH: lihat semua data konsumen termasuk phone dan email
- TIDAK BOLEH: export data konsumen tanpa log

**OWNER:**
- Akses penuh ke semua data
- Setiap akses ke data sensitif tercatat di audit log



---

## Implementasi Teknis

### Server-Side Enforcement
- Field `phone` dan `email` HANYA di-include dalam API response jika role requester adalah: `admin_sales`, `supervisor`, `owner`
- Bukan hanya hidden di UI — field ini tidak boleh ada dalam response JSON untuk role lain
- Gunakan serializer/transformer berbasis role di setiap API endpoint yang mengembalikan data konsumen

### Masking di UI
- Untuk role yang tidak berhak (termasuk role read-only lainnya): tampilkan `+6281****5678`
- Jangan hanya CSS hide — data tidak boleh ada di DOM

### WhatsApp — Nomor Tidak Boleh Dikirim Manual
- Notifikasi WhatsApp HANYA bisa dikirim oleh sistem otomatis
- Tidak ada fitur "kirim WhatsApp manual" yang mengekspos nomor HP konsumen ke user interface
- Jika gagal: sistem menampilkan peringatan ke Admin, Admin hanya melihat nama konsumen + status — bukan nomor HP-nya

### Logging Akses Data Sensitif
- Setiap akses ke `phone` atau `email` konsumen dicatat di `audit_logs`
- Format: `actor_id | action=VIEW_CUSTOMER_CONTACT | entity_type=customer | entity_id=X | timestamp`

---

## Password & Sesi

- Password di-hash menggunakan bcrypt (min cost 12) atau Argon2id
- Session token: HTTP-only cookie, Secure, SameSite=Strict
- Session expiry: 8 jam (satu shift kerja)
- Logout wajib di semua device jika password diubah

---

## Backup & Recovery

- Database backup harian (otomatis)
- Backup disimpan di lokasi terpisah dari server utama
- Retention backup: minimum 90 hari
- Recovery test: wajib diuji setiap 30 hari

---

## Enkripsi

### Transport (Wajib)
- Seluruh traffic aplikasi wajib **HTTPS/TLS** — tidak ada endpoint yang boleh diakses via HTTP polos, termasuk di jaringan lokal internal.
- Sertifikat dikelola otomatis (mis. Let's Encrypt) dengan renewal otomatis; domain custom dengan HTTPS adalah syarat wajib deployment (lihat `09-TECHNICAL/TECH-STACK.md`).
- Koneksi aplikasi ↔ database PostgreSQL memakai SSL/TLS jika keduanya tidak berada di host yang sama.
- Kamera browser (scan QR) hanya berfungsi di konteks aman (HTTPS) — ini juga persyaratan teknis dari Web API `getUserMedia`.

### At-Rest (Kolom Sensitif)
- Field `customers.phone` dan `customers.email` disimpan di PostgreSQL yang volume disknya terenkripsi di level infrastruktur (disk encryption pada VPS/managed storage).
- Untuk lapisan tambahan, kolom `phone` dan `email` dapat dienkripsi di level aplikasi (column-level encryption, mis. `pgcrypto` atau enkripsi di application layer sebelum INSERT) — direkomendasikan jika sistem berkembang menyimpan data konsumen dalam skala besar atau ada persyaratan kepatuhan yang lebih ketat. Untuk tahap awal, kombinasi disk encryption + akses API yang dibatasi role (lihat bagian Server-Side Enforcement di atas) dianggap cukup.
- Password tidak pernah disimpan plaintext — sudah diatur di bagian "Password & Sesi" (bcrypt/Argon2id).
- Backup database (`pg_dump`) yang disimpan di object storage terpisah juga wajib terenkripsi at-rest (bucket encryption) karena berisi salinan penuh data sensitif.

---

## Rate Limiting

### Login
- Selaras dengan kebijakan lockout di `03-ROLES/USER-MANAGEMENT.md`: maksimum **5 kali** percobaan password salah berturut-turut per akun sebelum akun terkunci otomatis selama **15 menit**.
- Setelah akun terkunci **3 kali berturut-turut dalam satu hari**, unlock otomatis dihentikan — Owner wajib melakukan unlock manual (`POST /api/users/:id/unlock`).
- Selain lockout per-akun, endpoint `POST /api/auth/login` juga dibatasi per-IP (mis. maksimum 20 percobaan/menit dari satu IP) untuk mencegah credential stuffing lintas akun dari sumber yang sama.
- Semua percobaan login (berhasil maupun gagal) dicatat di `audit_logs`.

### Endpoint Publik Lain
- Sistem ini tidak memiliki endpoint publik tanpa autentikasi selain halaman login — tidak ada registrasi mandiri, tidak ada API publik untuk konsumen.
- Endpoint yang menerima input dari perangkat scan (SCAN 1–10) tetap memerlukan sesi login aktif, sehingga rate limit login di atas menjadi lini pertama; tambahan rate limit per-user pada endpoint mutasi berfrekuensi tinggi (mis. submit QC, submit scan) direkomendasikan sebagai pencegahan penyalahgunaan/skrip otomatis (mis. maksimum 60 request/menit per user pada endpoint mutasi).
- Endpoint export laporan (`POST /api/reports/:type/export`) dibatasi frekuensinya per user untuk mencegah scraping data massal, di luar pencatatan yang sudah wajib ke audit log.

---

## Retensi Data Pelanggan

- Data konsumen (`customers`) dan riwayat order (`orders`, `order_items`, `payments`, dll) **disimpan permanen** selama tidak ada permintaan penghapusan eksplisit dari pemilik data — bukan dihapus otomatis setelah order selesai atau setelah periode tidak aktif tertentu.
- Alasan: sistem memakai PostgreSQL dengan jaminan ACID justru untuk mendukung audit trail dan riwayat transaksi yang harus bisa ditelusuri (final audit, laporan keuangan, sengketa konsumen) kapan pun diperlukan — penghapusan otomatis berisiko merusak integritas laporan historis.
- Tidak ada soft-delete untuk tabel inti (`active = false` dipakai untuk menonaktifkan, bukan menghapus) — konsisten dengan aturan di `05-DATABASE/TABLES.md`.
- Jika konsumen meminta datanya dihapus (lihat bagian UU PDP di bawah), penghapusan dilakukan lewat proses khusus yang tetap meninggalkan jejak di `audit_logs` (siapa yang menghapus, kapan, atas dasar permintaan siapa) — bukan penghapusan diam-diam yang membuat riwayat transaksi bolong tanpa jejak.

---

## Kepatuhan UU PDP (Undang-Undang Pelindungan Data Pribadi)

Sistem ini berkomitmen mengikuti prinsip dasar UU PDP Indonesia dalam pemrosesan data pribadi konsumen dan pegawai: pemrosesan data (nama, telepon, email, alamat) dilakukan berdasarkan kebutuhan pelaksanaan transaksi (dasar kontraktual — memproses pesanan cetak), pemilik data berhak meminta **akses** ke datanya sendiri, **koreksi** jika data tidak akurat, dan **penghapusan** (right to erasure) jika tidak ada dasar hukum lain yang mengharuskan data tersebut tetap disimpan (mis. kewajiban pembukuan). Permintaan semacam ini ditangani lewat Admin Sales/Owner secara manual pada tahap awal sistem, dicatat di `audit_logs`, dan diproses lewat mekanisme correction/deactivation yang sudah ada — dokumen ini tidak membahas detail hukum lebih lanjut; untuk kasus kompleks (mis. permintaan hapus total riwayat transaksi yang bersinggungan dengan kewajiban pembukuan pajak) perlu konsultasi terpisah dengan pihak legal.


==================================================
FILE: 10-DATA/SAMPLE-CUSTOMERS.md
==================================================

# SAMPLE CUSTOMERS

| Customer Code | Nama | Tipe | Keterangan |
|--------------|------|------|-----------|
| CST-00001 | Ahmad | Walk-in | Konsumen reguler |
| CST-00002 | PT Maju Jaya | Makloon | Bawa file sendiri |
| CST-00003 | Budi | WhatsApp | Order via WA |
| CST-00004 | CV Kreatif Nusantara | Makloon | Langganan sticker |
| CST-00005 | Rina Wijaya | Walk-in | Konsumen baru |

*Nomor HP dan email konsumen tidak ditampilkan di sample data karena merupakan data sensitif.*
*Di sistem nyata, field ini tersimpan di database tapi hanya tampil ke Admin Sales, Supervisor, dan Owner.*


==================================================
FILE: 10-DATA/SAMPLE-MACHINES.md
==================================================

# SAMPLE MACHINES — Daftar Mesin Percetakan

## Daftar Mesin Resmi

| Kode Mesin | Nama | Kategori | Produk yang Dihasilkan |
|-----------|------|----------|----------------------|
| M-OUT-01 | Mesin Outdoor 01 | Outdoor | Banner, Spanduk, Backdrop, MMT, Frontlit, Backlit |
| M-IND-01 | Mesin Indoor 01 | Indoor | Sticker Vinyl, Cetak Foto Besar, Sticker Oneway Vision |
| M-SUB-01 | Mesin Sublimasi 01 | Sublimasi | Jersey, Baju Polyester, Kain Custom, Bendera Sublim |
| M-A3-01 | Mesin A3 01 | A3/Digital | Cetak A3, Art Paper, Photo Paper A3, Undangan |
| M-UV-01 | Mesin UV 01 | UV Printing | Cetak di Acrylic, Kayu, Kaca, PVC, Plat Metal |
| M-DTF-01 | Mesin DTF 01 | DTF | Transfer ke Kaos, Jaket, Topi, Kain Gelap |
| M-FLG-01 | Mesin Bendera 01 | Bendera | Bendera Satin, Bendera Polyester, Umbul-umbul |

---

## Catatan

- Kode mesin mengikuti format: `M-[KATEGORI]-[NOMOR]`
- Jika di masa depan ada mesin tambahan sejenis: `M-OUT-02`, `M-OUT-03`, dst
- Setiap mesin memiliki daftar bahan (material) yang kompatibel — lihat `SAMPLE-MATERIALS.md`
- Mesin bisa dinonaktifkan di sistem jika sedang dalam perawatan (status: INACTIVE)

---

## Status Mesin

| Status | Artinya |
|--------|---------|
| ACTIVE | Siap digunakan untuk produksi |
| MAINTENANCE | Sedang diperbaiki/servis |
| INACTIVE | Tidak digunakan sementara |

Perubahan status mesin hanya bisa dilakukan oleh Supervisor atau Owner.
Jika mesin di-set MAINTENANCE, job yang sudah di-assign harus di-reassign ke mesin lain.


==================================================
FILE: 10-DATA/SAMPLE-MATERIALS.md
==================================================

# SAMPLE MATERIALS — Bahan & Tinta per Mesin

## Format Kode Material

```
Format  : MAT-[KATEGORI]-[NOMOR]
Contoh  : MAT-OUT-001 (bahan untuk outdoor)
          MAT-INK-OUT-001 (tinta untuk outdoor)
```

---

## 1. MESIN OUTDOOR (M-OUT-01) — Banner, Spanduk, Backdrop

### Bahan (Media)

| Kode | Nama Bahan | Satuan | Stok Awal | Min Stok |
|------|-----------|--------|-----------|---------|
| MAT-OUT-001 | Flexy China 340gr | Roll | 5 roll | 2 roll |
| MAT-OUT-002 | Flexy Korea 440gr | Roll | 9 roll | 3 roll |
| MAT-OUT-003 | Flexy Premium 510gr | Roll | 3 roll | 1 roll |
| MAT-OUT-004 | Frontlit 510gr | Roll | 4 roll | 2 roll |
| MAT-OUT-005 | Backlit 510gr | Roll | 2 roll | 1 roll |
| MAT-OUT-006 | One Way Vision | Roll | 2 roll | 1 roll |

### Tinta

| Kode | Nama Tinta | Satuan | Stok Awal | Min Stok |
|------|-----------|--------|-----------|---------|
| MAT-INK-OUT-001 | Tinta Solvent Cyan (Outdoor) | Liter | 8 L | 3 L |
| MAT-INK-OUT-002 | Tinta Solvent Magenta (Outdoor) | Liter | 8 L | 3 L |
| MAT-INK-OUT-003 | Tinta Solvent Yellow (Outdoor) | Liter | 8 L | 3 L |
| MAT-INK-OUT-004 | Tinta Solvent Black (Outdoor) | Liter | 10 L | 4 L |

---

## 2. MESIN INDOOR (M-IND-01) — Sticker, Foto Besar, Oneway

### Bahan (Media)

| Kode | Nama Bahan | Satuan | Stok Awal | Min Stok |
|------|-----------|--------|-----------|---------|
| MAT-IND-001 | Sticker Vinyl Putih | Roll | 6 roll | 2 roll |
| MAT-IND-002 | Sticker Chrome/Silver | Roll | 3 roll | 1 roll |
| MAT-IND-003 | Sticker Transparan | Roll | 4 roll | 1 roll |
| MAT-IND-004 | Oneway Vision | Roll | 2 roll | 1 roll |
| MAT-IND-005 | Photo Paper Glossy | Roll | 5 roll | 2 roll |
| MAT-IND-006 | Photo Paper Matte | Roll | 3 roll | 1 roll |
| MAT-IND-007 | Canvas Indoor | Roll | 2 roll | 1 roll |

### Tinta

| Kode | Nama Tinta | Satuan | Stok Awal | Min Stok |
|------|-----------|--------|-----------|---------|
| MAT-INK-IND-001 | Tinta Eco-Solvent Cyan | Liter | 6 L | 2 L |
| MAT-INK-IND-002 | Tinta Eco-Solvent Magenta | Liter | 6 L | 2 L |
| MAT-INK-IND-003 | Tinta Eco-Solvent Yellow | Liter | 6 L | 2 L |
| MAT-INK-IND-004 | Tinta Eco-Solvent Black | Liter | 8 L | 3 L |

---

## 3. MESIN SUBLIMASI (M-SUB-01) — Jersey, Kain, Bendera Sublim

### Bahan (Media)

| Kode | Nama Bahan | Satuan | Stok Awal | Min Stok |
|------|-----------|--------|-----------|---------|
| MAT-SUB-001 | Kertas Transfer Sublim | Roll | 10 roll | 3 roll |
| MAT-SUB-002 | Kain Polyester (Putih) | Meter | 200 m | 50 m |
| MAT-SUB-003 | Kain Jersey Polyester | Meter | 150 m | 50 m |
| MAT-SUB-004 | Kain Satin Polyester | Meter | 100 m | 30 m |

### Tinta

| Kode | Nama Tinta | Satuan | Stok Awal | Min Stok |
|------|-----------|--------|-----------|---------|
| MAT-INK-SUB-001 | Tinta Sublimasi Cyan | Liter | 5 L | 2 L |
| MAT-INK-SUB-002 | Tinta Sublimasi Magenta | Liter | 5 L | 2 L |
| MAT-INK-SUB-003 | Tinta Sublimasi Yellow | Liter | 5 L | 2 L |
| MAT-INK-SUB-004 | Tinta Sublimasi Black | Liter | 6 L | 2 L |

---

## 4. MESIN A3 (M-A3-01) — Cetak A3, Art Paper, Undangan

### Bahan (Media)

| Kode | Nama Bahan | Satuan | Stok Awal | Min Stok |
|------|-----------|--------|-----------|---------|
| MAT-A3-001 | Kertas HVS A3 80gr | Rim | 20 rim | 5 rim |
| MAT-A3-002 | Kertas HVS A3 100gr | Rim | 10 rim | 3 rim |
| MAT-A3-003 | Art Paper A3 120gr | Rim | 15 rim | 5 rim |
| MAT-A3-004 | Art Paper A3 150gr | Rim | 10 rim | 3 rim |
| MAT-A3-005 | Photo Paper Glossy A3 | Rim | 8 rim | 2 rim |
| MAT-A3-006 | Photo Paper Matte A3 | Rim | 8 rim | 2 rim |
| MAT-A3-007 | Kertas Ivory A3 | Rim | 5 rim | 2 rim |

### Tinta

| Kode | Nama Tinta | Satuan | Stok Awal | Min Stok |
|------|-----------|--------|-----------|---------|
| MAT-INK-A3-001 | Tinta Pigment Cyan A3 | Botol (100ml) | 12 botol | 4 botol |
| MAT-INK-A3-002 | Tinta Pigment Magenta A3 | Botol (100ml) | 12 botol | 4 botol |
| MAT-INK-A3-003 | Tinta Pigment Yellow A3 | Botol (100ml) | 12 botol | 4 botol |
| MAT-INK-A3-004 | Tinta Pigment Black A3 | Botol (100ml) | 15 botol | 5 botol |
| MAT-INK-A3-005 | Tinta Pigment Light Cyan | Botol (100ml) | 8 botol | 3 botol |
| MAT-INK-A3-006 | Tinta Pigment Light Magenta | Botol (100ml) | 8 botol | 3 botol |

---

## 5. MESIN UV (M-UV-01) — Acrylic, Kayu, Kaca, PVC

### Bahan (Media)

| Kode | Nama Bahan | Satuan | Stok Awal | Min Stok |
|------|-----------|--------|-----------|---------|
| MAT-UV-001 | Acrylic Bening 3mm | Lembar | 30 lbr | 10 lbr |
| MAT-UV-002 | Acrylic Putih 3mm | Lembar | 20 lbr | 8 lbr |
| MAT-UV-003 | Acrylic Bening 5mm | Lembar | 15 lbr | 5 lbr |
| MAT-UV-004 | PVC Board 5mm | Lembar | 25 lbr | 10 lbr |
| MAT-UV-005 | Kayu MDF 3mm | Lembar | 20 lbr | 8 lbr |
| MAT-UV-006 | Plat Alumunium | Lembar | 15 lbr | 5 lbr |

### Tinta

| Kode | Nama Tinta | Satuan | Stok Awal | Min Stok |
|------|-----------|--------|-----------|---------|
| MAT-INK-UV-001 | Tinta UV Cyan | Liter | 3 L | 1 L |
| MAT-INK-UV-002 | Tinta UV Magenta | Liter | 3 L | 1 L |
| MAT-INK-UV-003 | Tinta UV Yellow | Liter | 3 L | 1 L |
| MAT-INK-UV-004 | Tinta UV Black | Liter | 3 L | 1 L |
| MAT-INK-UV-005 | Tinta UV White | Liter | 4 L | 2 L |
| MAT-INK-UV-006 | Tinta UV Varnish/Glossy | Liter | 2 L | 1 L |

---

## 6. MESIN DTF (M-DTF-01) — Transfer ke Kaos, Jaket, Kain

### Bahan (Media)

| Kode | Nama Bahan | Satuan | Stok Awal | Min Stok |
|------|-----------|--------|-----------|---------|
| MAT-DTF-001 | DTF PET Film (Roll) | Roll | 8 roll | 3 roll |
| MAT-DTF-002 | DTF Powder Hot Melt (Putih) | Kg | 10 kg | 3 kg |
| MAT-DTF-003 | DTF Powder Hot Melt (Hitam) | Kg | 5 kg | 2 kg |

### Tinta

| Kode | Nama Tinta | Satuan | Stok Awal | Min Stok |
|------|-----------|--------|-----------|---------|
| MAT-INK-DTF-001 | Tinta DTF Cyan | Liter | 4 L | 2 L |
| MAT-INK-DTF-002 | Tinta DTF Magenta | Liter | 4 L | 2 L |
| MAT-INK-DTF-003 | Tinta DTF Yellow | Liter | 4 L | 2 L |
| MAT-INK-DTF-004 | Tinta DTF Black | Liter | 4 L | 2 L |
| MAT-INK-DTF-005 | Tinta DTF White | Liter | 6 L | 3 L |

---

## 7. MESIN BENDERA (M-FLG-01) — Bendera, Umbul-umbul

### Bahan (Media)

| Kode | Nama Bahan | Satuan | Stok Awal | Min Stok |
|------|-----------|--------|-----------|---------|
| MAT-FLG-001 | Kain Satin | Meter | 100 m | 30 m |
| MAT-FLG-002 | Kain Polyester Bendera | Meter | 150 m | 50 m |
| MAT-FLG-003 | Kain Spunbond | Meter | 80 m | 20 m |
| MAT-FLG-004 | Kain Parasut | Meter | 60 m | 20 m |

### Tinta
*(Mesin bendera umumnya menggunakan sistem sublimasi — berbagi tinta dengan M-SUB-01)*

| Kode | Nama Tinta | Satuan | Catatan |
|------|-----------|--------|---------|
| MAT-INK-SUB-001 | Tinta Sublimasi Cyan | Liter | Berbagi dengan M-SUB-01 |
| MAT-INK-SUB-002 | Tinta Sublimasi Magenta | Liter | Berbagi dengan M-SUB-01 |
| MAT-INK-SUB-003 | Tinta Sublimasi Yellow | Liter | Berbagi dengan M-SUB-01 |
| MAT-INK-SUB-004 | Tinta Sublimasi Black | Liter | Berbagi dengan M-SUB-01 |

---

## Bahan Lintas Mesin (Shared Materials)

Beberapa bahan dapat digunakan di lebih dari satu mesin:

| Kode | Nama Bahan | Bisa di Mesin | Satuan Stok | Satuan Pemakaian |
|------|-----------|--------------|-------------|------------------|
| MAT-SHARED-001 | Sticker Graftac Putih | M-OUT-01 + M-IND-01 | Roll | Meter |
| MAT-SHARED-002 | Sticker Graftac Transparan | M-OUT-01 + M-IND-01 | Roll | Meter |

Bahan shared tetap dicatat dalam satu stok terpusat, tapi bisa dipilih di kedua mesin saat operator input pemakaian.

---

## Satuan Pemakaian — Aturan Standar Industri

| Tipe Bahan | Satuan Stok | Satuan Pemakaian |
|-----------|-------------|------------------|
| Bahan Roll (Flexy, Sticker, DTF Film, Canvas) | **Roll** | **Meter** (panjang yang terpakai) |
| Kain (per meter) | **Meter** | **Meter** |
| Kertas (A3, Art Paper) | **Rim** | **Lembar** |
| Acrylic, PVC Board | **Lembar** | **Lembar** |
| Tinta | **Liter** | **mL** (mililiter) |
| Powder DTF | **Kg** | **Gram** |

Sistem otomatis konversi: misalnya saat operator input 2.5 meter pemakaian Flexy, stok roll berkurang 2.5 meter dari total roll yang ada.

---

## Bahan yang Dapat Ditambahkan Admin

Selain daftar bahan di atas, Admin Sales atau Owner dapat **menambahkan bahan baru** langsung di sistem tanpa perlu update kode.

Saat menambahkan bahan baru, Admin mengisi:
- Nama bahan (bebas)
- Kategori mesin (pilih dari daftar mesin)
- Satuan (Roll / Meter / Lembar / Liter / Kg / Rim / Botol / Pcs / Lainnya)
- Stok awal
- Stok minimum (batas alert)
- Keterangan opsional

Bahan yang ditambahkan langsung aktif dan bisa dipilih saat operator input material usage.


==================================================
FILE: 10-DATA/SAMPLE-PRODUCTS.md
==================================================

# SAMPLE PRODUCTS

## Daftar Produk Percetakan

| Kode Produk | Nama Produk | Kategori Mesin | Satuan |
|------------|------------|----------------|--------|
| PRD-OUT-001 | Banner / Spanduk | Outdoor (M-OUT-01) | m² |
| PRD-OUT-002 | Backdrop Event | Outdoor (M-OUT-01) | m² |
| PRD-OUT-003 | MMT / Baliho | Outdoor (M-OUT-01) | m² |
| PRD-OUT-004 | Frontlit | Outdoor (M-OUT-01) | m² |
| PRD-OUT-005 | Backlit | Outdoor (M-OUT-01) | m² |
| PRD-IND-001 | Sticker Vinyl | Indoor (M-IND-01) | m² |
| PRD-IND-002 | Cetak Foto Besar | Indoor (M-IND-01) | m² |
| PRD-IND-003 | Sticker One Way | Indoor (M-IND-01) | m² |
| PRD-IND-004 | Sticker Chrome | Indoor (M-IND-01) | m² |
| PRD-IND-005 | Canvas Print | Indoor (M-IND-01) | m² |
| PRD-SUB-001 | Jersey / Kaos Sublim | Sublimasi (M-SUB-01) | Pcs |
| PRD-SUB-002 | Kain Custom Sublim | Sublimasi (M-SUB-01) | m² |
| PRD-A3-001 | Cetak A3 HVS | A3 (M-A3-01) | Lembar |
| PRD-A3-002 | Cetak A3 Art Paper | A3 (M-A3-01) | Lembar |
| PRD-A3-003 | Cetak A3 Photo Glossy | A3 (M-A3-01) | Lembar |
| PRD-A3-004 | Undangan / Kartu | A3 (M-A3-01) | Pcs |
| PRD-UV-001 | Cetak Acrylic | UV (M-UV-01) | Lembar |
| PRD-UV-002 | Cetak PVC Board | UV (M-UV-01) | Lembar |
| PRD-UV-003 | Cetak Kayu / MDF | UV (M-UV-01) | Lembar |
| PRD-UV-004 | Cetak Plat Logam | UV (M-UV-01) | Lembar |
| PRD-DTF-001 | Transfer DTF Kaos | DTF (M-DTF-01) | Pcs |
| PRD-DTF-002 | Transfer DTF Jaket | DTF (M-DTF-01) | Pcs |
| PRD-FLG-001 | Bendera Satin | Bendera (M-FLG-01) | Pcs |
| PRD-FLG-002 | Bendera Polyester | Bendera (M-FLG-01) | Pcs |
| PRD-FLG-003 | Umbul-umbul | Bendera (M-FLG-01) | Pcs |

---

## Catatan

- Harga per produk bisa berbeda tergantung ukuran, bahan, dan quantity
- Harga bukan bagian dari tabel `products` — harga diinput saat buat order item
- Admin Sales dapat menambahkan produk baru langsung di sistem jika ada jenis baru
- Kode produk mengikuti format: `PRD-[KATEGORI]-[NOMOR]`


==================================================
FILE: 10-DATA/SAMPLE-STORAGE.md
==================================================

# SAMPLE STORAGE LOCATIONS

## Lantai 3 — Gudang Finishing (Main Storage)

### Zona A — Banner, Spanduk, Backdrop (Ukuran Besar)
| Kode Lokasi | Nama | Kapasitas |
|------------|------|-----------|
| LT3-A-01-01 | Lantai 3 Zona A Rak 1 Slot 1 | 1 job |
| LT3-A-01-02 | Lantai 3 Zona A Rak 1 Slot 2 | 1 job |
| LT3-A-02-01 | Lantai 3 Zona A Rak 2 Slot 1 | 1 job |
| LT3-A-02-02 | Lantai 3 Zona A Rak 2 Slot 2 | 1 job |

### Zona B — Sticker, Label, Kartu Nama (Ukuran Kecil)
| Kode Lokasi | Nama | Kapasitas |
|------------|------|-----------|
| LT3-B-01-01 | Lantai 3 Zona B Rak 1 Slot 1 | 1 job |
| LT3-B-01-02 | Lantai 3 Zona B Rak 1 Slot 2 | 1 job |
| LT3-B-02-01 | Lantai 3 Zona B Rak 2 Slot 1 | 1 job |

### Zona C — Box, Packaging
| Kode Lokasi | Nama | Kapasitas |
|------------|------|-----------|
| LT3-C-01-01 | Lantai 3 Zona C Rak 1 Slot 1 | 1 job |
| LT3-C-01-02 | Lantai 3 Zona C Rak 1 Slot 2 | 1 job |

### Zona D — Holding Area (Barang Belum Sepenuhnya Siap)
| Kode Lokasi | Nama | Kapasitas |
|------------|------|-----------|
| LT3-D-01-01 | Lantai 3 Holding Area Slot 1 | 1 job |
| LT3-D-01-02 | Lantai 3 Holding Area Slot 2 | 1 job |

---

## Lantai 1 — Counter Penyerahan (Pickup Counter)

| Kode Lokasi | Nama | Kapasitas |
|------------|------|-----------|
| LT1-COUNTER-01 | Counter Penyerahan Slot 1 | 1 job |
| LT1-COUNTER-02 | Counter Penyerahan Slot 2 | 1 job |
| LT1-COUNTER-03 | Counter Penyerahan Slot 3 | 1 job |

*Counter LT1 hanya untuk transit sementara saat konsumen sudah datang.*
*Bukan untuk penyimpanan jangka panjang.*


==================================================
FILE: 04-MODULES/AUDIT.md
==================================================

# AUDIT

Status: **Spesifikasi lengkap ada di** `02-WORKFLOW/11-FINAL-AUDIT-CLOSING.md`

File ini hanya penanda modul teknis — jangan diisi ulang, karena akan duplikasi dengan sumber kebenaran di atas.

## Topik yang dicakup di sana

- Cakupan pemeriksaan final audit (finance, material, quantity, production, QC, finishing, storage, pickup/delivery)
- Integritas alur kerja (workflow integrity) dan akuntabilitas user
- Hasil audit: GREEN (close) / YELLOW (perlu approval supervisor) / RED (tidak bisa close)
- Larangan edit langsung setelah order CLOSED — wajib lewat workflow correction/adjustment (lihat `02-WORKFLOW/15-CORRECTION-ADJUSTMENT.md`)


==================================================
FILE: 04-MODULES/AUTHENTICATION.md
==================================================

# AUTHENTICATION

Tidak ada file `02-WORKFLOW` tunggal yang sepadan untuk modul ini — spesifikasi berikut adalah sumber kebenaran untuk Authentication. Rujukan silang: kebijakan lockout login ada di `03-ROLES/USER-MANAGEMENT.md`, dan stack teknis di `09-TECHNICAL/TECH-STACK.md`.

## Jenis Session

Menggunakan **server session via NextAuth v5 (Auth.js)**, bukan JWT stateless murni:
- Session token disimpan sebagai HTTP-only cookie, `Secure`, `SameSite=Strict` (lihat `06-SECURITY/DATA-PROTECTION.md`)
- NextAuth v5 default memakai JWT untuk isi cookie session, tapi validasi role/permission tetap dicek server-side di setiap API route (bukan hanya percaya klaim di token) — konsisten dengan aturan "server-side authorization wajib" di `09-TECHNICAL/TECH-STACK.md`
- Tidak ada data sensitif disimpan di localStorage/sessionStorage

## Durasi Session

- Session expiry: **8 jam** (satu shift kerja), sesuai `06-SECURITY/DATA-PROTECTION.md`
- Logout otomatis di semua device jika password diubah

## Hashing Password

- Algoritma: **bcrypt (minimum cost factor 12)** atau **Argon2id**, sesuai `06-SECURITY/DATA-PROTECTION.md`
- Tidak ada penyimpanan password plaintext atau reversible-encrypted di database maupun log

## Alur Aktivasi Akun Baru

1. Owner membuat user baru lewat panel User Management (lihat `03-ROLES/USER-MANAGEMENT.md`)
2. Sistem generate password sementara acak
3. Owner memberikan password sementara ke pegawai secara langsung (offline, bukan email/WA)
4. Field `must_change_password = true` di-set untuk user baru
5. Saat login pertama kali, sistem memaksa ganti password sebelum bisa mengakses fitur lain
6. Setelah ganti password berhasil, `must_change_password` di-reset ke `false`

## Lockout Login

Kebijakan lockout sudah didefinisikan di `03-ROLES/USER-MANAGEMENT.md` — bagian "Keamanan Login":
- 5x gagal login berturut-turut → akun terkunci otomatis 15 menit
- Setelah 3x terkunci berturut-turut dalam sehari → butuh unlock manual oleh Owner
- Field terkait: `failed_login_count`, `locked_until` di tabel `users`

## Owner 2FA

Fitur opsional, khusus untuk akun dengan role `owner` (tidak berlaku untuk role lain):

- Metode: **TOTP** (Time-based One-Time Password) via aplikasi authenticator (Google Authenticator, Authy, dsb.) — tidak memakai SMS OTP karena bergantung pada provider eksternal yang tidak reliable
- Aktivasi: Owner mengaktifkan sendiri dari halaman profil/keamanan akun — sistem generate QR code + secret key untuk di-scan aplikasi authenticator
- Setelah aktif, login Owner memerlukan dua langkah: (1) username + password, lalu (2) kode TOTP 6-digit dari aplikasi authenticator
- Recovery codes: sistem generate 8–10 kode backup satu-kali-pakai saat aktivasi, untuk kondisi Owner kehilangan akses ke aplikasi authenticator
- Menonaktifkan 2FA memerlukan re-autentikasi password (dan kode TOTP aktif, jika masih tersedia)
- Field tambahan di tabel `users`: `totp_secret` (terenkripsi), `totp_enabled` (boolean), `totp_recovery_codes` (hashed, array)
- Setiap login dengan 2FA (berhasil maupun gagal) tercatat di `audit_logs`


==================================================
FILE: 04-MODULES/BARCODE-QR.md
==================================================

# Barcode / QR Module

## Purpose

Create a single scannable identity for each official Production Job / finished order.

Recommended primary identifier:
JOB ID + QR Code.

## QR usage points

1. Production job identification
2. Finishing completion
3. Label verification
4. Storage placement
5. Storage lookup
6. Customer pickup/release
7. Audit history

## Label content

- company name
- QR code
- Job ID
- Order ID
- customer name
- product
- quantity

## Storage QR

Every storage location has a unique QR code.

Example:
LOCATION: RAK-A-02

## Scan behavior

When a user scans a Job QR, the system must:
- identify the job;
- check user permission;
- show only permitted information;
- show current status;
- show current storage location if available;
- provide only actions allowed for the current workflow state.

## Anti-abuse
A scan must never automatically grant permission to release goods. Authorization still applies.


==================================================
FILE: 04-MODULES/CUSTOMER.md
==================================================

# CUSTOMER

Status: **Spesifikasi lengkap ada di** `02-WORKFLOW/01-CUSTOMER-DESIGNER.md` dan `02-WORKFLOW/02-ORDER.md`

File ini hanya penanda modul teknis — jangan diisi ulang, karena akan duplikasi dengan sumber kebenaran di atas.

## Topik yang dicakup di sana

- Alur konsumen menghubungi Designer/Sales langsung (data yang dikumpulkan: produk, quantity, size, material, finishing, deadline, referensi desain, identitas konsumen)
- Larangan transaksi privat/tidak tercatat
- Pembuatan Draft Order dari data konsumen
- Kode konsumen (`CST-XXXXX`) dan riwayat order — lihat `09-TECHNICAL/TECH-STACK.md` untuk format kode
- Klasifikasi data sensitif konsumen (phone/email/address) dan aturan akses per role — lihat `06-SECURITY/DATA-PROTECTION.md`


==================================================
FILE: 04-MODULES/DELIVERY.md
==================================================

# DELIVERY

Status: **OUT OF SCOPE**

Delivery/pengiriman via kurir di luar scope sistem — semua konsumen mengambil barang sendiri di toko (pickup).
Lihat `02-WORKFLOW/10-PICKUP-DELIVERY.md` untuk alur pickup.


==================================================
FILE: 04-MODULES/DESIGN.md
==================================================

# DESIGN

Status: **Spesifikasi lengkap ada di** `02-WORKFLOW/03-DESIGN-APPROVAL.md`

File ini hanya penanda modul teknis — jangan diisi ulang, karena akan duplikasi dengan sumber kebenaran di atas.

## Topik yang dicakup di sana

- Tiga jalur approval desain: Walk-in (approval lisan langsung), Makloon (file dari konsumen, auto-approved), WhatsApp/Remote (approval via konfirmasi Admin Sales)
- Aturan umum: versioning desain (V1, V2, V3...), hanya versi APPROVED yang boleh masuk produksi
- Larangan Designer meng-approve desainnya sendiri untuk jalur WhatsApp
- Struktur tabel `design_versions` (file_path, preview_path, approval_status, approved_by, approval_method, dll.)


==================================================
FILE: 04-MODULES/FINISHING.md
==================================================

# FINISHING

Status: **Spesifikasi lengkap ada di** `02-WORKFLOW/08-FINISHING.md`

File ini hanya penanda modul teknis — jangan diisi ulang, karena akan duplikasi dengan sumber kebenaran di atas.

## Topik yang dicakup di sana

- Alur wajib: QC PASS → FINISHING → PACKING → scan QR/barcode job → cetak/verifikasi label → scan lokasi storage → READY_FOR_PICKUP → notifikasi otomatis
- Data yang wajib dicatat operator finishing (Job ID, operator, quantity, waktu mulai/selesai, catatan, hasil scan)
- Aturan penting: selesai finishing saja TIDAK membuat order siap diambil — wajib tersimpan di lokasi storage terdaftar dulu
- Isi label rekomendasi (nama perusahaan, QR Code, Job ID, Order ID, nama konsumen, deskripsi produk, quantity)
- Trigger notifikasi WhatsApp setelah scan storage berhasil


==================================================
FILE: 04-MODULES/MATERIAL-INVENTORY.md
==================================================

# MATERIAL INVENTORY MODULE

## Tujuan

Mengelola semua bahan baku dan tinta percetakan:
- Pencatatan stok masuk dan keluar
- Stok dikelompokkan per mesin
- Alert stok minimum otomatis
- Admin dapat menambahkan bahan baru secara mandiri
- Laporan penggunaan material per job/mesin

---

## Struktur Material

Setiap material memiliki:
- **Kategori Mesin**: bahan hanya muncul di pilihan mesin yang relevan
- **Tipe**: MEDIA (bahan cetak) atau INK (tinta)
- **Satuan**: Roll, Meter, Lembar, Liter, Kg, Rim, Botol, Pcs, atau Custom
- **Stok Minimum**: batas bawah sebelum alert dikirim

---

## Mesin dan Bahan yang Tersedia

| Mesin | Kode | Contoh Bahan |
|-------|------|-------------|
| Outdoor | M-OUT-01 | Flexy China, Flexy Korea, Tinta Solvent |
| Indoor | M-IND-01 | Sticker Vinyl, Photo Paper, Tinta Eco-Solvent |
| Sublimasi | M-SUB-01 | Kertas Transfer, Kain Polyester, Tinta Sublim |
| A3 | M-A3-01 | Art Paper, Photo Paper A3, Tinta Pigment |
| UV | M-UV-01 | Acrylic, PVC Board, Tinta UV, Tinta White |
| DTF | M-DTF-01 | DTF Film, Powder Hot Melt, Tinta DTF White |
| Bendera | M-FLG-01 | Kain Satin, Kain Polyester, Tinta Sublim |

---

## Fitur Tambah Bahan Baru oleh Admin

Admin Sales atau Owner dapat menambahkan bahan baru kapan saja langsung dari sistem:

```
Halaman: Inventori → Kelola Bahan → Tambah Bahan Baru

Form input:
- Nama Bahan (teks bebas)
- Kategori Mesin (dropdown — pilih mesin terkait)
- Tipe (MEDIA / INK)
- Satuan (dropdown + opsi "Lainnya" untuk input manual)
- Stok Awal
- Stok Minimum (batas alert)
- Keterangan (opsional)
```

Bahan yang ditambahkan langsung:
- Aktif dan muncul di dropdown saat operator input pemakaian
- Bisa di-edit atau dinonaktifkan oleh Admin/Owner
- Tidak bisa dihapus permanen (hanya nonaktifkan) untuk menjaga histori

---

## Alur Stok Masuk (Pembelian Bahan)

```
Admin Sales / Warehouse
  → Halaman Inventori → Stok Masuk
  → Pilih Bahan (dari daftar sesuai mesin)
  → Input:
      - Jumlah yang masuk
      - Satuan (sudah terisi otomatis)
      - Harga beli per satuan (opsional, untuk laporan biaya)
      - Supplier (opsional)
      - Tanggal masuk
      - Catatan
  → Sistem update stok otomatis
  → Tercatat di material_movements (movement_type: IN)
```

**Siapa yang bisa input stok masuk:**
- Admin Sales ✅
- Owner ✅
- Warehouse ✅
- Operator, Designer, QC, Finishing ❌

---

## Alur Stok Keluar (Pemakaian Produksi)

```
Operator saat selesai produksi
  → Form Selesai Produksi (setelah Scan QR)
  → Wajib input pemakaian bahan:
      - Pilih bahan yang dipakai (sudah difilter sesuai mesin)
      - Jumlah terpakai
      - Jumlah waste/sisa terbuang (dengan alasan jika > 0)
  → Sistem kurangi stok secara otomatis
  → Tercatat di material_movements (movement_type: OUT, terhubung ke Job ID)
```

**Aturan penting:**
- Material OUT **selalu harus ada Job ID** — tidak bisa keluar tanpa terhubung ke produksi resmi
- Jika operator tidak input pemakaian saat selesai produksi → sistem memblokir status PRODUCTION_COMPLETE

---

## Alert Stok Minimum

Saat stok suatu bahan mencapai atau di bawah `min_stock`:
- Badge merah muncul di dashboard Owner dan Supervisor
- Notifikasi WhatsApp ke Owner: *"Stok [nama bahan] untuk [nama mesin] tinggal [X] [satuan]. Segera lakukan pembelian."*
- Admin Sales juga mendapat badge di dashboard (lihat saja, tidak ada aksi otomatis)

**Alert tidak memblokir produksi** — produksi tetap bisa jalan, tapi Owner sudah diperingatkan.

---

## Stok Adjustment (Koreksi Manual)

Jika ada selisih antara stok sistem dengan fisik aktual (saat stock opname):

```
Owner/Admin
  → Inventori → Adjustment Stok
  → Pilih bahan
  → Input: jumlah aktual fisik
  → Sistem hitung selisih otomatis
  → Wajib isi alasan adjustment
  → Tercatat di material_movements (movement_type: ADJUSTMENT)
  → Dicatat di audit_log
```

**Siapa yang bisa adjustment:** Admin Sales dan Owner.

---

## Tampilan Stok per Mesin (Di Dashboard)

Halaman inventori menampilkan stok dikelompokkan per mesin:

```
📦 STOK MESIN OUTDOOR (M-OUT-01)
┌──────────────────────────────────────────────┐
│ Bahan         │ Stok   │ Satuan │ Status      │
├──────────────────────────────────────────────┤
│ Flexy China   │  5     │ Roll   │ 🟢 AMAN    │
│ Flexy Korea   │  9     │ Roll   │ 🟢 AMAN    │
│ Flexy Premium │  1     │ Roll   │ 🔴 MENIPIS │
│ Tinta Solvent │  8     │ Liter  │ 🟢 AMAN    │
│ ...           │        │        │             │
│ [+ Tambah Bahan Baru]                         │
└──────────────────────────────────────────────┘
```

Warna status:
- 🟢 AMAN: stok > min_stock × 2
- 🟡 PERHATIAN: stok > min_stock tapi < min_stock × 2
- 🔴 MENIPIS: stok ≤ min_stock

---

## Laporan Material

- **Laporan Harian**: bahan yang keluar hari ini per mesin
- **Laporan Bulanan**: ringkasan pemakaian, pembelian, adjustment, selisih
- **Laporan per Job**: berapa bahan yang dipakai untuk satu order tertentu
- **Laporan Waste**: material terbuang per mesin, per operator — untuk audit efisiensi


==================================================
FILE: 04-MODULES/ORDER.md
==================================================

# ORDER

Status: **Spesifikasi lengkap ada di** `02-WORKFLOW/02-ORDER.md`

File ini hanya penanda modul teknis — jangan diisi ulang, karena akan duplikasi dengan sumber kebenaran di atas.

## Topik yang dicakup di sana

- Langkah pembuatan order baru: data wajib diisi vs data otomatis terisi sistem (kode order `ORD-YYYYMMDD-XXXX`, status DRAFT)
- Multi-item order (combo order) dan perhitungan harga total
- Upload file desain per tipe order (Walk-in / Makloon / WhatsApp)
- Penetapan DP minimum dan perubahan status ke WAITING_PAYMENT / CONFIRMED
- Aturan edit order per status (DRAFT, DESIGNING, CONFIRMED, CLOSED)
- Multiple Production Job per order untuk item dengan mesin berbeda
- Filter dan pencarian daftar order


==================================================
FILE: 04-MODULES/PAYMENT.md
==================================================

# PAYMENT

Status: **Spesifikasi lengkap ada di** `02-WORKFLOW/04-PAYMENT.md`

File ini hanya penanda modul teknis — jangan diisi ulang, karena akan duplikasi dengan sumber kebenaran di atas.

## Topik yang dicakup di sana

- Alur umum: payment request → DP dibayar → konfirmasi Admin Sales → PARTIAL → produksi mulai → pelunasan → PAID
- Aturan DP minimum berbeda untuk Walk-in (50% wajib) vs konsumen remote (bisa override oleh Admin Sales/Owner)
- Mekanisme override DP dan pencatatan wajib di `audit_logs`
- Siapa yang boleh konfirmasi payment (hanya Admin Sales) dan larangan role lain
- Kondisi pelunasan sebelum barang bisa diserahkan
- Struktur tabel `payments` dan field terkait DP di tabel `orders`
- Batasan visibilitas nominal payment untuk Designer


==================================================
FILE: 04-MODULES/PRODUCTION.md
==================================================

# PRODUCTION

Status: **Spesifikasi lengkap ada di** `02-WORKFLOW/05-PRODUCTION.md`

File ini hanya penanda modul teknis — jangan diisi ulang, karena akan duplikasi dengan sumber kebenaran di atas.

## Topik yang dicakup di sana

- Syarat masuk produksi: order approved + kondisi payment terpenuhi
- Alur: Production Planning → Job Assignment → Start → Finish
- Data yang wajib dicatat per job (Job ID, mesin, operator, planned/actual quantity, start/end, reprint, waste, catatan)
- Aturan dasar: tanpa Job ID, produksi dianggap tidak resmi


==================================================
FILE: 04-MODULES/QC.md
==================================================

# QC

Status: **Spesifikasi lengkap ada di** `02-WORKFLOW/07-QC.md`

File ini hanya penanda modul teknis — jangan diisi ulang, karena akan duplikasi dengan sumber kebenaran di atas.

## Topik yang dicakup di sana

- Alur utama: production complete → scan Job QR → checklist inspeksi → hasil PASS/FAIL
- Item checklist inspeksi (quantity, ukuran, warna, kualitas cetak, defect fisik, finishing)
- QC PASS: order lanjut ke FINISHING tanpa approval tambahan
- QC FAIL: alur rework lengkap 5 langkah (pelaporan, notifikasi otomatis ke Owner/Supervisor/Admin Sales, penjelasan operator, keputusan Owner approve/reject/hold, QC ulang oleh inspector berbeda)
- Batas maksimal rework (2x per Job ID) dan eskalasi wajib jika rework kedua juga gagal
- Struktur tabel `qc_records` dan pencatatan keputusan rework di `audit_logs`


==================================================
FILE: 04-MODULES/REPORTS.md
==================================================

# REPORTS

Status: **Spesifikasi lengkap ada di folder** `07-REPORTS/`

File ini hanya penanda modul teknis — jangan diisi ulang, karena akan duplikasi dengan sumber kebenaran di atas. Tidak ada satu file 02-WORKFLOW tunggal untuk topik ini; setiap jenis laporan punya file terpisah di `07-REPORTS/`.

## Daftar laporan yang dicakup di sana

- `DAILY-REPORT.md` — laporan harian operasional
- `EMPLOYEE-REPORT.md` — laporan performa/aktivitas pegawai
- `FINANCIAL-REPORT.md` — laporan keuangan
- `MATERIAL-REPORT.md` — laporan pemakaian dan stok material
- `MONTHLY-OWNER-REPORT.md` — ringkasan bulanan untuk Owner
- `PRODUCTION-REPORT.md` — laporan produksi
- `FINAL-AUDIT-REPORT.md` — laporan hasil final audit (lihat juga `02-WORKFLOW/11-FINAL-AUDIT-CLOSING.md`)


==================================================
FILE: 04-MODULES/STORAGE.md
==================================================

# STORAGE

Status: **Spesifikasi lengkap ada di** `02-WORKFLOW/09-STORAGE.md`

File ini hanya penanda modul teknis — jangan diisi ulang, karena akan duplikasi dengan sumber kebenaran di atas.

## Topik yang dicakup di sana

- Dua area storage: Gudang Finishing (Lantai 3, penyimpanan utama) dan Counter Penyerahan (Lantai 1, area transit pengambilan)
- Sistem penomoran lokasi (`LT3-[ZONA]-[RAK]-[SLOT]`) dan pembagian zona A–D
- Alur masuk storage lantai 3 (scan Job QR → scan QR lokasi → validasi → READY_FOR_PICKUP)
- Alur pengambilan (pickup flow) di counter lantai 1, termasuk verifikasi identitas dan pelunasan
- Penanganan insiden barang tidak ditemukan
- Struktur tabel `storage_locations` dan `storage_items`
- Format dan konteks penggunaan QR lokasi storage


==================================================
FILE: 04-MODULES/WHATSAPP-NOTIFICATION.md
==================================================

# WhatsApp Notification Module

## Tujuan

Mengirimkan notifikasi otomatis kepada konsumen ketika pesanan fisik sudah selesai,
tersimpan di lokasi yang valid, dan benar-benar siap diambil atau dikirim.

---

## Trigger yang Benar

Notifikasi HANYA boleh dikirim setelah urutan ini selesai:

```
QC PASS
  → FINISHING COMPLETE
  → JOB QR SCANNED (oleh finishing staff)
  → STORAGE LOCATION QR SCANNED (oleh warehouse)
  → STORAGE CONFIRMED (status: READY_FOR_PICKUP)
  → SISTEM mengirim notifikasi otomatis
```

Notifikasi TIDAK boleh dipicu hanya karena produksi atau finishing selesai.

---

## Cara Pengiriman

- Sistem mengambil `phone` konsumen dari database secara internal
- Nomor HP **tidak pernah ditampilkan** ke antarmuka user manapun dalam proses ini
- Notifikasi dikirim oleh sistem, bukan oleh staff secara manual

---

## Provider WhatsApp

- Provider akan ditentukan saat implementasi (Fonnte / Wablas / WhatsApp Business API)
- Sistem wajib menggunakan **abstraction layer** (service/interface) sehingga provider bisa diganti tanpa mengubah core workflow
- Konfigurasi provider: API key disimpan di environment variable, tidak di kode

---

## Template Pesan

### Siap Diambil (Lunas)
```
Halo Kak [nama konsumen] 👋

Pesanan Anda dengan nomor [order_code] sudah selesai dan siap diambil.

🖨️ Pesanan: [deskripsi produk]
📦 Jumlah: [quantity] pcs
✅ Status: SIAP DIAMBIL

Silakan datang ke percetakan untuk pengambilan pesanan.

Terima kasih 🙏
```

### Siap Diambil (Ada Sisa Tagihan)
```
Halo Kak [nama konsumen] 👋

Pesanan [order_code] sudah selesai dan tersimpan di percetakan.

🖨️ Pesanan: [deskripsi produk]
💳 Status pembayaran: MENUNGGU PELUNASAN

Pesanan dapat diambil setelah pelunasan sesuai ketentuan percetakan.
```

---

## Penanganan Kegagalan (Failure Handling)

### Jika WhatsApp Gagal Terkirim:

1. **Status order TIDAK BERUBAH** — order tetap READY_FOR_PICKUP
2. **Sistem mencatat kegagalan** di tabel `notification_events` dengan status FAILED + error message dari provider
3. **Notifikasi otomatis ke Admin Sales** muncul di dashboard (badge/alert merah)
4. **Email fallback** dikirim ke email Admin Sales dengan informasi:
   - Nama konsumen
   - Order code
   - Nomor HP konsumen (hanya untuk Admin, bukan untuk role lain)
   - Pesan yang gagal dikirim
   - Tombol "Kirim Ulang" di dashboard Admin
5. Admin dapat melakukan pengiriman ulang secara manual melalui tombol di sistem
6. Jika email Admin juga gagal: notifikasi dalam aplikasi (in-app alert) tetap tampil

### Retry Otomatis
- Sistem melakukan retry otomatis maksimal 3 kali dengan jeda 5 menit
- Jika setelah 3 retry masih gagal: sistem berhenti retry dan menunggu aksi manual Admin

---

## Aturan Duplikasi

- Event yang sama (READY_FOR_PICKUP untuk order X) tidak boleh mengirim duplikat pesan
- Resend hanya bisa dilakukan oleh Admin Sales atau Owner melalui tombol eksplisit di dashboard
- Setiap resend dicatat di `notification_events` dengan flag `is_resend: true`

---

## Privacy

Tidak boleh dikirim ke konsumen:
- Biaya produksi internal
- Nama pegawai
- Temuan audit internal
- Catatan bisnis sensitif
- Lokasi penyimpanan internal (RAK-3A-01 dll)

---

## Pencatatan

Simpan di `notification_events`:
- `order_id`
- `customer_id`
- `event_type` (READY_FOR_PICKUP / dll)
- `channel` (WHATSAPP / EMAIL_FALLBACK)
- `recipient` (phone atau email — tersimpan tapi tidak ditampilkan ke role biasa)
- `template_code`
- `status` (PENDING / SENT / FAILED / RETRY)
- `provider_message_id`
- `error_message`
- `sent_at`
- `is_resend`
- `resent_by` (user_id jika resend manual)
- `retry_count`
- `created_at`


==================================================
FILE: 03-ROLES/ADMIN-SALES.md
==================================================

# ADMIN SALES

Mengelola order, pembayaran, pickup, notifikasi WA konsumen, dan stok material masuk.

## Hak Akses
| Modul | Akses |
|-------|-------|
| Buat & edit order (DRAFT-CONFIRMED) | ✅ |
| Konfirmasi pembayaran DP & pelunasan | ✅ |
| Proses pickup konsumen | ✅ |
| Kirim ulang notifikasi WA yang gagal | ✅ |
| Konfirmasi approval desain (WA/Makloon) | ✅ |
| Input stok material masuk | ✅ |
| Tambah bahan material baru | ✅ |
| Ajukan diskon (pending approval Owner) | ✅ |
| Apply diskon langsung | ❌ |
| Lihat laporan keuangan | ✅ |
| Edit laporan keuangan | ❌ |
| Lihat nomor HP konsumen | ✅ |
| Cancel order (sebelum produksi) | ✅ |
| Cancel order (setelah produksi) | ❌ hanya Owner |
| **Lihat stok gudang (Storage LT3) real-time** | ✅ |
| **Submit hasil Final Audit (GREEN/YELLOW/RED)** | ✅ |
| **Lihat audit log (read-only)** | ✅ |

Semua aksi dicatat di audit log.


==================================================
FILE: 03-ROLES/DESIGNER-SALES.md
==================================================

﻿# DESIGNER SALES

Membuat desain, mengelola versi desain, dan memproses approval desain konsumen walk-in dan makloon.

## Hak Akses
| Modul | Akses |
|-------|-------|
| Buat order baru | ✅ |
| Upload file desain | ✅ |
| Approve desain walk-in & makloon | ✅ |
| Approve desain via WhatsApp | ❌ hanya Admin Sales |
| Lihat nomor HP / email konsumen | ❌ DILARANG |
| Lihat status order yang dibuat | ✅ |
| Lihat pembayaran / harga | ✅ (baca saja) |
| Edit harga order | ❌ |
| Akses laporan keuangan | ❌ |
| Akses laporan produksi | ❌ |

Semua aksi dicatat di audit log.


==================================================
FILE: 03-ROLES/FINISHING.md
==================================================

﻿# FINISHING STAFF

Memproses finishing barang (laminasi, potong, dll), mencetak label QR, dan menyerahkan ke warehouse.

## Hak Akses
| Modul | Akses |
|-------|-------|
| Lihat antrian job QC_PASSED | ✅ |
| Scan QR Job (mulai & selesai finishing) | ✅ |
| Cetak label QR untuk job | ✅ |
| Input actual qty finishing | ✅ |
| Lihat nama konsumen pada job | ✅ |
| Lihat nomor HP konsumen | ❌ |
| Akses laporan apapun | ❌ |

Semua aksi dicatat di audit log.


==================================================
FILE: 03-ROLES/OPERATOR.md
==================================================

﻿# OPERATOR

Menjalankan produksi di mesin, scan QR, dan input pemakaian material.

## Hak Akses
| Modul | Akses |
|-------|-------|
| Lihat job yang di-assign ke dirinya | ✅ |
| Scan QR Job (mulai & selesai produksi) | ✅ |
| Input actual qty & waste saat selesai | ✅ |
| Input pemakaian material per job | ✅ |
| Lihat spesifikasi produk pada job | ✅ |
| Lihat nama konsumen pada job | ✅ |
| Lihat nomor HP / email konsumen | ❌ |
| Lihat job operator lain | ❌ |
| Akses laporan apapun | ❌ |
| Input stok material masuk | ❌ |

Semua aksi dicatat di audit log.


==================================================
FILE: 03-ROLES/OWNER.md
==================================================

# OWNER — Role & Hak Akses

## Deskripsi

Owner adalah level akses tertinggi dalam sistem. Owner memiliki visibilitas penuh ke semua data dan semua modul, serta menjadi satu-satunya pihak yang bisa mengambil keputusan pada kondisi-kondisi kritis.

---

## Hak Akses Eksklusif Owner (Tidak Bisa Dilakukan Role Lain)

| Aksi | Keterangan |
|------|-----------|
| Approve / Reject rework setelah QC FAIL | |
| Approve cancel order yang produksi sudah berjalan | |
| Approve / Apply diskon ke order | |
| Freeze order (ON_HOLD) | |
| Hapus audit log (via panel khusus, tetap ada log penghapusan) | |
| Tambah catatan ke data absensi (tanpa mengubah data) | |
| Buat / nonaktifkan user | |
| Reset password user | |
| Override batas DP (bebas persentase) | |
| Approve/reject eskalasi rework setelah 2x QC FAIL berturut-turut (bukan rework ketiga — job yang gagal 2x rework wajib eskalasi ke Owner untuk keputusan lanjutan: rework ulang dengan izin khusus, atau batalkan/tangani sebagai kasus khusus) | |
| Unlock akun yang terkunci permanen (>3 kali terkunci dalam sehari) | |
| Export semua laporan | |

---

## Hak Akses Umum (Sama dengan Role Senior Lain)

- Lihat semua order, job, payment, storage
- Lihat audit log real-time
- Lihat laporan keuangan, produksi, material, pegawai
- Input stok material masuk
- Tambah bahan material baru

---

## Dashboard Owner

Widget yang tampil di halaman utama Owner:
1. KPI: Total order hari ini, Siap diambil, Produksi aktif, Omset bulan ini
2. Alert kritis (QC FAIL menunggu keputusan, cancel request, diskon request)
3. Order OVERDUE
4. WA gagal terkirim
5. Stok material menipis
6. Ringkasan absensi hari ini (berapa hadir, berapa terlambat)
7. Pipeline produksi (kanban mini per stage)
8. Antrian approval (rework, cancel, diskon)
9. Audit log 10 aksi terbaru

---

## Semua Aksi Owner Dicatat di Audit Log


==================================================
FILE: 03-ROLES/QC.md
==================================================

﻿# QC INSPECTOR

Melakukan inspeksi kualitas hasil produksi dan membuat keputusan PASS atau FAIL.

## Hak Akses
| Modul | Akses |
|-------|-------|
| Lihat antrian job QC_PENDING | ✅ |
| Submit hasil QC (PASS / FAIL) | ✅ |
| Upload foto defect | ✅ |
| Lihat riwayat QC yang pernah dilakukan | ✅ |
| Lihat nomor HP konsumen | ❌ |
| Approve rework | ❌ (hanya Owner/Supervisor) |
| Akses laporan keuangan | ❌ |

Semua aksi dicatat di audit log.


==================================================
FILE: 03-ROLES/SUPERVISOR.md
==================================================

# SUPERVISOR — Role & Hak Akses

## Deskripsi

Supervisor mengelola jalannya produksi harian. Bertanggung jawab atas kelancaran job dari assignment hingga QC, serta menjadi jembatan antara Owner dan tim operasional.

---

## Hak Akses Supervisor

| Modul | Akses |
|-------|-------|
| Semua order (lihat) | ✅ |
| Edit order | ❌ |
| Payment (lihat saja) | ✅ tanpa nominal detail |
| Assign job ke mesin & operator | ✅ |
| Reassign job | ✅ |
| Set status mesin MAINTENANCE | ✅ |
| Lihat antrian produksi semua mesin | ✅ |
| Lihat hasil QC | ✅ |
| Approve rework (level Supervisor) | ✅ untuk rework ke-1 dan ke-2 |
| Approve/reject eskalasi rework setelah 2x QC FAIL berturut-turut | ❌ hanya Owner (bukan rework ketiga — wajib eskalasi ke Owner) |
| Lihat laporan produksi | ✅ |
| Lihat laporan material | ✅ |
| Export laporan produksi | ✅ |
| Lihat data konsumen (phone/email) | ❌ |
| Audit log (lihat) | ✅ |
| Hapus audit log | ❌ |
| Buat user | ❌ hanya Owner |

---

## Dashboard Supervisor

1. Antrian job belum di-assign (badge orange)
2. Job sedang berjalan per mesin (progress real-time)
3. Antrian QC
4. QC FAIL yang perlu tindakan
5. Job overdue
6. Mesin yang MAINTENANCE
7. Job perlu reassign (operator tidak hadir)
8. Ringkasan produksi hari ini vs target

---

## Semua Aksi Supervisor Dicatat di Audit Log


==================================================
FILE: 03-ROLES/USER-MANAGEMENT.md
==================================================

# USER MANAGEMENT

## Prinsip Dasar

- Hanya **Owner** yang bisa membuat user baru dan mengubah role
- Sistem menggunakan RBAC (Role-Based Access Control)
- Setiap aksi user management dicatat di audit log

---

## Buat User Baru

**Siapa:** Hanya Owner

**Data yang diinput:**
- Nama lengkap
- Username (unik, untuk login)
- Email (opsional, untuk notifikasi sistem)
- Role (pilih dari daftar role yang ada)
- Status: Aktif / Nonaktif

**Setelah dibuat:**
- Sistem generate password sementara
- Owner memberikan password sementara ke pegawai secara langsung
- Pegawai wajib ganti password saat login pertama kali

---

## Ubah Role User

**Siapa:** Hanya Owner

**Aturan:**
- Role tidak bisa diubah jika user punya job/order yang sedang aktif (status IN_PROGRESS)
- Jika terpaksa ubah, Owner harus reassign job yang aktif dulu

---

## Nonaktifkan User

**Siapa:** Hanya Owner

**Yang terjadi saat nonaktifkan:**
- User tidak bisa login lagi
- Job yang sedang dikerjakan user tersebut muncul di dashboard Supervisor sebagai "Perlu Reassign"
- Semua data historis user tetap tersimpan (tidak dihapus)
- Nama user tetap muncul di riwayat job yang sudah selesai

**Aturan:** User tidak bisa dihapus permanen — hanya bisa dinonaktifkan.

---

## Reset Password

**Self-service:** Tidak ada — keamanan lebih diutamakan
**Cara reset:**
- Pegawai minta ke Owner
- Owner reset password dari panel user management
- Password baru diberikan langsung (offline), bukan via email
- Pegawai wajib ganti password setelah login

---

## Keamanan Login

- Batas salah password: **5 kali** sebelum akun terkunci sementara
- Terkunci selama: **15 menit** (otomatis, tidak perlu Owner unlock)
- Setelah 3 kali terkunci berturut-turut dalam sehari: Owner harus unlock manual
- Semua percobaan login dicatat di audit log (berhasil maupun gagal)

---

## Dashboard Supervisor — Tambahan

Supervisor melihat:
- Semua job yang sedang dalam antrian produksi
- Job yang belum di-assign ke operator
- Job yang overdue (melebihi deadline)
- Notifikasi QC FAIL yang butuh penjelasan
- Job yang perlu reassign (karena operator nonaktif)
- Tombol approve/reject rework dari Owner
- Summary produksi harian: target vs aktual

---

## Database

Tambahan field di tabel `users`:
```
failed_login_count     (reset setiap sukses login)
locked_until           (timestamp jika akun terkunci)
must_change_password   (boolean, true untuk user baru)
deactivated_at
deactivated_by
```


==================================================
FILE: 03-ROLES/WAREHOUSE.md
==================================================

﻿# WAREHOUSE STAFF

Mengelola penyimpanan barang di gudang LT3 dan penyerahan ke counter LT1.

## Hak Akses
| Modul | Akses |
|-------|-------|
| Scan QR Job (simpan ke storage) | ✅ |
| Scan QR Lokasi (konfirmasi lokasi) | ✅ |
| Lihat peta gudang LT3 | ✅ |
| Pindahkan barang ke counter LT1 | ✅ |
| Cari job di gudang | ✅ |
| Laporkan insiden (barang tidak ditemukan) | ✅ |
| Input stok material masuk | ✅ |
| Lihat nomor HP konsumen | ❌ |
| Proses pickup (serahkan ke konsumen) | ❌ hanya Admin Sales |
| Akses laporan keuangan | ❌ |

Semua aksi dicatat di audit log.


==================================================
FILE: 08-UI-UX/ADMIN-DASHBOARD.md
==================================================

# ADMIN DASHBOARD

Dashboard kerja harian untuk **Admin Sales**: order, pembayaran, approval desain via WA, notifikasi konsumen, dan pickup di counter. Mengacu ke `DESIGN-SYSTEM.md` untuk warna, status pill, dan gaya card.

---

## Widget Ringkasan (baris atas)

Card KPI ala Owner Dashboard (angka besar 36px/700), 6 card:

| Card | Isi |
|------|-----|
| Order Baru Hari Ini | Jumlah order status DRAFT dibuat hari ini |
| Menunggu Pembayaran | Order status WAITING_PAYMENT (badge kuning) |
| Siap Diambil | Order READY_FOR_PICKUP (badge hijau terang) |
| Overdue | Order OVERDUE (badge merah) |
| Notifikasi WA Gagal | Jumlah pesan gagal terkirim (badge merah) |
| Menunggu Approval Diskon | Diskon yang diajukan Admin, pending Owner (badge kuning) |

---

## Panel Prioritas (kanan/atas, sebelum tabel utama)

Panel-panel aksi cepat mengikuti pola mockup 05-ADMIN-SALES-DASHBOARD:

1. **Order Siap Diambil** — daftar ringkas order READY_FOR_PICKUP, tombol "Proses Pickup" per baris → membuka alur SCAN 8–10 (`13-QR-SCAN-FLOW.md`)
2. **Notifikasi WA Gagal** — daftar pesan gagal kirim, tombol "Kirim Ulang"
3. **Antrian Persetujuan Diskon** — order dengan diskon diajukan, status "Menunggu Owner" (read-only bagi Admin)
4. **Approval Desain via WA Menunggu Konfirmasi** — order tipe WhatsApp dengan preview desain terkirim ke konsumen, tombol "Konfirmasi Persetujuan via WA" (lihat `03-DESIGN-APPROVAL.md` Tipe 3)

---

## Tabel Utama — Daftar Order

Kolom tabel:

| Kolom | Keterangan |
|-------|-----------|
| Kode Order | `ORD-YYYYMMDD-XXXX` |
| Nama Konsumen | |
| Tipe Order | Walk-in / Makloon / WhatsApp / **RETAIL** |
| Status | Status pill sesuai `DESIGN-SYSTEM.md` |
| Status Pembayaran | Belum DP / DP Terpenuhi / Lunas |
| Total Order | |
| Sisa Tagihan | |
| Deadline | Highlight oranye jika besok, merah jika lewat |
| Dibuat Oleh | Admin Sales / Designer |
| Aksi | Lihat Detail, Konfirmasi Pembayaran, Proses Pickup (kondisional sesuai status) |

## Filter Tabel

- Status order (dropdown multi-select, sesuai daftar status pill)
- Tipe order (Walk-in / Makloon / WhatsApp / **RETAIL**)
- Tanggal order (dari–sampai)
- Nama konsumen (search)
- Kode order (search exact)
- Deadline (dari–sampai)
- Overdue only (toggle)
- Status pembayaran (Belum DP / Partial / Lunas)

---

## Aksi yang Bisa Dilakukan dari Dashboard

- Buat order baru (Walk-in / Makloon / WhatsApp)
- **Buka modul POS Kasir** (buat transaksi RETAIL barang jadi — tombol di pojok kanan atas bertuliskan "Kasir POS")
- Edit order (hanya status DRAFT / DESIGNING / WAITING_APPROVAL, sesuai `02-ORDER.md`)
- Konfirmasi penerimaan pembayaran (jumlah, metode, referensi, timestamp — lihat `04-PAYMENT.md`)
- Ajukan diskon (pending approval Owner) — tidak bisa apply langsung
- Kirim ulang notifikasi WA yang gagal
- Konfirmasi approval desain via WA (bukan Designer)
- Input stok material masuk, tambah bahan material baru
- Proses pickup konsumen: cari/scan order → verifikasi identitas & payment → serahkan barang (SCAN 8 & 10, warehouse yang mengonfirmasi barang sudah di counter pada SCAN 9)
- **Cek Stok Gudang Real-time** (melihat isi lokasi storage LT3)
- **Lakukan Final Audit Order** (submit hasil GREEN/YELLOW/RED sebelum order di-CLOSED)
- Cancel order (hanya sebelum produksi berjalan)
- Lihat nomor HP konsumen (khusus Admin Sales, tidak tampil di role lain)

## Yang Tidak Boleh Tampil

- Tombol apply diskon langsung (hanya ajukan)
- Tombol cancel order setelah produksi berjalan (hanya Owner)
- Edit laporan keuangan (hanya lihat)

---

## Panel Shortcut POS (Kasir)

Sebagai shortcut tambahan (bukan sub-halaman baru), di pojok kanan atas terdapat tombol **"Kasir POS"** yang membuka halaman `POS-DASHBOARD.md`. Panel ini bersifat terpisah dari daftar order PRINTING dan menangani seluruh siklus transaksi RETAIL.

---

## Panel Final Audit

Untuk melakukan aksi **Final Audit Order**, sistem menyediakan checklist (berupa modal atau halaman terpisah khusus Admin Sales) yang harus dilengkapi sebelum order bisa berstatus CLOSED:

- FINANCE: PASS/FAIL
- MATERIAL: PASS/FAIL
- QUANTITY: PASS/FAIL
- PRODUCTION: PASS/FAIL
- QC: PASS/FAIL
- FINISHING: PASS/FAIL
- STORAGE: PASS/FAIL
- NOTIFICATION: INFO (Riwayat notifikasi ditampilkan untuk operasional, tapi tidak menjadi bukti penerimaan mutlak oleh konsumen)
- PICKUP: PASS/FAIL

**Hasil Akhir:**
- **GREEN** = Semua PASS (langsung CLOSED)
- **YELLOW** = Approved variance (membutuhkan approval Supervisor/Owner)
- **RED** = Unresolved / Ada anomali (Order ditahan dan diinvestigasi)


==================================================
FILE: 08-UI-UX/DASHBOARD.md
==================================================

# Owner Dashboard

Dashboard visibilitas penuh untuk **Owner**: penjualan, produksi, gudang, keuangan, dan seluruh antrian approval kritis. Mengacu ke `DESIGN-SYSTEM.md` untuk warna, status pill, dan gaya card (glassmorphism, glow teal untuk item aktif).

---

## Widget Ringkasan (baris atas)

Card KPI angka besar (36px/700), sesuai `03-ROLES/OWNER.md`:

| Card | Isi |
|------|-----|
| Total Order Hari Ini | Jumlah order dibuat hari ini |
| Siap Diambil | Order READY_FOR_PICKUP |
| Produksi Aktif | Job berstatus PRODUCTION_STARTED / FINISHING_STARTED |
| Omset Bulan Ini | Total pendapatan (DP + pelunasan) bulan berjalan |

---

## Panel Alert Kritis (baris kedua, prioritas tinggi)

Ditampilkan dengan badge merah/oranye/kuning sesuai urgensi:

1. **QC FAIL Menunggu Keputusan** — job dengan rework tereskalasi (2x FAIL berturut) menunggu approve/reject Owner
2. **Permintaan Cancel Order** — cancel order yang produksi sudah berjalan, menunggu approve Owner
3. **Permintaan Diskon** — diskon diajukan Admin Sales, menunggu approve Owner
4. **Order OVERDUE** — daftar order lewat deadline (badge merah)
5. **Notifikasi WA Gagal Terkirim** — daftar pesan gagal, dengan status tindak lanjut Admin Sales
6. **Stok Material Menipis** — bahan dengan status 🔴 MENIPIS
7. **Anomali & Kecurangan** — waste tinggi (>20%), bahan keluar tanpa Job ID, adjustment tanpa alasan (dari `07-REPORTS/MATERIAL-REPORT.md` §4)

---

## Panel Operasional (baris tengah)

- **Pipeline Produksi** — kanban mini per stage (Produksi → QC → Finishing → Storage → Siap Diambil), jumlah job per stage
- **Ringkasan Absensi Hari Ini** — jumlah hadir, terlambat (ringkas, detail ada di Laporan Pegawai)
- **Antrian QC FAIL** — daftar job FAIL terbaru menunggu tindak lanjut

---

## Tabel Utama — Audit Log Terbaru

Widget "Audit log 10 aksi terbaru" langsung di dashboard, kolom:

| Kolom | Keterangan |
|-------|-----------|
| Waktu | |
| Pengguna | Nama + role |
| Aksi | |
| Entitas | Order / Job / Payment / User / dll |
| Detail | Ringkas, klik untuk detail lengkap |

Tombol "Lihat Semua Audit Log" mengarah ke halaman audit log penuh (real-time, tidak terbatas 10 baris).

## Filter (halaman Audit Log penuh)

- Rentang tanggal
- Pengguna / role
- Jenis aksi
- Entitas terkait (order/job/payment/user)

---

## Aksi yang Bisa Dilakukan dari Dashboard

- Approve/Reject rework setelah QC FAIL (termasuk eskalasi 2x FAIL berturut)
- Approve cancel order yang produksi sudah berjalan
- Approve/Apply diskon ke order
- Freeze order (ON_HOLD)
- Buat / nonaktifkan user, reset password
- Override batas DP (bebas persentase)
- Unlock akun terkunci permanen
- Export semua laporan (Keuangan, Produksi, Material, Pegawai, Harian, Bulanan) — lihat `07-REPORTS/`
- Hapus entri audit log via panel khusus (tetap tercatat log penghapusannya)
- Tambah catatan ke data absensi pegawai (tanpa mengubah data asli)

## Ringkasan Laporan Bulanan

Link cepat ke `07-REPORTS/MONTHLY-OWNER-REPORT.md` dan `07-REPORTS/FINANCIAL-REPORT.md` §3 "Laporan Bulanan Owner" untuk detail lengkap omset, piutang, produk terlaris, dan mesin tersibuk — dashboard hanya menampilkan ringkasan angka utama bulan berjalan.


==================================================
FILE: 08-UI-UX/DESIGN-SYSTEM.md
==================================================

# DESIGN SYSTEM — PrintFlow

## Identitas Visual

**Nama Sistem:** PrintFlow  
**Tagline:** Sistem Manajemen Percetakan Digital  
**Tema:** Dark Mode Premium (tidak ada light mode)  
**Feel:** Professional, modern, industrial — cocok untuk lingkungan percetakan

---

## Palet Warna

| Token | Hex | Digunakan untuk |
|-------|-----|----------------|
| `bg-base` | `#0F172A` | Background utama semua halaman |
| `bg-card` | `#1E293B` | Card, sidebar, panel |
| `bg-elevated` | `#2D3748` | Input, hover state |
| `accent-teal` | `#0EA5E9` | Aksi utama, CTA, menu aktif |
| `accent-purple` | `#7C3AED` | Highlight Owner, badge premium |
| `status-green` | `#10B981` | SELESAI, SIAP AMBIL, PASS |
| `status-yellow` | `#F59E0B` | MENUNGGU, peringatan |
| `status-orange` | `#F97316` | DEADLINE BESOK, PARTIAL |
| `status-red` | `#EF4444` | OVERDUE, FAIL, ERROR |
| `status-blue` | `#3B82F6` | PRODUKSI, AKTIF |
| `text-primary` | `#F8FAFC` | Teks utama |
| `text-muted` | `#94A3B8` | Label, placeholder |
| `border` | `#334155` | Garis pemisah |

---

## Tipografi

**Font:** Inter (Google Fonts)

| Elemen | Ukuran | Berat |
|--------|--------|-------|
| Logo/Nama Sistem | 24px | 700 |
| Judul Halaman | 28px | 700 |
| Judul Card | 18px | 600 |
| Body | 14px | 400 |
| Teks Kecil | 12px | 400 |
| Angka KPI | 36px | 700 |
| Badge/Pill | 11px | 600 |

---

## Status Pills

| Status | Label | Warna |
|--------|-------|-------|
| DRAFT | 📝 Draft | Abu-abu |
| DESIGNING | 🎨 Desain | Biru muda |
| WAITING_APPROVAL | ⏳ Menunggu Acc | Kuning |
| APPROVED | ✅ Disetujui | Hijau |
| WAITING_PAYMENT | 💳 Menunggu DP | Oranye |
| CONFIRMED | ✅ Konfirmasi | Hijau |
| PRODUCTION_STARTED | 🔵 Produksi | Biru |
| QC_PENDING | 🔍 QC | Kuning |
| QC_PASSED | ✅ QC Lulus | Hijau |
| QC_FAILED | ❌ QC Gagal | Merah |
| QC_REWORK_PENDING | 🔄 Menunggu Rework | Oranye gelap |
| FINISHING_STARTED | 🔧 Finishing | Ungu muda |
| READY_FOR_PICKUP | 📦 Siap Diambil | Hijau terang |
| PICKED_UP | ✅ Selesai | Hijau solid |
| OVERDUE | 🔴 Terlambat | Merah |
| ON_HOLD | ⏸️ Ditahan | Kuning gelap |
| CANCELLED | ✖️ Dibatalkan | Abu-abu gelap |
| INCIDENT | ⚠️ Insiden | Merah tua |
| CLOSED | 🔒 Ditutup | Ungu |

---

## Komponen UI

### Tombol
- **Primary:** Gradient teal-blue, rounded-full, tinggi 48px
- **Danger:** Gradient orange-red
- **Outline:** Border teal, bg transparent
- **Ghost:** Teks teal tanpa border

### Card
- Glassmorphism: `rgba(30,41,59,0.7)` + blur 12px + border `rgba(51,65,85,0.8)` + radius 16px
- Glow aktif: border teal 40% opacity
- Shadow: `0 4px 24px rgba(0,0,0,0.4)`

### Input
- Background: `bg-elevated`
- Border: `border` default, teal saat focused
- Error: border merah + teks error kecil

---

## Layout Grid

```
Desktop (1280px+):
  Sidebar: 240px fixed
  Content: flex-grow, max-width 1440px, padding 24px

Tablet (768px–1279px):
  Sidebar: 64px (icon only)
  Content: full width

Mobile (< 768px):
  Sidebar: hidden (hamburger menu)
  Content: full width, padding 16px
```

---

## Aturan UI Global

| Aturan | Ketentuan |
|--------|-----------|
| Nomor HP konsumen | Tidak pernah tampil kecuali di halaman khusus Admin |
| Tombol berbahaya | Selalu ada popup konfirmasi |
| Error message | Harus spesifik dan jelas dalam Bahasa Indonesia |
| Loading state | Wajib ada spinner/skeleton untuk setiap request |
| Tombol tidak diizinkan | Jangan tampilkan sama sekali (bukan disabled) |
| Mobile scan halaman | Responsif, minimum button height 56px |
| Feedback sukses | Toast hijau pojok kanan bawah |
| Sesi berakhir | Redirect login dengan pesan jelas |
| Bahasa | Semua Bahasa Indonesia natural |

---

## Breakpoints

| Perangkat | Lebar | Utama untuk |
|-----------|-------|------------|
| Mobile | 360–430px | Scan QR, Operator |
| Tablet | 768–1024px | Warehouse, QC |
| Desktop | 1280px+ | Owner, Admin, Designer |


==================================================
FILE: 08-UI-UX/DESIGNER-DASHBOARD.md
==================================================

# DESIGNER DASHBOARD

Dashboard kerja untuk **Designer Sales**: job desain yang di-assign, versi desain, dan proses approval — tanpa data finansial/internal cost yang tidak perlu. Mengacu ke `DESIGN-SYSTEM.md`.

---

## Widget Ringkasan (baris atas)

| Card | Isi |
|------|-----|
| Job Desain Aktif | Order dengan status DESIGNING yang di-assign ke Designer ini |
| Menunggu Approval | Order status WAITING_APPROVAL |
| Menunggu Revisi | Desain dengan permintaan revisi belum ditindaklanjuti |
| Disetujui Hari Ini | Desain APPROVED hari ini |

---

## Tabel Utama — Antrian Desain Saya

Kolom tabel:

| Kolom | Keterangan |
|-------|-----------|
| Kode Order | |
| Nama Konsumen | (identitas dasar untuk konteks kerja, bukan kontak) |
| Tipe Order | Walk-in / Makloon / WhatsApp |
| Produk | Ringkasan item order |
| Versi Desain Terakhir | V1, V2, V3... |
| Status Desain | DRAFT / DESIGNING / WAITING_APPROVAL / APPROVED (status pill) |
| Deadline | Highlight sesuai `DESIGN-SYSTEM.md` |
| Aksi | Upload versi baru, Tandai Disetujui, Lihat Riwayat Versi |

## Filter Tabel

- Status desain (dropdown)
- Tipe order (Walk-in / Makloon / WhatsApp)
- Tanggal order (dari–sampai)
- Kode order (search)
- Deadline (dari–sampai)

---

## Panel Detail Order (saat item dibuka)

- **Konteks Order** — produk, spesifikasi (ukuran, jumlah, bahan), deadline, catatan khusus
- **Riwayat Versi Desain** — daftar V1, V2, V3 dengan preview, uploader, timestamp, status approval per versi
- **Status Pembayaran** — hanya label "DP Terpenuhi / Belum Terpenuhi" (baca saja, tanpa nominal — sesuai `04-PAYMENT.md` "Aturan Tambahan")
- **Status Order** — posisi di alur (Desain → Pembayaran → Produksi → ...)

---

## Aksi yang Bisa Dilakukan dari Dashboard

- Buat order baru (mengisi produk, quantity, ukuran, bahan, finishing, deadline)
- Upload file/versi desain baru
- Tandai desain disetujui untuk konsumen **Walk-in** (approval lisan di hadapan konsumen — input nama versi, catatan, tanggal)
- Untuk **Makloon**: upload file print-ready dari konsumen, status otomatis APPROVED
- Untuk **WhatsApp**: upload preview desain — approval final tetap dilakukan Admin Sales, Designer hanya menunggu status berubah
- Catat permintaan revisi dan buat versi baru
- Lihat status order yang dibuat

## Yang Tidak Boleh Tampil

- Nomor HP / email konsumen (DILARANG total)
- Nominal harga/pembayaran detail (hanya status terpenuhi/belum)
- Edit harga order
- Akses laporan keuangan atau laporan produksi
- Approve desain via WhatsApp (hanya Admin Sales yang berwenang, Designer hanya upload preview)


==================================================
FILE: 08-UI-UX/FINISHING-DASHBOARD.md
==================================================

# FINISHING DASHBOARD

Dashboard kerja untuk **Finishing Staff**: antrian job QC_PASSED, scan QR mulai/selesai finishing, dan cetak label QR sebelum diserahkan ke warehouse. Digunakan di tablet/HP area finishing, mengacu ke `DESIGN-SYSTEM.md`.

---

## Widget Ringkasan (baris atas)

| Card | Isi |
|------|-----|
| Menunggu Finishing | Job berstatus QC_PASSED belum dimulai |
| Sedang Dikerjakan | Job berstatus FINISHING_STARTED |
| Selesai Hari Ini | Job FINISHING_COMPLETE hari ini |
| Label Tercetak Hari Ini | Jumlah label yang sudah dicetak |

---

## Tabel Utama — Antrian Job QC_PASSED

| Kolom | Keterangan |
|-------|-----------|
| Kode Job | |
| Kode Order | |
| Nama Produk | |
| Jenis Finishing | Laminasi / Potong / Welding / dll sesuai order |
| Qty | |
| Lulus QC Pukul | |
| Deadline | Highlight sesuai `DESIGN-SYSTEM.md` |
| Aksi | Scan Mulai Finishing |

## Filter

- Jenis finishing
- Deadline (dari–sampai)
- Urutkan: paling lama menunggu / deadline terdekat

---

## Panel Job Aktif (Finishing Berjalan)

- Kode job, produk, spesifikasi finishing
- Waktu mulai finishing
- Tombol "Selesai Finishing"

## Form Selesai Finishing (SCAN 5)

- Actual quantity finishing
- Notes
- Setelah submit: sistem tampilkan **preview label** untuk dicetak (nama perusahaan, Job QR besar, Job Code + Order Code, nama konsumen tanpa nomor HP, deskripsi produk singkat, jumlah)
- Tombol "CETAK LABEL" → kirim ke printer terhubung
- Konfirmasi label sudah ditempel ke barang fisik

---

## Tabel — Riwayat Finishing Saya

| Kolom | Keterangan |
|-------|-----------|
| Kode Job | |
| Tanggal | |
| Qty Selesai | |
| Durasi Finishing | |
| Status Label | Tercetak / Belum |
| Status Job | FINISHING_COMPLETE / diserahkan ke Warehouse |

## Filter Riwayat

- Rentang tanggal
- Kode job / order (search)

---

## Alur Kerja

QC PASS -> Scan Job QR (Mulai Finishing, SCAN 4) -> Proses fisik (laminasi/potong/dll) -> Scan Job QR (Selesai Finishing, SCAN 5) -> Cetak & tempel label -> Serahkan ke Warehouse untuk disimpan (SCAN 6–7)

> Finishing selesai saja belum membuat order siap diambil — status baru berubah menjadi READY_FOR_PICKUP setelah barang berhasil discan masuk ke lokasi storage oleh Warehouse Staff.

---

## Aksi yang Bisa Dilakukan dari Dashboard

- Lihat antrian job QC_PASSED
- Scan QR Job (mulai & selesai finishing)
- Cetak label QR untuk job
- Input actual qty finishing
- Lihat nama konsumen pada job

## Yang Tidak Boleh Tampil

- Nomor HP konsumen
- Akses laporan apapun
- Label tidak boleh mencantumkan nomor HP konsumen


==================================================
FILE: 08-UI-UX/OPERATOR-DASHBOARD.md
==================================================

# OPERATOR DASHBOARD

Dashboard mobile untuk **Operator Mesin**: job yang di-assign, scan QR mulai/selesai produksi, dan input pemakaian material/waste. Layout mengikuti breakpoint Mobile (360–430px) di `DESIGN-SYSTEM.md`, tombol besar minimum tinggi 56px.

---

## Widget Ringkasan (baris atas)

| Card | Isi |
|------|-----|
| Job Aktif Saya | Job berstatus PRODUCTION_STARTED yang sedang dikerjakan (dengan timer berjalan) |
| Antrian Job Berikutnya | Job PRODUCTION_ASSIGNED menunggu dikerjakan |
| Selesai Hari Ini | Jumlah job PRODUCTION_COMPLETE hari ini |
| Total Waste Hari Ini | Akumulasi waste dari job yang diselesaikan |

---

## Aksi Utama (tombol besar, sesuai mockup 06-OPERATOR-DASHBOARD)

- **SCAN QR MULAI JOB** — scan Job QR → tampilkan produk, spesifikasi, qty, deadline → konfirmasi "MULAI PRODUKSI" (SCAN 1, lihat `13-QR-SCAN-FLOW.md`)
- **SELESAI PRODUKSI** — untuk job aktif: scan Job QR → form actual qty, waste qty (+ alasan wajib jika > 0), notes → submit (SCAN 2)

---

## Panel Job Aktif

Saat ada job PRODUCTION_STARTED:
- Nama produk + spesifikasi ringkas
- Mesin yang digunakan
- Quantity target
- Deadline
- Timer berjalan (durasi sejak `actual_start`)
- Tombol "Selesai Produksi"

---

## Tabel / List — Antrian Job Berikutnya

Kolom (list card, bukan tabel padat — sesuai gaya mobile):

| Kolom | Keterangan |
|-------|-----------|
| Kode Job | |
| Nama Produk | Spesifikasi ringkas |
| Mesin | |
| Jumlah Target | |
| Deadline | Highlight oranye/merah sesuai urgensi |
| Status | PRODUCTION_ASSIGNED (status pill biru) |

## Filter

- Hanya menampilkan job yang di-assign ke Operator yang login (tidak bisa lihat job operator lain)
- Toggle: Semua / Hanya Deadline Hari Ini / Overdue

---

## Form Input Selesai Produksi

- Actual quantity (wajib, tidak boleh 0)
- Waste quantity (wajib isi alasan jika > 0)
- Notes (opsional)

---

## Aksi yang Bisa Dilakukan dari Dashboard

- Lihat job yang di-assign ke dirinya sendiri
- Scan QR Job untuk mulai & selesai produksi
- Input actual qty & waste saat selesai
- Input pemakaian material per job
- Lihat spesifikasi produk dan nama konsumen pada job

## Yang Tidak Boleh Tampil

- Nomor HP / email konsumen
- Job milik operator lain
- Laporan apapun (produksi, keuangan, dll)
- Input stok material masuk (hanya pemakaian per job, bukan stok masuk)


==================================================
FILE: 08-UI-UX/POS-DASHBOARD.md
==================================================

# POS (Point of Sale) Dashboard

Modul Kasir Cepat (Direct Sales) dirancang khusus untuk mempercepat penjualan barang retail/ready stock tanpa melalui alur printing.

## 1. Antarmuka Utama (Single Page Checkout)
- **Katalog Produk:** Grid atau list produk retail dengan foto, nama, sisa stok, dan harga.
- **Barcode Scanner Input:** Input field tersembunyi/fokus otomatis untuk menangkap input dari alat scanner barcode. Jika terscan, item langsung masuk ke keranjang.
- **Keranjang Belanja (Cart):** Daftar item yang akan dibeli. Bisa mengatur kuantitas, atau menghapus item.
- **Total Pembayaran:** Ringkasan subtotal, diskon (jika ada), dan total akhir.
- **Metode Pembayaran:** Tombol cepat untuk memilih "TUNAI" atau "QRIS".

## 2. Proses Checkout
- Jika dibayar TUNAI, muncul modal kalkulator kembalian (uang diterima, kembalian).
- Jika dibayar QRIS, muncul modal menampilkan QR Code atau input referensi.
- Setelah sukses: Muncul notifikasi "Pembayaran Berhasil" dan opsi cetak struk (Receipt) menggunakan thermal printer, lalu halaman langsung reset ke kondisi awal untuk pelanggan berikutnya.

## 3. Manajemen Stok (Inventory)
- Tab atau menu sekunder untuk melihat daftar barang retail.
- Opsi untuk "Tambah Stok Masuk" (IN) atau "Penyesuaian Stok" (ADJUSTMENT).
- Hanya bisa diakses oleh Supervisor/Admin/Owner, atau kasir yang diberi hak akses.

## 4. Riwayat Transaksi Retail
- Daftar pesanan khusus tipe `RETAIL` yang sudah `CLOSED`.
- Bisa mencetak ulang struk jika pelanggan meminta.


==================================================
FILE: 08-UI-UX/QC-DASHBOARD.md
==================================================

# QC DASHBOARD

Dashboard kerja untuk **QC Inspector**: antrian job menunggu inspeksi, form PASS/FAIL, dan riwayat inspeksi. Digunakan di tablet/HP area QC, mengacu ke `DESIGN-SYSTEM.md`.

---

## Widget Ringkasan (baris atas)

| Card | Isi |
|------|-----|
| Menunggu Inspeksi | Job berstatus PRODUCTION_COMPLETE (QC_PENDING) |
| Diperiksa Hari Ini | Jumlah job yang sudah di-QC hari ini |
| PASS Hari Ini | Jumlah hasil PASS hari ini (badge hijau) |
| FAIL Hari Ini | Jumlah hasil FAIL hari ini (badge merah) |

---

## Tabel Utama — Antrian Job QC_PENDING

| Kolom | Keterangan |
|-------|-----------|
| Kode Job | |
| Kode Order | |
| Nama Produk | Spesifikasi ringkas (ukuran, jumlah, finishing) |
| Mesin | |
| Operator | |
| Selesai Produksi Pukul | `actual_end` |
| Deadline | Highlight sesuai `DESIGN-SYSTEM.md` |
| Aksi | Scan / Buka Form QC |

## Filter

- Mesin
- Deadline (dari–sampai)
- Urutkan: paling lama menunggu / deadline terdekat

---

## Form Input QC (setelah scan Job QR — SCAN 3)

Checklist inspeksi, tiap poin diberi status OK / MASALAH MINOR / MASALAH MAYOR:

| Item Checklist | |
|---|---|
| Jumlah (quantity vs planned) | |
| Ukuran (size sesuai order) | |
| Warna (color accuracy) | |
| Kualitas cetak (bintik, blur, stripe) | |
| Defect fisik (sobek, kotor, lipatan) | |
| Finishing (laminating, cutting, welding sesuai order) | |

- Hasil akhir: **PASS** atau **FAIL** (tombol besar)
- Jika FAIL wajib: kategori masalah, deskripsi (min 20 karakter), upload foto defect, rekomendasi (rework/reprint/eskalasi)
- Catatan wajib diisi jika ada item MASALAH MINOR/MAYOR

---

## Tabel — Riwayat Inspeksi Saya

| Kolom | Keterangan |
|-------|-----------|
| Kode Job | |
| Tanggal Inspeksi | |
| Hasil | PASS / FAIL (status pill) |
| Kategori Masalah | (jika FAIL) |
| Rework Ke- | |
| Status Tindak Lanjut | Menunggu Keputusan / Rework Disetujui / Reprint |

## Filter Riwayat

- Rentang tanggal
- Hasil (PASS / FAIL)
- Kode job / order (search)

---

## Aksi yang Bisa Dilakukan dari Dashboard

- Lihat antrian job QC_PENDING
- Scan Job QR untuk buka form QC
- Submit hasil QC (PASS / FAIL)
- Upload foto defect
- Lihat riwayat QC yang pernah dilakukan sendiri

## Yang Tidak Boleh Tampil

- Nomor HP konsumen
- Tombol approve rework (hanya Owner/Supervisor)
- Akses laporan keuangan


==================================================
FILE: 08-UI-UX/SUPERVISOR-DASHBOARD.md
==================================================

# SUPERVISOR DASHBOARD

Dashboard operasional harian untuk **Supervisor**: assignment job produksi, pemantauan antrian mesin, approval rework level Supervisor, dan ringkasan produksi/material/keuangan (tanpa detail nominal). Mengacu ke `DESIGN-SYSTEM.md`.

---

## Widget Ringkasan (baris atas)

| Card | Isi |
|------|-----|
| Job Belum Di-assign | Job CONFIRMED menunggu assignment ke mesin/operator (badge oranye) |
| Job Sedang Berjalan | Job berstatus PRODUCTION_STARTED di semua mesin |
| Antrian QC | Job PRODUCTION_COMPLETE menunggu QC |
| QC FAIL Perlu Tindakan | Job FAIL menunggu penjelasan/rework |
| Mesin Maintenance | Jumlah mesin berstatus MAINTENANCE |
| Job Overdue | Job dengan deadline lewat |

---

## Panel Produksi per Mesin

Kanban/board per mesin: kolom mesin, isi kartu job (kode job, produk, operator, progress, estimasi selesai). Mesin MAINTENANCE ditandai dengan card abu-abu/nonaktif.

## Panel Reassignment

Daftar job yang butuh reassign (operator tidak hadir / mesin maintenance mendadak), tombol "Reassign" per baris.

---

## Tabel Utama — Antrian Job Produksi

| Kolom | Keterangan |
|-------|-----------|
| Kode Job | |
| Kode Order | |
| Nama Produk | |
| Mesin | |
| Operator | |
| Status | Status pill (PRODUCTION_ASSIGNED / STARTED / COMPLETE / dst) |
| Qty Target | |
| Deadline | Highlight sesuai `DESIGN-SYSTEM.md` |
| Aksi | Assign, Reassign, Set Mesin Maintenance |

## Filter

- Mesin (dropdown)
- Status job
- Operator
- Deadline (dari–sampai)
- Overdue only (toggle)

---

## Panel QC & Rework

| Kolom | Keterangan |
|-------|-----------|
| Kode Job | |
| Hasil QC | PASS / FAIL |
| Kategori Masalah | (jika FAIL) |
| Rework Ke- | 0 / 1 / 2 |
| Aksi | Approve Rework (hanya rework ke-1 dan ke-2), Lihat Detail |

> Rework ke-3 (setelah 2x FAIL berturut) wajib eskalasi ke Owner — tombol approve tidak tampil untuk kasus ini.

---

## Panel Ringkasan Material & Keuangan (ringkas, tanpa nominal detail)

- Stok material dengan status 🔴 MENIPIS
- Ringkasan produksi hari ini vs target
- Status pembayaran order (label saja, tanpa nominal detail) — sesuai batasan akses Supervisor di `03-ROLES/SUPERVISOR.md`

---

## Aksi yang Bisa Dilakukan dari Dashboard

- Assign job ke mesin & operator, reassign job
- Set status mesin MAINTENANCE
- Lihat antrian produksi semua mesin dan hasil QC
- Approve rework level Supervisor (rework ke-1 dan ke-2)
- Lihat & export laporan produksi dan laporan material
- Lihat audit log (read-only)

## Yang Tidak Boleh Tampil

- Edit order
- Nominal payment detail (hanya status)
- Data konsumen (phone/email)
- Approve/reject eskalasi rework setelah 2x FAIL berturut (hanya Owner)
- Hapus audit log
- Buat user baru


==================================================
FILE: 08-UI-UX/WAREHOUSE-DASHBOARD.md
==================================================

# Warehouse Dashboard

Dashboard tablet untuk **Warehouse Staff**: penyimpanan barang jadi di gudang LT3, penyerahan barang ke counter LT1, dan pemantauan stok material. Layout mengikuti breakpoint Tablet (768–1024px) di `DESIGN-SYSTEM.md`.

---

## Widget Ringkasan (baris atas)

| Card | Isi |
|------|-----|
| Menunggu Disimpan | Job FINISHING_COMPLETE belum tersimpan di lokasi |
| Slot Terisi | Jumlah slot storage terpakai dari total kapasitas |
| Zona Hampir Penuh | Jumlah zona dengan status merah (penuh) |
| Barang Dipindah ke Counter Hari Ini | Jumlah job yang dikonfirmasi sampai di counter (SCAN 9) |

---

## Tombol Aksi Besar

- **SIMPAN JOB** — Scan Job QR → Scan Location QR → Confirm quantity → Store (SCAN 6–7, lihat `13-QR-SCAN-FLOW.md`)
- **CARI JOB** — Scan Job QR / cari manual → tampilkan lokasi saat ini & status
- **SCAN QR** — akses cepat kamera scan (Job QR atau Location QR)
- **PINDAH KE COUNTER** — konfirmasi barang dibawa dari gudang LT3 ke counter LT1 (SCAN 9)
- **RECEIVE / ISSUE MATERIAL** — input stok material masuk

---

## Tabel Utama — Daftar Barang Menunggu Disimpan

| Kolom | Keterangan |
|-------|-----------|
| Kode Job | |
| Kode Order | |
| Nama Produk | |
| Jumlah | |
| Status Finishing | FINISHING_COMPLETE (status pill) |
| Waktu Selesai Finishing | |
| Aksi | Simpan ke Gudang |

## Peta Gudang Visual

Peta per zona (grid rak): 🟢 kosong, 🔵 terisi, 🔴 penuh. Klik slot menampilkan popup info (Job Code, produk, tanggal simpan).

## Filter

- Zona / rak
- Status slot (Kosong / Terisi / Penuh)
- Kode job / order (search)

---

## Alur Kerja

### Store Job
Scan Job QR -> Scan Location QR -> Confirm quantity -> Store (status → READY_FOR_PICKUP, trigger notifikasi WA otomatis)

### Find Job
Scan Job QR -> tampilkan lokasi saat ini -> tampilkan status

### Konfirmasi ke Counter (Pickup)
Scan Job QR barang yang dibawa dari LT3 -> catat "sudah di counter" -> Admin Sales lanjut verifikasi identitas & payment -> Release final oleh Admin Sales (lihat `10-PICKUP-DELIVERY.md`, Warehouse Staff tidak melakukan release final)

---

## Aksi yang Bisa Dilakukan dari Dashboard

- Scan QR Job (simpan ke storage), Scan QR Lokasi (konfirmasi lokasi)
- Lihat peta gudang LT3
- Pindahkan barang ke counter LT1
- Cari job di gudang
- Laporkan insiden (barang tidak ditemukan)
- Input stok material masuk

## Yang Tidak Boleh Tampil

- Nomor HP konsumen
- Tombol proses pickup / release final (hanya Admin Sales)
- Akses laporan keuangan

Warehouse must never need to manually search through piles of paper to find finished goods.


==================================================
FILE: 08-UI-UX/MOCKUPS/MOCKUPS-README.md
==================================================

# 🎨 UI/UX Mockups — PrintFlow
> Semua file gambar ada di folder ini: `08-UI-UX/MOCKUPS/`

---

## 01 — Halaman Login

![Login Page](./01-LOGIN.png)

**Konsep:** Split screen. Kiri: logo + tagline di background navy gelap. Kanan: card glassmorphism dengan form login, tombol "Masuk" gradient teal.

---

## 02 — Owner Dashboard

![Owner Dashboard](./02-OWNER-DASHBOARD.png)

**Elemen:** 4 KPI card (Total Order, Siap Diambil, Produksi Aktif, Omset), panel Order Hampir Deadline, panel Anomali & Kecurangan, pipeline produksi, antrian QC FAIL merah.

---

## 03 — Manajemen Order

![Order Management](./03-ORDER-MANAGEMENT.png)

**Elemen:** Filter chip (Semua/Draft/Produksi/Siap Ambil/Selesai), baris OVERDUE merah, baris Deadline Besok oranye, status pills per baris, mini stats panel kanan.

---

## 04 — Detail Order & Workflow Stepper

![Order Detail](./04-ORDER-DETAIL.png)

**Elemen:** Stepper 7 langkah (Desain→Pembayaran→Produksi→QC→Finishing→Gudang→Selesai), 3 panel info (Detail Produk, Status Pembayaran, Progress Produksi), riwayat aktivitas dengan timestamp.

---

## 05 — Admin Sales Dashboard

![Admin Sales Dashboard](./05-ADMIN-SALES-DASHBOARD.png)

**Elemen:** Order Siap Diambil (hijau, tombol Proses Pickup), Notifikasi WA Gagal (merah, tombol Kirim Ulang), Order Baru/Draft tabel, Antrian Persetujuan Diskon (menunggu Owner).

---

## 06 — Operator Dashboard (Mobile)

![Operator Dashboard](./06-OPERATOR-DASHBOARD.png)

**Elemen:** Tombol besar "SCAN QR MULAI JOB", job aktif dengan timer (02:34:15), tombol Selesai Produksi, antrian job berikutnya, form input waste.

---

## 07 — Warehouse Dashboard (Tablet)

![Warehouse Dashboard](./07-WAREHOUSE-DASHBOARD.png)

**Elemen:** 4 tombol besar (SIMPAN JOB / CARI JOB / SCAN QR / PINDAH KE COUNTER), daftar barang menunggu disimpan, peta gudang visual per zona (hijau=kosong, biru=terisi, merah=penuh), popup info saat klik slot.

---

## 08 — Scan QR (HP / Mobile Browser)

![QR Scan Mobile](./08-QR-SCAN-MOBILE.png)

**Elemen:** Kamera aktif dengan bracket sudut teal, garis scan bergerak, info mode scan, hasil scan muncul sebagai card (nama produk, qty, status), tombol besar "Scan Lokasi Penyimpanan" dan "Batal".

---

## Catatan untuk Tim Frontend

- Semua gambar di atas adalah referensi desain — bukan final pixel-perfect
- Warna, ukuran, dan layout mengacu ke `DESIGN-SYSTEM.md` di folder yang sama
- Gambar bisa dibuka langsung dari folder `MOCKUPS/` untuk zoom in detail
- Jika ada perubahan desain, buat versi baru di folder yang sama dengan nama `XX-NAMA-v2.png`


==================================================
FILE: 09-TECHNICAL/ACCEPTANCE-CRITERIA.md
==================================================

# ACCEPTANCE CRITERIA — Checklist Pengujian Per Modul

## Apa Ini?

Daftar kondisi yang harus **TERPENUHI** sebelum sistem dinyatakan siap digunakan.
Gunakan dokumen ini sebagai checklist saat testing sebelum sistem diserahkan untuk dipakai.

---

## Modul 1 — Authentication & User

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 1.1 | Login dengan username & password benar | Berhasil masuk, diarahkan ke dashboard sesuai role |
| 1.2 | Login dengan password salah 5 kali | Akun terkunci 15 menit, muncul pesan error |
| 1.3 | Login sebagai Designer, coba akses menu Payment | Ditolak, muncul pesan "Akses Ditolak" |
| 1.4 | Owner buat user baru | User tersimpan, bisa login dengan password sementara |
| 1.5 | Owner nonaktifkan user | User tidak bisa login |
| 1.6 | User baru login pertama kali | Sistem paksa ganti password |

---

## Modul 2 — Data Konsumen (Keamanan)

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 2.1 | Designer buka halaman detail order | Nama konsumen tampil, nomor HP **tidak tampil sama sekali** |
| 2.2 | API response untuk Designer yang request data konsumen | Field `phone` dan `email` **tidak ada** dalam JSON response |
| 2.3 | Admin Sales buka halaman detail order | Nama + nomor HP tampil normal |
| 2.4 | Operator buka halaman job | Nama konsumen tampil, nomor HP tidak tampil |

---

## Modul 3 — Order

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 3.1 | Buat order baru dengan semua field wajib | Order tersimpan dengan status DRAFT |
| 3.2 | Coba buat order tanpa Customer ID | Sistem menolak, tampil error validasi |
| 3.3 | Order code format | Format `ORD-YYYYMMDD-XXXX` terbentuk otomatis |
| 3.4 | Dua order dibuat di hari yang sama | Urutan bertambah: 0001, 0002 |

---

## Modul 4 — Approval Desain

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 4.1 | Designer approve desain walk-in | Status desain → APPROVED, method: WALK_IN |
| 4.2 | Admin Sales konfirmasi approval WA | Status desain → APPROVED, method: WHATSAPP |
| 4.3 | Makloon: file diupload | Status desain → APPROVED otomatis, method: MAKLOON |
| 4.4 | Coba kirim order ke produksi tanpa desain APPROVED | Sistem menolak |

---

## Modul 5 — Payment & DP

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 5.1 | Order walk-in, DP < 50% | Tidak bisa lanjut ke produksi |
| 5.2 | Admin Sales coba apply diskon tanpa Owner | Tombol apply diskon tidak ada, hanya tombol "Ajukan" |
| 5.3 | Owner apply diskon | Harga order berubah, audit log tercatat |
| 5.4 | Designer coba konfirmasi payment | Tidak ada akses/tombol, ditolak server-side |

---

## Modul 6 — Produksi & QR

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 6.1 | Operator scan Job QR di browser HP | Kamera terbuka, QR terdeteksi, halaman job terbuka |
| 6.2 | Operator yang bukan di-assign scan Job QR | Muncul error "Anda tidak di-assign ke job ini" |
| 6.3 | Scan Job QR yang status bukan PRODUCTION_ASSIGNED | Tombol "Mulai Produksi" tidak tampil |
| 6.4 | Operator submit selesai tanpa isi actual_qty | Sistem menolak |
| 6.5 | Operator input waste > 0 tanpa alasan | Sistem menolak |

---

## Modul 7 — QC

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 7.1 | QC Inspector submit FAIL tanpa foto/keterangan | Sistem menolak (keterangan wajib) |
| 7.2 | QC FAIL | Notifikasi muncul di dashboard Owner dan Supervisor |
| 7.3 | Owner approve rework | Status → REWORK_APPROVED, operator bisa mulai ulang |
| 7.4 | Job sudah 2x rework, QC FAIL lagi | Sistem blokir rework ke-3, tampil eskalasi ke Owner |

---

## Modul 8 — Storage & Scan

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 8.1 | Scan Job QR (SCAN 6) saat status bukan FINISHING_COMPLETE | Sistem menolak aksi simpan |
| 8.2 | Scan Location QR slot yang sudah penuh | Sistem menolak, tampil error "Lokasi penuh" |
| 8.3 | Setelah SCAN 7 berhasil | Status → READY_FOR_PICKUP, WA dikirim otomatis |
| 8.4 | WA gagal terkirim | Status order tidak berubah, admin dapat alert merah |

---

## Modul 9 — Pickup & Release

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 9.1 | Admin Sales scan Job QR saat pickup | Tampil nama konsumen, status payment, lokasi gudang |
| 9.2 | Coba release dengan sisa payment tanpa override Owner | Sistem menolak |
| 9.3 | Admin Sales berhasil release | Status → PICKED_UP, storage item dilepas |
| 9.4 | Coba release job yang sama dua kali | Sistem menolak "Sudah di-release" |

---

## Modul 10 — Deadline & Notifikasi

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 10.1 | Order dengan deadline besok, belum selesai | Badge kuning "⚠ Deadline Besok" muncul di dashboard |
| 10.2 | Order melewati deadline, belum selesai | Badge merah "🔴 OVERDUE" muncul |
| 10.3 | Order selesai sebelum deadline | Badge peringatan hilang |

---

## Modul 11 — Cancel

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 11.1 | Cancel order sebelum produksi | Bisa dilakukan Admin Sales, DP bisa dikembalikan |
| 11.2 | Cancel order saat produksi sudah berjalan | Harus tunggu approval Owner, DP hangus |
| 11.3 | Admin Sales coba cancel order yang sudah produksi tanpa Owner | Tombol langsung cancel tidak ada, hanya "Ajukan Cancel" |

---

## Modul 12 — Audit & Laporan

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 12.1 | Semua aksi kritis dilakukan | Masing-masing muncul di audit log dengan detail lengkap |
| 12.2 | Admin Sales coba hapus audit log | Tidak ada tombol hapus, API DELETE ditolak |
| 12.3 | Owner ekspor laporan | File PDF/XLSX berhasil diunduh, ada catatan di audit log |
| 12.4 | Operator coba edit data order | Ditolak, operator hanya bisa update job |


==================================================
FILE: 09-TECHNICAL/API.md
==================================================

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
| `GET /api/storage/locations` | Peta lokasi storage + kapasitas | Warehouse, Supervisor, Owner, Admin Sales |
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
| `GET /api/audit-logs` | Baca audit log (filter: actor, entity, tanggal, action) | Supervisor, Owner, Admin Sales (read-only) |
| `DELETE /api/audit-logs/:id` | Hapus audit log (panel khusus, penghapusan sendiri tercatat) | Owner saja |
| `GET /api/orders/:id/final-audit` | Detail final audit order | Admin Sales, Owner, Supervisor |
| `POST /api/orders/:id/final-audit` | Submit hasil final audit (GREEN/YELLOW/RED) | Admin Sales |
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

## RETAIL POS (Direct Sales)

Endpoint untuk modul Kasir Cepat / Penjualan Langsung barang retail (order_type = RETAIL).
State machine RETAIL: `NEW_RETAIL_ORDER → RETAIL_PAYMENT_COMPLETED → CLOSED` (lihat `09-TECHNICAL/STATUS-MACHINE.md`).

| Endpoint | Deskripsi | Role |
|----------|-----------|------|
| `GET /api/retail-products` | Daftar katalog produk retail (nama, SKU, stok, harga) | Admin Sales, Owner |
| `POST /api/retail-products` | Tambah produk retail baru | Admin Sales, Owner |
| `PATCH /api/retail-products/:id` | Edit produk retail (nama, harga, kategori) | Admin Sales, Owner |
| `PATCH /api/retail-products/:id/deactivate` | Nonaktifkan produk retail | Admin Sales, Owner |
| `GET /api/retail-products/:id/movements` | Riwayat mutasi stok produk retail | Admin Sales, Owner |
| `POST /api/retail-products/:id/movements` | Input stok masuk / adjustment stok retail (movement_type: IN/ADJUSTMENT) | Admin Sales, Owner |
| `POST /api/retail/orders` | Buat transaksi RETAIL baru (pilih produk + qty, customer opsional) — status awal `NEW_RETAIL_ORDER` | Admin Sales, Owner |
| `GET /api/retail/orders` | Daftar transaksi RETAIL (filter: tanggal, status, kasir) | Admin Sales, Owner |
| `GET /api/retail/orders/:id` | Detail transaksi RETAIL | Admin Sales, Owner |
| `POST /api/retail/orders/:id/payment` | Konfirmasi pembayaran RETAIL (method: CASH/QRIS) — memicu pemotongan stok otomatis & status → `RETAIL_PAYMENT_COMPLETED` | Admin Sales, Owner |
| `POST /api/retail/orders/:id/close` | Tutup transaksi RETAIL setelah barang diserahkan — status → `CLOSED` | Admin Sales, Owner |
| `POST /api/retail/orders/:id/cancel` | Batalkan transaksi RETAIL (hanya sebelum `RETAIL_PAYMENT_COMPLETED`) | Admin Sales, Owner |
| `GET /api/reports/retail` | Laporan penjualan retail (harian/bulanan, per produk) | Admin Sales, Owner |

**Catatan:**
- Pemotongan `retail_products.stock_quantity` dan pencatatan `retail_stock_movements` dilakukan secara atomik dalam satu transaksi DB saat `RETAIL_PAYMENT_COMPLETED`.
- Jika stok tidak mencukupi (stock_quantity < qty yang diminta), sistem mengembalikan `409 CONFLICT` — kasir harus melakukan adjustment stok dulu.
- Transaksi RETAIL dicatat di `audit_logs` sama seperti transaksi PRINTING.

---

## Catatan Implementasi

- Semua endpoint yang menerima input numerik (qty, harga, waste) divalidasi terhadap aturan di `09-TECHNICAL/VALIDATION-RULES.md` sebelum menyentuh database.
- Endpoint scan (`/scan/*`, `/storage/*confirm*`) menerima `job_code` atau `location_code` sebagai identitas — QR hanya membawa identitas, bukan otorisasi (lihat `02-WORKFLOW/13-QR-SCAN-FLOW.md`); server tetap memvalidasi ulang assignment/role/status setiap request.
- Endpoint list mendukung pagination (`?page=&page_size=`), dan filter spesifik per domain (lihat dokumen workflow terkait untuk daftar filter yang dibutuhkan UI).



==================================================
FILE: 09-TECHNICAL/INFRASTRUCTURE.md
==================================================

# INFRASTRUKTUR FISIK — Kebutuhan Hardware & Jaringan

## Perangkat yang Dibutuhkan per Area

### Area Desain & Sales (Meja Depan / Office)
| Perangkat | Jumlah | Keterangan |
|-----------|--------|-----------|
| Komputer/Laptop | 2 unit | Untuk Admin Sales + Designer |
| Monitor | 2 unit | Minimal 22 inci untuk kerja desain |
| WiFi / LAN | ✅ | Harus terhubung ke server/internet |

### Area Produksi — Lantai 3
| Perangkat | Jumlah | Keterangan |
|-----------|--------|-----------|
| HP/Tablet per operator | 1 per operator | Untuk scan QR Job, minimal Android 10 / iOS 14 |
| Charger/Holder tablet | 1 per stasiun | Agar tidak kehabisan baterai saat shift |
| WiFi Access Point LT3 | Min 1 AP | Harus cover seluruh area mesin |
| Printer Label QR | 1 unit | Terhubung ke jaringan — lihat spesifikasi di bawah |

### Area QC
| Perangkat | Jumlah | Keterangan |
|-----------|--------|-----------|
| Tablet/HP | 1 unit | Untuk input hasil inspeksi + upload foto defect |
| WiFi | ✅ | Harus ada coverage di area QC |

### Area Finishing
| Perangkat | Jumlah | Keterangan |
|-----------|--------|-----------|
| Tablet/HP | 1 unit | Untuk scan QR + konfirmasi finishing |
| Printer Label QR | Bisa berbagi dengan area produksi | Jika lokasi berdekatan |
| WiFi | ✅ | |

### Counter Penyerahan — Lantai 1
| Perangkat | Jumlah | Keterangan |
|-----------|--------|-----------|
| Komputer/Tablet | 1 unit | Untuk Admin Sales proses pickup |
| WiFi / LAN | ✅ | |

---

## Printer Label QR

Printer label digunakan untuk cetak label QR yang ditempel di setiap produk selesai finishing.

### Spesifikasi Minimum
- **Tipe**: Thermal label printer (rekomendasi: Zebra, Epson TM, atau Brother QL)
- **Koneksi**: WiFi / LAN (bukan USB — harus bisa dikirim dari server web)
- **Ukuran label**: Fleksibel, minimal bisa print 6×4 cm
- **Sistem print**: Melalui network print server atau browser print API

### Yang Dicetak di Label
```
┌─────────────────────────┐
│  [QR CODE]              │
│                         │
│  ORD-20260814-0001      │
│  Banner 3x1m — 10 pcs  │
│  Ahmad                  │
│  Slot: LT3-A-01-01     │
└─────────────────────────┘
```

---

## Jaringan

| Lokasi | Kebutuhan |
|--------|----------|
| Semua area kerja | WiFi stabil, minimal 10 Mbps upload |
| Server | VPS/Cloud dengan uptime 99%+ |
| Backup koneksi | Disarankan ada koneksi cadangan (hotspot) jika WiFi utama mati |

> **Catatan penting:** Jika WiFi mati di area produksi, operator tidak bisa scan QR dan tidak bisa input pemakaian material. Harus ada prosedur manual jika terjadi downtime jaringan.

---

## Server / Hosting

| Komponen | Rekomendasi |
|----------|------------|
| Hosting | VPS Cloud (DigitalOcean, Vultr, atau AWS Lightsail) |
| OS | Ubuntu 22.04 LTS |
| RAM | Minimum 2GB (rekomendasi 4GB) |
| Storage | Minimum 50GB SSD (untuk file desain + backup) |
| Database | PostgreSQL 15+ |
| SSL | Wajib HTTPS (Let's Encrypt) |
| Backup | Otomatis harian, simpan 30 hari terakhir |
| Domain | Diperlukan domain atau subdomain untuk akses |

---

## Browser yang Didukung

| Browser | Versi Minimum | Keterangan |
|---------|--------------|-----------|
| Google Chrome | 100+ | ✅ Direkomendasikan |
| Mozilla Firefox | 100+ | ✅ |
| Safari (iOS) | 15+ | ✅ Untuk HP Apple |
| Samsung Internet | 18+ | ✅ Untuk HP Samsung |
| Microsoft Edge | 100+ | ✅ |
| Internet Explorer | Semua versi | ❌ Tidak didukung |

---

## Prosedur Darurat Jika Sistem Down

1. Operator mencatat job secara manual di kertas (formulir cadangan)
2. Supervisor menandai job yang belum diinput ke sistem
3. Setelah sistem kembali online, Admin/Supervisor input data manual
4. Semua input manual wajib ada keterangan "input manual — sistem down [tanggal]"
5. Dicatat di audit log sebagai input tertunda


==================================================
FILE: 09-TECHNICAL/STATUS-MACHINE.md
==================================================

# STATUS MACHINE — Alur Status Order

## Apa Itu Status Machine?

Status machine adalah **peta urutan status** yang menunjukkan:
- Status apa saja yang bisa dimiliki sebuah order/job
- Status apa yang bisa berpindah ke status apa (tidak boleh loncat sembarangan)
- Siapa yang berhak mengubah ke status tertentu

---

## Status Utama Order

```
DRAFT
  └─ Designer buat order baru

DESIGNING
  └─ Designer sedang buat/upload desain

WAITING_APPROVAL
  └─ Desain sudah ada, menunggu persetujuan konsumen (untuk tipe WA)

APPROVED
  └─ Desain sudah disetujui konsumen

WAITING_PAYMENT
  └─ Menunggu DP 50% dari konsumen

CONFIRMED
  └─ DP sudah masuk, order dikonfirmasi Admin Sales

PRODUCTION_ASSIGNED
  └─ Supervisor assign job ke operator & mesin

PRODUCTION_STARTED
  └─ Operator scan QR → mulai produksi (SCAN 1)

PRODUCTION_COMPLETE
  └─ Operator scan QR → selesai produksi, input qty & waste (SCAN 2)

QC_PENDING
  └─ Menunggu inspeksi QC

QC_PASSED
  └─ QC lulus → bisa lanjut ke finishing

QC_FAILED
  └─ QC gagal → masuk rework workflow

QC_REWORK_PENDING
  └─ Menunggu penjelasan operator + approval Owner untuk rework

REWORK_APPROVED
  └─ Owner setujui rework → kembali ke PRODUCTION_STARTED

FINISHING_STARTED
  └─ Finishing Staff scan QR → mulai finishing (SCAN 4)

FINISHING_COMPLETE
  └─ Finishing selesai, label dicetak (SCAN 5)

STORAGE_PENDING
  └─ Menunggu proses simpan ke gudang

STORED
  └─ Barang tersimpan di gudang LT3 (SCAN 6 + SCAN 7)

READY_FOR_PICKUP
  └─ Barang siap diambil konsumen → WA notifikasi dikirim

IN_TRANSIT
  └─ Barang sedang dipindah dari LT3 ke Counter LT1

PICKED_UP
  └─ Barang sudah diserahkan ke konsumen (SCAN 10)

FINAL_AUDIT_PENDING
  └─ Menunggu proses final audit oleh Admin Sales

FINAL_AUDIT_COMPLETE
  └─ Audit selesai dengan hasil GREEN, YELLOW (butuh approval Supervisor/Owner), atau RED
     (RED = order TIDAK bisa lanjut ke CLOSED — order dikembalikan ke ON_HOLD untuk
     investigasi Owner, lihat cabang RED di diagram alur)

CLOSED
  └─ Order sepenuhnya selesai. Tidak bisa diedit langsung.

ON_HOLD
  └─ Order dibekukan oleh Owner (untuk investigasi atau sengketa)

CANCELLED
  └─ Order dibatalkan (dengan kebijakan DP hangus jika produksi sudah berjalan)

INCIDENT
  └─ Barang tidak ditemukan di lokasi storage yang tercatat

// ── STATUS KHUSUS RETAIL (order_type = RETAIL) ──

NEW_RETAIL_ORDER
  └─ Kasir/Admin Sales membuat pesanan Direct Sales (barang jadi)

RETAIL_PAYMENT_COMPLETED
  └─ Pembayaran dikonfirmasi lunas, stok barang dipotong otomatis

CLOSED
  └─ (sama dengan PRINTING) Transaksi selesai. Tidak bisa diedit langsung.

CANCELLED
  └─ (sama dengan PRINTING) Hanya berlaku sebelum RETAIL_PAYMENT_COMPLETED
```

---

## Diagram Alur Utama

```
DRAFT → DESIGNING → WAITING_APPROVAL* → APPROVED
                  ↘ (walk-in/makloon langsung) ↗
APPROVED → WAITING_PAYMENT → CONFIRMED
CONFIRMED → PRODUCTION_ASSIGNED → PRODUCTION_STARTED → PRODUCTION_COMPLETE
PRODUCTION_COMPLETE → QC_PENDING → QC_PASSED → FINISHING_STARTED → FINISHING_COMPLETE
                               ↘ QC_FAILED → QC_REWORK_PENDING → REWORK_APPROVED → PRODUCTION_STARTED (ulang)
FINISHING_COMPLETE → STORAGE_PENDING → STORED → READY_FOR_PICKUP
READY_FOR_PICKUP → IN_TRANSIT → PICKED_UP
PICKED_UP → FINAL_AUDIT_PENDING → FINAL_AUDIT_COMPLETE → CLOSED
                                 ↘ (hasil RED) → ON_HOLD (investigasi Owner)

*WAITING_APPROVAL hanya untuk tipe konsumen WhatsApp
```

### Alur RETAIL (order_type = RETAIL)

```
NEW_RETAIL_ORDER → RETAIL_PAYMENT_COMPLETED → CLOSED

*Tidak ada Design, Production, QC, Finishing, Storage, atau Final Audit
*customer_id opsional (boleh null untuk pelanggan guest/walk-in)
*Pengurangan stok retail_products terjadi otomatis saat RETAIL_PAYMENT_COMPLETED
```

---

## Status Khusus (Bisa Terjadi di Berbagai Titik)

| Status | Kapan | Siapa yang Bisa Set |
|--------|-------|---------------------|
| ON_HOLD | Kapan saja, untuk investigasi | Owner saja |
| CANCELLED | Sebelum produksi dimulai (DP dikembalikan) atau setelah produksi (DP hangus) | Owner / Admin Sales |
| INCIDENT | Saat barang tidak ditemukan di storage | Warehouse (report) |

---

## Aturan Perpindahan Status

- Status **tidak bisa loncat** (contoh: tidak bisa dari CONFIRMED langsung ke PICKED_UP)
- Setiap perpindahan status dicatat di `audit_logs` secara real-time
- Perpindahan status yang tidak valid di-blokir oleh sistem di server
- Setelah CLOSED: tidak ada perpindahan status — hanya correction/adjustment yang tercatat sebagai record baru

---

## Siapa yang Bisa Ubah Status

| Transisi | Role yang Berhak |
|----------|-----------------|
| DRAFT → DESIGNING | Designer Sales |
| DESIGNING → WAITING_APPROVAL | Designer Sales |
| WAITING_APPROVAL → APPROVED | Admin Sales |
| Walk-in/Makloon → APPROVED | Designer Sales |
| APPROVED → WAITING_PAYMENT | Sistem otomatis |
| WAITING_PAYMENT → CONFIRMED | Admin Sales |
| CONFIRMED → PRODUCTION_ASSIGNED | Supervisor |
| PRODUCTION_ASSIGNED → PRODUCTION_STARTED | Operator (via scan) |
| PRODUCTION_STARTED → PRODUCTION_COMPLETE | Operator (via scan) |
| PRODUCTION_COMPLETE → QC_PENDING | Sistem otomatis |
| QC_PENDING → QC_PASSED / QC_FAILED | QC Inspector |
| QC_FAILED → QC_REWORK_PENDING | Sistem otomatis |
| QC_REWORK_PENDING → REWORK_APPROVED | Owner / Supervisor |
| QC_PASSED → FINISHING_STARTED | Finishing Staff (via scan) |
| FINISHING_STARTED → FINISHING_COMPLETE | Finishing Staff (via scan) |
| FINISHING_COMPLETE → STORAGE_PENDING | Finishing Staff (via scan, serah terima ke Warehouse) / Sistem otomatis |
| STORAGE_PENDING → STORED | Warehouse Staff (via scan Job QR + Location QR) |
| STORED → READY_FOR_PICKUP | Sistem otomatis |
| READY_FOR_PICKUP → IN_TRANSIT | Warehouse (via scan) |
| IN_TRANSIT → PICKED_UP | Admin Sales (via scan) |
| PICKED_UP → FINAL_AUDIT_PENDING | Sistem otomatis |
| FINAL_AUDIT_PENDING → FINAL_AUDIT_COMPLETE | Admin Sales (submit hasil GREEN/YELLOW/RED) |
| FINAL_AUDIT_COMPLETE → CLOSED | Sistem otomatis jika GREEN; Supervisor / Owner approve jika YELLOW |
| FINAL_AUDIT_COMPLETE → ON_HOLD | Sistem otomatis jika hasil RED (blokir CLOSED, wajib investigasi Owner) |
| Kapan saja → ON_HOLD | Owner |
| Sebelum produksi → CANCELLED | Admin Sales / Owner |
| Setelah produksi → CANCELLED | Owner saja |

---

## Siapa yang Bisa Ubah Status (RETAIL)

| Transisi | Role yang Berhak |
|----------|-----------------|
| Buat → NEW_RETAIL_ORDER | Admin Sales, Owner |
| NEW_RETAIL_ORDER → RETAIL_PAYMENT_COMPLETED | Admin Sales (konfirmasi pembayaran) |
| RETAIL_PAYMENT_COMPLETED → CLOSED | Sistem otomatis (setelah barang diserahkan) |
| NEW_RETAIL_ORDER → CANCELLED | Admin Sales, Owner (hanya sebelum pembayaran) |


==================================================
FILE: 09-TECHNICAL/TECH-STACK.md
==================================================

# TECH STACK

## Platform

**Web Application** — diakses via browser di desktop maupun mobile.
Bukan mobile app (tidak ada APK / App Store).

Untuk scan QR Code: menggunakan **kamera HP/tablet via browser** (Web API `getUserMedia` + QR decoder library).
Tidak memerlukan aplikasi terpisah — cukup buka browser dan scan.

---

## Stack yang Direkomendasikan

| Layer | Teknologi | Alasan |
|-------|-----------|--------|
| **Framework** | Next.js 14 (App Router) + TypeScript | Full-stack, SSR/SSG, API routes built-in, deployment fleksibel |
| **Database** | PostgreSQL | Relasional, ACID compliant, cocok untuk audit trail immutable |
| **ORM** | Prisma | Type-safe, migration management, mudah schema change |
| **Authentication** | NextAuth.js v5 (Auth.js) | RBAC support, session management, server-side validation |
| **QR Generate** | `qrcode` npm | Generate QR di server, deliver sebagai PNG/SVG untuk dicetak |
| **QR Scan (browser)** | `html5-qrcode` atau `zxing-js` | Scan via kamera HP di browser, tidak perlu install apapun |
| **WhatsApp** | Abstraction layer (Fonnte/Wablas/WABA) | Provider dikonfigurasi via env var, bisa ganti tanpa ubah kode |
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


==================================================
FILE: 09-TECHNICAL/VALIDATION-RULES.md
==================================================

# Validation Rules

- Quantities > 0.
- Prices >= 0.
- Required IDs must exist.
- Production requires approved design and valid Job ID.
- Material OUT requires Job ID.
- Waste requires quantity and reason.
- QC PASS required before finishing/storage.
- Storage requires valid Job ID + valid Location ID.
- READY_FOR_PICKUP requires successful storage confirmation.
- Pickup/release requires payment condition and authorization.
- Final Audit required before close.
- RED audit blocks close — order is moved to `ON_HOLD` for Owner investigation instead of CLOSED (see `09-TECHNICAL/STATUS-MACHINE.md`). YELLOW requires Supervisor/Owner approval before CLOSED. Only GREEN closes automatically.
- CLOSED records cannot be silently edited.
- READY_FOR_PICKUP notification can trigger only after storage confirmation.
- Duplicate notification events are prevented unless authorized resend.

---

## Format Field Spesifik

### Nomor Telepon (Indonesia)
- Format yang diterima: `08xxxxxxxxxx` (10–13 digit, awalan `08`) atau `+62xxxxxxxxxx` (awalan `+62` diikuti nomor tanpa `0` di depan).
- Regex acuan: `^(?:\+62|62|0)8[1-9][0-9]{6,10}$`
- Disimpan di database dalam bentuk ternormalisasi `+62xxxxxxxxxx` agar konsisten dipakai oleh provider WhatsApp.
- Berlaku untuk `customers.phone` dan field telepon lain yang mungkin ditambahkan (mis. kontak darurat pegawai).

### Email
- Format standar RFC 5322 disederhanakan: `^[^\s@]+@[^\s@]+\.[^\s@]+$`, divalidasi juga via HTML5 `type="email"` di form.
- Wajib huruf kecil saat disimpan (`toLowerCase()`) untuk menghindari duplikasi karena perbedaan kapitalisasi.
- Bersifat opsional di `customers` dan `users` (users: dipakai untuk notifikasi sistem, bukan login).

### Harga / Nominal (Rupiah)
- Semua nominal uang (`orders.total`, `orders.subtotal`, `order_items.unit_price`, `payments.amount`, `materials.standard_cost`, dll) disimpan sebagai **integer, tanpa desimal** — satuan Rupiah penuh (bukan sen).
- Alasan: Rupiah secara praktik tidak memakai pecahan di bawah 1 rupiah dalam transaksi percetakan sehari-hari; integer menghindari masalah pembulatan floating-point dan mempermudah agregasi laporan keuangan.
- Tipe kolom database: `decimal` atau `bigint` (bukan `float`/`double`) — hindari floating point untuk nilai uang meski disimpan sebagai bilangan bulat, agar operasi agregasi (SUM) tetap presisi.
- Nilai negatif tidak diperbolehkan kecuali untuk field refund/adjustment yang secara eksplisit didefinisikan sebagai pengurang (mis. `dp_refund_amount`).

---

## Required Field Minimal per Entitas Utama

**Order** (`orders`)
- `customer_id`, `created_by`, minimal 1 `order_item`, `deadline`
- Status awal wajib `DRAFT`; `total`/`subtotal` dihitung sistem dari `order_items`, tidak diinput manual

**Customer** (`customers`)
- `name`, `phone` (format valid sesuai aturan di atas)
- `email` opsional; `customer_code` auto-generate sistem

**Payment** (`payments`)
- `order_id`, `amount` (> 0), `method` (CASH/TRANSFER/QRIS), `received_by`
- `reference` wajib jika `method = TRANSFER`

**Production Job** (`production_jobs`)
- `order_id`, `machine_id`, `operator_id`, `planned_qty` (> 0)
- `job_code` auto-generate sistem; `actual_qty` wajib diisi saat SCAN 2 (selesai produksi), tidak boleh 0
- `waste_reason` wajib jika `waste_qty > 0`


==================================================
FILE: 02-WORKFLOW/01-CUSTOMER-DESIGNER.md
==================================================

# Customer -> Designer/Sales

Customer may directly contact a designer.

Designer collects:
- product
- quantity
- size
- material
- finishing
- deadline
- design/reference
- customer identity

Designer creates Draft Order.

Important: direct communication is allowed; private/unrecorded transaction is not allowed.


==================================================
FILE: 02-WORKFLOW/02-ORDER.md
==================================================

# Order Workflow — Pembuatan hingga Konfirmasi

## Langkah 1 — Buat Order Baru

**Siapa:** Admin Sales atau Designer Sales

**Data yang wajib diisi:**
- Konsumen (pilih dari database atau buat baru)
- Tipe order: Walk-in / Makloon / WhatsApp
- Produk + spesifikasi (ukuran, jumlah, bahan)
- Deadline
- Catatan khusus (opsional)

**Data yang otomatis terisi sistem:**
- Kode order: `ORD-YYYYMMDD-XXXX` (auto-increment per hari)
- Tanggal pembuatan
- Dibuat oleh (akun yang login)
- Status: DRAFT

---

## Langkah 2 — Tambah Item Order

Satu order bisa memiliki **lebih dari satu item produk** (combo order):

Contoh: Banner 3x1m (10 pcs) + Sticker A4 (50 pcs) dalam satu order.

Setiap item mengisi:
- Jenis produk
- Deskripsi tambahan
- Ukuran/dimensi
- Jumlah
- Bahan (pilih dari daftar material yang relevan dengan produk)
- Finishing (laminasi, pemotongan, dll — opsional)
- Harga satuan
- Total harga item

**Harga total order** = jumlah semua item + dikurangi diskon (jika ada, harus approval Owner).

---

## Langkah 3 — Upload File Desain (jika ada)

- Walk-in: Designer buat desain di hadapan konsumen, upload ke sistem
- Makloon: Admin upload file dari konsumen
- WhatsApp: Designer upload preview desain, menunggu konfirmasi Admin

Lihat detail di: `02-WORKFLOW/03-DESIGN-APPROVAL.md`

---

## Langkah 4 — Penetapan DP

Sistem otomatis hitung DP minimum berdasarkan total order:
- Walk-in: **50% dari total**
- Makloon / WhatsApp: minimal 50%, bisa di-override dengan approval

Status order berubah ke WAITING_PAYMENT setelah desain APPROVED.

---

## Langkah 5 — Konfirmasi Order

Setelah DP diterima dan dikonfirmasi Admin Sales:
- Status berubah ke CONFIRMED
- Order masuk antrian produksi
- Supervisor bisa assign job ke mesin dan operator

---

## Edit Order

| Kondisi | Bisa Edit? | Oleh Siapa |
|---------|-----------|-----------|
| Status DRAFT | ✅ Ya | Admin Sales, Designer |
| Status DESIGNING / WAITING_APPROVAL | ✅ Ya (terbatas) | Admin Sales |
| Status CONFIRMED ke atas | ❌ Tidak bisa edit langsung | — |
| Status CLOSED | ❌ Tidak | Hanya Correction/Adjustment |

---

## Multiple Job per Order

Jika satu order punya beberapa item produk yang butuh mesin berbeda:
- Sistem buat **Production Job terpisah** per item
- Masing-masing job berjalan di mesin yang sesuai secara paralel atau berurutan
- Semua job dalam satu order harus selesai sebelum order bisa masuk ke Pickup

---

## Pencarian & Filter Order

Filter yang tersedia di halaman daftar order:
- Status (dropdown multi-select)
- Tanggal order (dari–sampai)
- Nama konsumen (search)
- Kode order (search exact)
- Deadline (dari–sampai)
- Overdue only (toggle)
- Designer yang handle


==================================================
FILE: 02-WORKFLOW/03-DESIGN-APPROVAL.md
==================================================

# Design & Approval Workflow

## Prinsip Utama

Hanya desain yang sudah disetujui yang boleh masuk ke produksi.
Cara approval berbeda-beda tergantung tipe konsumen.

---

## Tipe 1 — Walk-in (Konsumen Datang Langsung)

**Kondisi:** Konsumen datang langsung ke toko, duduk di depan Designer/Sales.

**Alur:**
```
Konsumen duduk dengan Designer
  → Designer buat/ubah desain di hadapan konsumen
  → Konsumen lihat langsung di layar dan setujui secara lisan
  → Designer klik "Tandai Desain Disetujui" di sistem
  → Input: nama versi, catatan singkat, tanggal persetujuan
  → Status desain → APPROVED
  → Order bisa masuk ke antrian produksi
```

**Tidak perlu:** link online, tanda tangan digital, atau upload dari konsumen.
**Dicatat di sistem:** versi desain yang disetujui + timestamp + siapa yang approve (Designer yang input atas nama konsumen).

---

## Tipe 2 — Makloon (Konsumen Bawa File Sendiri)

**Kondisi:** Konsumen sudah punya file desain sendiri (format print-ready: AI, CDR, PDF, PNG resolusi tinggi).

**Alur:**
```
Konsumen kirim file (bawa langsung / kirim via WA ke Admin / upload link)
  → Admin Sales atau Designer upload file ke sistem
  → Pilih tipe: "Makloon — file dari konsumen"
  → Tidak perlu proses approval desain
  → Status desain → APPROVED (otomatis karena file dari konsumen sendiri)
  → Order bisa masuk ke antrian produksi setelah DP terpenuhi
```

**Catatan:** File yang diupload harus disimpan di sistem sebagai dokumentasi.
Jika hasil cetak tidak sesuai karena kesalahan file konsumen, sistem punya bukti bahwa file yang digunakan adalah file yang konsumen berikan.

---

## Tipe 3 — WhatsApp / Remote

**Kondisi:** Konsumen minta desain dari toko, tapi tidak datang langsung. Komunikasi via WhatsApp.

**Alur:**
```
Designer buat desain → upload preview/draft ke sistem
  → Admin Sales melihat preview di sistem
  → Admin Sales kirim preview ke konsumen via WhatsApp (di luar sistem)
  → Konsumen reply setuju/minta revisi
  → Jika setuju:
      Admin Sales klik "Konfirmasi Persetujuan via WA" di sistem
      → Input: keterangan singkat ("Konsumen konfirmasi setuju via WA jam 14:30")
      → Status desain → APPROVED
  → Jika minta revisi:
      Admin Sales catat permintaan revisi di sistem
      → Designer buat versi baru
      → Proses diulang
```

**Catatan penting:**
- Admin Sales yang mengkonfirmasi — bukan Designer
- Preview desain yang dikirim ke konsumen tidak boleh mengandung watermark atau identitas yang memungkinkan konsumen print sendiri tanpa bayar
- Persetujuan "via WA" dicatat sebagai teks di sistem (screenshot WA bisa dilampirkan sebagai bukti opsional)

---

## Aturan Umum Desain

- Setiap desain disimpan dengan versi (V1, V2, V3...)
- Hanya versi yang sudah APPROVED yang bisa masuk produksi
- Jika konsumen minta revisi setelah APPROVED, butuh re-approval sebelum bisa lanjut
- Designer tidak bisa meng-approve desainnya sendiri untuk tipe WA (harus Admin Sales)
- File desain disimpan di sistem dan tidak bisa dihapus oleh Designer setelah order masuk produksi

---

## Pencatatan di Database

Tabel `design_versions`:
- `version_no`: V1, V2, V3...
- `file_path`: lokasi file di storage
- `preview_path`: preview gambar (untuk ditampilkan di sistem)
- `uploaded_by`: user_id Designer
- `uploaded_at`
- `approval_status`: PENDING / APPROVED / REJECTED
- `approved_at`
- `approved_by`: user_id Admin Sales (untuk WA) atau Designer (untuk walk-in/makloon)
- `approval_method`: WALK_IN / MAKLOON / WHATSAPP
- `approval_notes`: catatan singkat


==================================================
FILE: 02-WORKFLOW/04-PAYMENT.md
==================================================

# Payment Workflow

## Flow Umum

```
ORDER DIBUAT
  → Payment Request dibuat
  → Konsumen bayar DP
  → Admin Sales konfirmasi DP
  → Status: PARTIAL (jika DP)
  → Produksi bisa dimulai (jika DP sudah memenuhi syarat)
  → Pelunasan saat pickup atau sebelumnya
  → Status: PAID
```

---

## Aturan DP (Uang Muka)

### Konsumen Datang Langsung (Walk-in)
- DP minimum: **50% dari total order**
- Tidak ada pengecualian tanpa persetujuan Owner
- Admin Sales TIDAK BISA override tanpa Owner
- Jika konsumen tidak mau DP 50%: order tidak bisa diproses ke produksi

### Konsumen Remote (via WhatsApp / Email / Online)
- DP minimum default: **50% dari total order**
- Namun terdapat tombol **"Setujui Pengecualian DP"** yang hanya bisa diakses oleh:
  - Admin Sales (dengan batas minimal DP 30%)
  - Owner (bisa approve berapapun termasuk 0% jika ada alasan kuat)
- Setiap pengecualian DP wajib disertai alasan dan tercatat di audit log
- Konsumen remote yang belum bayar DP tidak bisa masuk antrian produksi

### Override / Pengecualian Khusus
- Tombol "Override DP" hanya tampil untuk role: `admin_sales`, `owner`
- Tidak ada override diam-diam — semua exception tercatat di `audit_logs`
- Format log: `actor_id | action=DP_OVERRIDE | order_id | original_dp_pct | approved_dp_pct | reason | timestamp`

---

## Konfirmasi Payment

- Admin Sales yang menerima pembayaran wajib mencatat:
  - Jumlah yang diterima
  - Metode pembayaran (cash, transfer bank, QRIS)
  - Nomor referensi (jika transfer)
  - Timestamp penerimaan
- Designer/Operator/Warehouse TIDAK DAPAT mengkonfirmasi payment

---

## Kondisi Pelunasan

- Barang dapat diserahkan ke konsumen jika:
  - Sisa tagihan = 0 (LUNAS), ATAU
  - Ada persetujuan Owner untuk penyerahan dengan sisa tagihan (dan ini tercatat)

---

## Pencatatan

Simpan di tabel `payments`:
- `order_id`
- `amount`
- `method` (CASH / TRANSFER / QRIS)
- `reference` (nomor referensi transfer)
- `status` (PENDING / CONFIRMED / REJECTED)
- `received_by` (user_id Admin Sales)
- `paid_at`
- `notes`

Simpan di tabel `orders`:
- `dp_required`: jumlah DP minimum (computed: total × 0.5)
- `dp_override_pct`: jika ada pengecualian
- `dp_override_by`: user_id yang setujui
- `dp_override_reason`
- `paid_amount`: total yang sudah masuk
- `balance`: sisa tagihan

---

## Aturan Tambahan

- Designer TIDAK BISA menandai order sebagai lunas
- Designer TIDAK BISA melihat nominal total pembayaran yang diterima bisnis
- Designer hanya melihat status: "DP Terpenuhi / Belum Terpenuhi"


==================================================
FILE: 02-WORKFLOW/05-PRODUCTION.md
==================================================

# Production Workflow

Approved + payment condition satisfied -> Production Planning -> Job Assignment -> Start -> Finish

Record:
- Job ID
- machine
- operator
- planned quantity
- actual quantity
- start/end
- reprint
- waste
- notes

No Job ID = no official production.


==================================================
FILE: 02-WORKFLOW/06-MATERIAL.md
==================================================

# Material Workflow

## Alur Lengkap Material

```
BELI BAHAN → TERIMA & INPUT STOK MASUK → TERSEDIA DI SISTEM
  → OPERATOR PAKAI SAAT PRODUKSI → INPUT PEMAKAIAN (KELUAR)
  → WASTE TERCATAT → STOK BERKURANG OTOMATIS
  → JIKA STOK ≤ MIN → ALERT KE OWNER & ADMIN
  → STOCK OPNAME → ADJUSTMENT JIKA ADA SELISIH
```

## Stok Masuk (Pembelian Bahan)

**Siapa:** Admin Sales, Warehouse Staff, atau Owner (wajib login dengan akun sendiri)

**Input:**
- Pilih bahan dari daftar (dikelompokkan per mesin)
- Jumlah yang masuk (dalam satuan stok: Roll, Rim, Liter, dll)
- Harga beli per satuan (opsional)
- Supplier (opsional)
- Tanggal masuk
- Catatan

**Hasil:** `material_movements` baru dengan `movement_type = IN`, stok bertambah otomatis.

---

## Stok Keluar (Pemakaian Produksi)

**Siapa:** Operator (saat submit selesai produksi)

**Input:**
- Pilih bahan yang dipakai (sudah difilter sesuai mesin yang digunakan)
- Jumlah pemakaian (dalam satuan pemakaian: Meter, Lembar, mL, Gram)
- Jumlah waste (jika ada, wajib isi alasan)

**Aturan:**
- Wajib ada Job ID — tidak bisa input keluar tanpa job
- Sistem konversi satuan otomatis (meter → meter dari roll)
- Jika stok tidak mencukupi: sistem tampilkan peringatan, tapi tidak blokir (supaya produksi tidak terhenti — dicatat sebagai anomali)

**Hasil:** Stok berkurang, tercatat di `material_movements` dengan `movement_type = OUT` dan `movement_type = WASTE`.

---

## Adjustment Stok (Koreksi Manual)

**Kapan:** Saat stock opname, ditemukan selisih antara sistem dan fisik.

**Siapa:** Admin Sales atau Owner

**Input:**
- Pilih bahan
- Jumlah aktual fisik saat ini
- Alasan adjustment (wajib)

**Hasil:** Stok diupdate ke jumlah aktual, selisih dicatat di `material_movements` dengan `movement_type = ADJUSTMENT`. Wajib masuk audit log.

---

## Alert Stok Minimum

Cek dilakukan setiap kali ada movement OUT atau ADJUSTMENT.
Jika `current_stock ≤ min_stock`:
- Badge merah di dashboard Owner dan Admin Sales
- WhatsApp ke Owner: *"Stok [nama bahan] ([mesin]) menipis: [jumlah] [satuan]. Min: [min_stock]."*


==================================================
FILE: 02-WORKFLOW/07-QC.md
==================================================

# QC Workflow

## Flow Utama

```
PRODUCTION_COMPLETE
  → QC Inspector scan Job QR
  → Buka form QC di web
  → Isi checklist inspeksi
  → Tentukan hasil: PASS atau FAIL
```

---

## Checklist Inspeksi

- Jumlah (quantity vs planned)
- Ukuran (size sesuai order)
- Warna (color accuracy)
- Kualitas cetak (print quality — bintik, blur, stripe)
- Defect fisik (sobek, kotor, lipatan)
- Finishing (laminating, cutting, welding sesuai order)

Setiap poin diberi status: OK / MASALAH MINOR / MASALAH MAYOR
QC Inspector wajib mengisi catatan jika ada masalah.
Upload foto direkomendasikan jika ada defect.

---

## Hasil QC

### QC PASS
- Status order berubah ke FINISHING
- QC Inspector yang mengesahkan tercatat di `qc_records`
- Tidak diperlukan approval tambahan

### QC FAIL — Rework Workflow

#### Langkah 1: Pelaporan Fail
- QC Inspector mencatat:
  - Kategori masalah (print quality / quantity / size / lainnya)
  - Deskripsi masalah (wajib, min 20 karakter)
  - Foto bukti (direkomendasikan)
  - Rekomendasi: rework / reprint / eskalasi

#### Langkah 2: Notifikasi Otomatis
- Sistem **langsung mengirim notifikasi** kepada:
  - Owner
  - Supervisor
  - Admin Sales (agar bisa bersiap komunikasi ke konsumen jika diperlukan)
- Notifikasi berisi: Job ID, Order ID, nama produk, kategori masalah, catatan QC

#### Langkah 3: Penjelasan dari Operator/Supervisor
- Operator yang bertanggung jawab atau Supervisor harus mengisi:
  - Penjelasan mengapa terjadi fail
  - Siapa yang bertanggung jawab
  - Estimasi waktu rework
  - Kebutuhan material tambahan (jika ada)
- Penjelasan ini disimpan di sistem dan terhubung ke `qc_records`

#### Langkah 4: Persetujuan Owner untuk Rework
- Owner (atau Supervisor jika Owner mendelegasikan) melihat laporan fail + penjelasan operator
- Owner memberikan keputusan:
  - **APPROVE REWORK**: Job ID lama tetap digunakan, status kembali ke PRODUCTION, material tambahan dicatat
  - **REJECT → REPRINT BARU**: Dibuat Production Job baru dengan Job ID baru, Job ID lama di-archive sebagai FAILED
  - **HOLD**: Tunda keputusan, order distatus HOLD menunggu investigasi lebih lanjut
- Keputusan Owner dicatat di `audit_logs` beserta timestamp dan alasan

#### Langkah 5: Setelah Rework
- Setelah rework selesai, wajib QC ulang oleh QC Inspector yang BERBEDA (jika memungkinkan)
- Batas maksimal rework: 2 kali untuk satu Job ID
- Jika rework ke-2 juga FAIL: wajib eskalasi ke Owner, tidak bisa dilanjut tanpa keputusan Owner secara langsung

---

## Pencatatan

Setiap QC event disimpan di `qc_records`:
- job_id
- inspector_id
- result (PASS / FAIL)
- checklist_json (detail per item)
- notes
- photo_path
- created_at

Setiap keputusan rework disimpan di `audit_logs`:
- actor_id (owner/supervisor yang approve)
- action: QC_REWORK_APPROVED / QC_REWORK_REJECTED / QC_HOLD
- entity_type: production_job
- entity_id: job_id
- old_value_json, new_value_json
- notes (alasan keputusan)
- created_at


==================================================
FILE: 02-WORKFLOW/08-FINISHING.md
==================================================

# Finishing Workflow

Finishing is the controlled handoff from production to finished-goods storage.

## Required flow

QC PASS
-> FINISHING
-> PACKING
-> SCAN JOB QR/BARCODE
-> PRINT/VERIFY LABEL
-> SCAN STORAGE LOCATION
-> READY_FOR_PICKUP
-> AUTOMATIC CUSTOMER NOTIFICATION

## Finishing operator must record
- Job ID
- operator
- quantity
- start time
- completion time
- notes
- QR/barcode scan
- label verification

## Important rule
Finishing completion alone does NOT make an order ready for pickup.

The job must be successfully stored in a registered storage location first.

## Label
Recommended label:
- company name
- QR Code
- Job ID
- Order ID
- customer name
- short product description
- quantity

## WhatsApp trigger
After successful storage scan, the system may automatically trigger the customer notification workflow.

Do not send the "ready for pickup" message before the job has a valid storage location.


==================================================
FILE: 02-WORKFLOW/09-STORAGE.md
==================================================

# Storage Layout & Workflow

## Gambaran Umum Dua Lantai

Percetakan ini memiliki dua area penyimpanan dengan fungsi yang berbeda:

| Area | Lokasi | Fungsi | Ukuran |
|------|--------|--------|--------|
| **Gudang Finishing** | Lantai 3 | Penyimpanan barang jadi setelah QC & finishing | Luas |
| **Counter Penyerahan** | Lantai 1 | Area pengambilan oleh konsumen | Kecil |

---

## Lantai 3 — Gudang Finishing (Main Storage)

### Fungsi
Semua barang jadi disimpan di sini setelah proses finishing selesai.
Ini adalah lokasi resmi yang terdaftar di sistem.

### Sistem Penomoran Lokasi

```
Format: LT3-[ZONA]-[RAK]-[SLOT]

Contoh:
LT3-A-01-01  = Lantai 3, Zona A, Rak 01, Slot 01
LT3-A-01-02  = Lantai 3, Zona A, Rak 01, Slot 02
LT3-B-02-01  = Lantai 3, Zona B, Rak 02, Slot 01
```

### Pembagian Zona (Rekomendasi)
- **Zona A**: Banner, spanduk, backdrop (ukuran besar)
- **Zona B**: Sticker, label, kartu nama (ukuran kecil, terlipat/tergulung)
- **Zona C**: Box, produk packaging, cetak packaging
- **Zona D**: Holding area — barang yang belum siap sepenuhnya atau sedang dalam proses

### Kapasitas
- Setiap slot memiliki kapasitas maksimal (field `capacity_max` di database)
- Sistem memberi peringatan jika slot sudah penuh
- Staff tidak bisa assign ke slot yang sudah penuh tanpa override

### Alur Masuk Storage Lantai 3
```
Finishing Complete
  → Staff finishing SCAN Job QR (via kamera HP/tablet browser)
  → Pilih "Simpan ke Gudang"
  → Warehouse Staff SCAN QR Lokasi (LT3-A-01-01)
  → Sistem validasi: job status sudah FINISHING_COMPLETE?
  → Sistem validasi: lokasi masih tersedia?
  → SIMPAN → Status: READY_FOR_PICKUP
  → Notifikasi WhatsApp otomatis dikirim ke konsumen
```

---

## Lantai 1 — Counter Penyerahan (Pickup Counter)

### Fungsi
Bukan gudang permanen. Ini adalah **area transit sementara** saat konsumen sudah datang dan barang sedang diambilkan dari gudang lantai 3.

### Kapasitas
- Kecil: hanya untuk menampung 5–15 order yang sedang aktif diproses penyerahan
- Bukan tempat penyimpanan jangka panjang

### Alur Pengambilan (Pickup Flow)

```
Konsumen datang ke counter
  ↓
Admin Sales cari order (by nama / order_code) atau SCAN Job QR konsumen
  ↓
Sistem tampilkan: nama konsumen, produk, jumlah, status payment, lokasi di gudang
  ↓
Admin Sales minta staff ambil barang dari LT3-[lokasi]
  ↓
Staff ambil barang dari Lantai 3
  ↓
Staff SCAN Job QR di Counter Lantai 1 (konfirmasi "Barang sudah di counter")
  ↓
Admin Sales verifikasi: identitas konsumen + payment lunas?
  ↓ (jika payment ada sisa tagihan → proses payment dulu)
Admin Sales klik "Serahkan" → SCAN Job QR (konfirmasi final)
  ↓
Konsumen tanda tangan / konfirmasi (opsional, bisa foto bukti)
  ↓
Status: PICKED_UP
  ↓
Barang fisik keluar dari sistem storage
```

### Lokasi Counter di Database
- Counter Lantai 1 memiliki kode lokasi: `LT1-COUNTER-01`, `LT1-COUNTER-02`, dst
- Scan di counter mencatat perpindahan dari LT3 ke LT1 (transit)
- Saat diserahkan ke konsumen, status berubah ke PICKED_UP dan storage_item dilepas

---

## Penanganan Barang Tidak Ditemukan

Jika barang yang dicari di lokasi yang tercatat tidak ada secara fisik:

1. Staff melaporkan "Barang tidak ditemukan" di sistem
2. Sistem menampilkan last scan location dan last scan timestamp
3. Dibuat incident report otomatis
4. Notifikasi ke Owner dan Supervisor
5. Order status berubah ke INCIDENT — tidak bisa diserahkan sampai diselesaikan
6. Admin Sales tidak memberitahu konsumen sebelum ada kejelasan dari Owner

---

## Database — Tabel yang Relevan

### `storage_locations`
```
id
location_code      (e.g., LT3-A-01-01)
name               (label ramah: "Lantai 3 Zona A Rak 1 Slot 1")
floor              (1 atau 3)
zone               (A / B / C / D / COUNTER)
rack               (nomor rak)
slot               (nomor slot)
capacity_max       (max job yang bisa disimpan, default 1 per slot)
capacity_current   (diupdate otomatis saat ada barang masuk/keluar)
qr_code_value      (nilai unik untuk QR lokasi ini)
active             (boolean)
```

### `storage_items`
```
id
job_id
location_id        (FK ke storage_locations)
quantity
stored_by          (user_id)
stored_at
transit_at         (waktu barang dipindah ke counter LT1)
transit_by
released_by
released_at
status             (STORED / IN_TRANSIT / RELEASED / INCIDENT)
```

---

## QR Lokasi Storage

Setiap lokasi fisik (rak/slot) memiliki stiker QR yang ditempel permanen.
Format QR content: `LOC:{location_code}` (e.g., `LOC:LT3-A-01-01`)

Saat di-scan:
- Jika dalam konteks "simpan barang": sistem tahu ini adalah SCAN LOKASI TUJUAN
- Jika dalam konteks "ambil barang": sistem tahu ini adalah konfirmasi LOKASI SUMBER
- Konteks ditentukan oleh halaman/state aktif di browser user saat scan


==================================================
FILE: 02-WORKFLOW/10-PICKUP-DELIVERY.md
==================================================

# Pickup

READY_FOR_PICKUP
-> Customer arrives
-> Search/scan Job QR
-> Verify customer/receiver
-> Verify payment
-> Verify quantity
-> Release
-> PICKED_UP
-> Audit log

## Release protection

Only Admin Sales may perform the final release to the customer. Admin Sales must not release an order if:
- order is not ready;
- payment condition is not satisfied;
- quantity does not match;
- required approval is missing.

Any override requires authorized supervisor/owner approval and creates an audit log.

## Detail

For the full step-by-step scan sequence (verify order → confirm barang di counter → final release), see `02-WORKFLOW/13-QR-SCAN-FLOW.md` (SCAN 8–10).


==================================================
FILE: 02-WORKFLOW/11-FINAL-AUDIT-CLOSING.md
==================================================

# Final Audit & Closing

Final Audit is mandatory.

Check:
- finance
- material
- quantity
- production
- QC
- finishing
- storage
- pickup/delivery
- workflow integrity
- user accountability

Result:
GREEN -> close
YELLOW -> supervisor approval
RED -> cannot close

After CLOSED, direct edits are forbidden. Use correction/adjustment workflow.


==================================================
FILE: 02-WORKFLOW/12-WHATSAPP-NOTIFICATION.md
==================================================

# WhatsApp Customer Notification Workflow

## Objective

Automatically notify the customer when the physical order has been completed, stored, and is genuinely ready for pickup.

## Trigger

The notification must NOT trigger merely because production or finishing is marked complete.

Correct trigger:

QC PASS
-> FINISHING COMPLETE
-> JOB QR/BARCODE SCANNED
-> STORAGE LOCATION QR SCANNED
-> STORAGE SUCCESS
-> STATUS READY_FOR_PICKUP
-> NOTIFICATION TRIGGER

## Pickup message

Example:

Halo Kak Ahmad 👋

Pesanan Anda dengan nomor ORD-260814-001 sudah selesai dan sudah siap diambil.

📦 Pesanan: Banner 3×1 Meter
🔢 Jumlah: 10 pcs
📍 Status: SIAP DIAMBIL

Silakan datang ke percetakan untuk pengambilan pesanan.

Terima kasih 🙏

## Outstanding payment message

If the order is ready but still has an outstanding balance, use a different message:

Halo Kak Ahmad 👋

Pesanan ORD-260814-001 sudah selesai dan sudah tersimpan di percetakan.

📦 Pesanan: Banner 3×1 Meter
💰 Status pembayaran: MENUNGGU PELUNASAN

Pesanan dapat diambil setelah proses pembayaran sesuai ketentuan percetakan.

## Notification rules

- Store notification event in database.
- Store sent_at, recipient, template, provider response, and status.
- Prevent duplicate messages unless a resend is explicitly requested.
- Failed notification must be visible to admin.
- Notification failure must NOT change physical storage status.
- Do not expose sensitive internal cost or audit information to customer.

## Future integration

WhatsApp Business API/provider should be connected in a separate integration layer.
The core workflow must remain functional even if WhatsApp is temporarily unavailable.


==================================================
FILE: 02-WORKFLOW/13-QR-SCAN-FLOW.md
==================================================

# QR Scan Flow — Alur Lengkap

## Prinsip Dasar

1. QR adalah **identitas, bukan otorisasi** — scan tidak pernah langsung eksekusi aksi
2. Setiap scan: sistem cek login + role + status sebelum memperbolehkan aksi
3. Semua scan dilakukan via **browser di HP/tablet** — tidak butuh app tambahan
4. Dua jenis QR: **Job QR** (per order/job) dan **Location QR** (per slot di rak)

---

## Dua Jenis QR Code

### Job QR
- Dibuat otomatis saat Production Job dibuat
- Berisi: URL ke halaman job + Job Code (`https://app.percetakan.com/scan/job/JOB-20260814-0001`)
- Dicetak pada label yang ditempel di barang fisik
- Digunakan sepanjang siklus hidup order: dari produksi sampai pickup

### Location QR (Storage)
- Dibuat saat lokasi storage didaftarkan
- Berisi: kode lokasi (`LOC:LT3-A-01-01`)
- Dicetak dan ditempel permanen di setiap rak/slot
- Tidak berubah selama lokasi itu aktif

---

## Peta Titik Scan

```
PRODUKSI
  ├── [SCAN 1] Operator scan Job QR → Mulai Produksi
  └── [SCAN 2] Operator scan Job QR → Selesai Produksi

QC
  └── [SCAN 3] QC Inspector scan Job QR → Buka Form QC

FINISHING
  ├── [SCAN 4] Finishing Staff scan Job QR → Mulai Finishing
  └── [SCAN 5] Finishing Staff scan Job QR → Selesai Finishing + Cetak Label

STORAGE (Lantai 3)
  ├── [SCAN 6] Warehouse scan Job QR → "Mau simpan barang ini"
  └── [SCAN 7] Warehouse scan Location QR → Konfirmasi Lokasi Penyimpanan

PICKUP (Lantai 1 Counter)
  ├── [SCAN 8] Admin Sales scan Job QR → Cari & verifikasi order konsumen
  ├── [SCAN 9] Warehouse Staff scan Job QR → Konfirmasi "Barang sudah di counter"
  └── [SCAN 10] Admin Sales scan Job QR → Release final ke konsumen

AUDIT
  └── [SCAN opsional] Admin Sales scan Job QR → Lihat histori lengkap untuk Audit
```

---

## Detail Setiap Titik Scan

---

### 🔵 SCAN 1 — Mulai Produksi
**Siapa:** Operator Mesin  
**Di mana:** Stasiun mesin / area produksi (HP/tablet operator)  
**Kapan:** Saat mulai mengerjakan job  
**QR yang di-scan:** Job QR  

**Alur:**
1. Operator buka browser → Login → Masuk halaman "Produksi Aktif Saya"
2. Klik "Scan Mulai Job"
3. Scan Job QR dari Work Order / print-out
4. Sistem tampilkan: nama produk, spesifikasi, quantity, deadline
5. Operator klik "MULAI PRODUKSI"
6. Status → `PRODUCTION_STARTED`, `actual_start` tercatat

**Validasi server:**
- Apakah user ini adalah operator yang di-assign ke job ini?
- Apakah status job adalah `PRODUCTION_ASSIGNED`?
- Jika tidak → tampilkan error, jangan ubah status

---

### 🔵 SCAN 2 — Selesai Produksi
**Siapa:** Operator Mesin  
**Di mana:** Stasiun mesin  
**Kapan:** Setelah produksi fisik selesai  
**QR yang di-scan:** Job QR  

**Alur:**
1. Operator buka halaman "Job Aktif" → Klik "Scan Selesai"
2. Scan Job QR
3. Sistem tampilkan form:
   - Actual quantity: ___
   - Waste quantity: ___ (wajib jika > 0, disertai alasan)
   - Notes: ___
4. Operator submit → Status → `PRODUCTION_COMPLETE`

**Validasi:**
- actual_qty tidak boleh 0
- waste_qty memerlukan `waste_reason` jika > 0
- Hanya operator yang di-assign ke job ini

---

### 🟡 SCAN 3 — QC Inspection
**Siapa:** QC Inspector  
**Di mana:** Area QC / meja inspeksi  
**Kapan:** Setelah SCAN 2 selesai  
**QR yang di-scan:** Job QR  

**Alur:**
1. QC Inspector buka halaman "Antrian QC"
2. Klik "Scan Job"
3. Scan Job QR dari barang fisik
4. Sistem tampilkan checklist QC + spesifikasi order (qty, ukuran, finishing)
5. Inspector isi checklist: quantity ✓, ukuran ✓, warna ✓, kualitas cetak ✓, defect ✓
6. Inspector pilih: **PASS** atau **FAIL**
7. Jika FAIL: wajib isi kategori masalah + deskripsi + upload foto
8. Submit → Status diupdate sesuai hasil

**Validasi:**
- Job harus berstatus `PRODUCTION_COMPLETE`
- User harus memiliki role `qc`

---

### 🟠 SCAN 4 — Mulai Finishing
**Siapa:** Finishing Staff  
**Di mana:** Area finishing  
**Kapan:** Setelah QC PASS  
**QR yang di-scan:** Job QR  

**Alur:**
1. Finishing Staff buka halaman "Antrian Finishing"
2. Scan Job QR
3. Sistem tampilkan: spesifikasi finishing (laminating, cutting, welding, dll)
4. Klik "MULAI FINISHING"
5. Status → `FINISHING_STARTED`

**Validasi:**
- Job harus berstatus `QC_PASSED`

---

### 🟠 SCAN 5 — Selesai Finishing + Cetak Label
**Siapa:** Finishing Staff  
**Di mana:** Area finishing  
**Kapan:** Setelah proses finishing fisik selesai  
**QR yang di-scan:** Job QR  

**Alur:**
1. Scan Job QR
2. Isi form selesai: actual_qty, notes
3. Klik "SELESAI FINISHING"
4. Sistem tampilkan **preview label** untuk dicetak:
   - Nama perusahaan
   - Job QR Code (besar)
   - Job Code + Order Code
   - Nama konsumen (tanpa nomor HP)
   - Deskripsi produk singkat
   - Jumlah
5. Operator klik "CETAK LABEL" → printer terhubung cetak label
6. Label ditempel ke barang fisik
7. Status → `FINISHING_COMPLETE`

**Catatan:** Label tidak boleh mencantumkan nomor HP konsumen.

---

### 🟢 SCAN 6 — Scan Job QR untuk Simpan ke Storage
**Siapa:** Warehouse Staff / Lantai 3  
**Di mana:** Area finishing (mengambil barang) atau pintu masuk gudang lantai 3  
**Kapan:** Setelah label tertempel, barang siap disimpan  
**QR yang di-scan:** Job QR (label yang baru ditempel)  

**Alur:**
1. Warehouse Staff buka halaman "Simpan ke Gudang"
2. Scan Job QR dari label barang
3. Sistem tampilkan: informasi job, konfirmasi "Mau simpan ke gudang?"
4. Klik "Pilih Lokasi Penyimpanan"
5. → Lanjut ke SCAN 7

**Validasi:**
- Job harus berstatus `FINISHING_COMPLETE`
- User harus role `warehouse`

---

### 🟢 SCAN 7 — Scan Location QR (Masuk Storage)
**Siapa:** Warehouse Staff  
**Di mana:** Depan rak penyimpanan di Lantai 3  
**Kapan:** Setelah SCAN 6, saat barang diletakkan di rak  
**QR yang di-scan:** Location QR (stiker di rak)  

**Alur:**
1. Dalam halaman yang sama setelah SCAN 6, klik "Scan Lokasi"
2. Scan QR yang tertempel di rak (misal: QR bertuliskan `LOC:LT3-A-01-01`)
3. Sistem tampilkan: info lokasi, kapasitas tersedia
4. Konfirmasi: "Simpan [Job Code] di [LT3-A-01-01]?"
5. Klik "SIMPAN" → Status → `READY_FOR_PICKUP`
6. Sistem otomatis trigger notifikasi WhatsApp ke konsumen

**Validasi:**
- Lokasi harus aktif dan kapasitas belum penuh
- Job belum tersimpan di lokasi lain (cegah duplikasi)
- Jika lokasi penuh: tampilkan error "Pilih lokasi lain"

---

### 🔴 SCAN 8 — Pickup: Verifikasi Order Konsumen
**Siapa:** Admin Sales  
**Di mana:** Counter Lantai 1  
**Kapan:** Saat konsumen datang untuk mengambil barang  
**QR yang di-scan:** Job QR (bisa dari HP konsumen jika ada, atau dicari manual)  

**Alur:**
1. Admin Sales buka halaman "Penyerahan / Pickup"
2. Dua pilihan: **Cari by nama/order code** ATAU **Scan Job QR**
3. Jika scan: konsumen menunjukkan QR di notifikasi WA mereka (atau Admin punya print-out)
4. Sistem tampilkan:
   - Nama konsumen (bukan nomor HP)
   - Order detail
   - **Status payment**: Lunas / Sisa Rp X.XXX
   - Lokasi barang: LT3-A-01-01
5. Admin Sales meminta staff ambil barang dari gudang lantai 3

**Catatan:** Di tahap ini nomor HP konsumen TIDAK ditampilkan di layar.

---

### 🔴 SCAN 9 — Konfirmasi Barang di Counter
**Siapa:** Warehouse Staff (yang mengambil barang dari lantai 3)  
**Di mana:** Counter Lantai 1  
**Kapan:** Setelah mengambil barang dari gudang, tiba di counter  
**QR yang di-scan:** Job QR (dari label barang)  

**Alur:**
1. Staff scan Job QR dari barang yang dibawa dari lantai 3
2. Sistem catat: barang sudah di counter (status storage_item → IN_TRANSIT ke LT1-COUNTER)
3. Admin Sales menerima konfirmasi di layarnya: "Barang sudah di counter"
4. Admin Sales verifikasi identitas konsumen (KTP / nama sesuai order)
5. Jika ada sisa tagihan: proses payment dulu

---

### 🔴 SCAN 10 — Release Final ke Konsumen
**Siapa:** Admin Sales  
**Di mana:** Counter Lantai 1  
**Kapan:** Setelah identitas dan payment verified  
**QR yang di-scan:** Job QR  

**Alur:**
1. Admin Sales scan Job QR (konfirmasi final)
2. Sistem tampilkan ringkasan: nama penerima, produk, qty, status payment
3. Input nama penerima (jika bukan konsumen langsung yang ambil)
4. Opsional: foto bukti penyerahan
5. Klik "SERAHKAN" → Status → `PICKED_UP`
6. `released_by`, `released_at`, `receiver_name` tercatat
7. Storage item di-release dari sistem

**Validasi server (wajib semua terpenuhi):**
- Status order adalah `READY_FOR_PICKUP`
- Payment lunas ATAU ada override Owner yang tercatat
- User adalah `admin_sales` (hanya Admin Sales yang berwenang melakukan release final)
- Belum pernah di-release sebelumnya (cegah double release)

---

## Ringkasan Tabel

| Scan | Siapa | Lokasi Fisik | QR yang Di-scan | Aksi |
|------|-------|-------------|-----------------|------|
| 1 | Operator | Area Mesin | Job QR | Mulai Produksi |
| 2 | Operator | Area Mesin | Job QR | Selesai Produksi + input qty/waste |
| 3 | QC Inspector | Area QC | Job QR | Isi checklist QC |
| 4 | Finishing Staff | Area Finishing | Job QR | Mulai Finishing |
| 5 | Finishing Staff | Area Finishing | Job QR | Selesai Finishing + Cetak Label |
| 6 | Warehouse Staff | Pintu Gudang LT3 | Job QR | Inisiasi Simpan ke Gudang |
| 7 | Warehouse Staff | Depan Rak LT3 | Location QR | Konfirmasi Lokasi Simpan |
| 8 | Admin Sales | Counter LT1 | Job QR / manual | Cari & verifikasi order |
| 9 | Warehouse Staff | Counter LT1 | Job QR | Konfirmasi barang sudah di counter |
| 10 | Admin Sales | Counter LT1 | Job QR | Release final ke konsumen |

---

## Perangkat yang Digunakan

| Stasiun | Perangkat Scan |
|---------|---------------|
| Area Produksi | HP Android/iOS operator (buka browser) |
| Area QC | HP atau tablet QC inspector |
| Area Finishing | HP atau tablet finishing staff |
| Gudang Lantai 3 | HP warehouse staff (dibawa keliling) |
| Counter Lantai 1 | Tablet yang dipasang tetap DI counter, atau HP Admin Sales |

Semua via browser, tidak butuh install app.
WiFi/LTE harus tersedia di semua area ini.


==================================================
FILE: 02-WORKFLOW/14-CANCEL-REFUND.md
==================================================

# Cancel & Refund Workflow

## Kebijakan Dasar

Kebijakan pembatalan order berbeda tergantung pada seberapa jauh produksi sudah berjalan.

---

## Skenario 1 — Cancel Sebelum Produksi Dimulai

**Kondisi:** Status order masih di: DRAFT / DESIGNING / WAITING_APPROVAL / APPROVED / WAITING_PAYMENT / CONFIRMED

**Kebijakan DP:**
- Jika DP sudah dibayar:
  - **DP dikembalikan PENUH** (setelah dikurangi biaya desain jika sudah ada proses desain)
  - Biaya desain yang dipotong harus disepakati dan dicatat
- Jika belum ada DP: tidak ada pengembalian apapun

**Siapa yang bisa approve:** Admin Sales atau Owner

**Alur:**
```
Konsumen / Admin Sales request cancel
  → Admin Sales klik "Ajukan Pembatalan"
  → Pilih alasan: Konsumen berubah pikiran / Desain tidak cocok / Lainnya
  → Sistem cek status order → Sebelum produksi? → Bisa dicancel
  → Admin Sales atau Owner klik "Konfirmasi Cancel"
  → Jika ada DP:
      Input jumlah yang dikembalikan (bisa penuh atau dikurangi biaya desain)
      Catat metode pengembalian (cash / transfer)
  → Status order → CANCELLED
  → Dicatat di audit log
```

---

## Skenario 2 — Cancel Saat Produksi Sedang Berjalan atau Sudah Selesai

**Kondisi:** Status order sudah di: PRODUCTION_ASSIGNED / PRODUCTION_STARTED / PRODUCTION_COMPLETE / QC / FINISHING / atau lebih jauh

**Kebijakan DP: DP HANGUS (tidak dikembalikan)**

Alasannya:
- Material sudah dipakai
- Waktu operator sudah terpakai
- Mesin sudah digunakan
- Biaya produksi sudah keluar

**Siapa yang bisa approve:** **Owner SAJA** (tidak bisa dicancel oleh Admin Sales sendiri)

**Alur:**
```
Konsumen / Admin Sales request cancel
  → Admin Sales klik "Ajukan Pembatalan"
  → Sistem detect: order sudah dalam produksi
  → Sistem tampilkan peringatan: "DP HANGUS jika cancel dilanjutkan"
  → Request dikirim ke Owner untuk disetujui
  → Owner review → klik "Setujui Cancel" atau "Tolak"
  → Jika disetujui:
      DP dicatat sebagai hangus (tidak ada pengembalian)
      Produksi dihentikan (status job produksi → CANCELLED)
      Material yang sudah keluar tetap tercatat sebagai pemakaian
  → Status order → CANCELLED
  → Dicatat lengkap di audit log: siapa yang minta, kapan, kenapa, siapa yang approve
```

---

## Skenario 3 — Cancel Setelah Barang Selesai (READY_FOR_PICKUP)

**Kondisi:** Barang sudah selesai dan tersimpan di gudang, tapi konsumen tidak mau ambil

**Kebijakan:**
- **DP HANGUS**
- Jika ada pelunasan: dikembalikan SEBAGIAN setelah dikurangi biaya produksi penuh
- Barang fisik menjadi milik percetakan untuk dibuang atau digunakan kembali (jika memungkinkan)
- **Harus ada keputusan Owner**

**Alur:** Sama seperti Skenario 2 — harus lewat Owner.

---

## Pencatatan Cancel

Saat cancel:
- Status order → CANCELLED
- Field `cancelled_at` diisi
- Field `cancelled_by` diisi (user_id)
- Field `cancellation_reason` diisi
- Field `dp_refund_amount` diisi (0 jika hangus, jumlah jika dikembalikan)
- Field `dp_refund_method` diisi jika ada pengembalian
- Field `cancellation_approved_by` diisi (Owner jika produksi sudah berjalan)

Semua dicatat di `audit_logs`.

---

## Aturan Tambahan

- Order yang CANCELLED tidak bisa di-reopen — harus buat order baru
- Data konsumen tetap tersimpan untuk referensi repeat order di masa mendatang
- Laporan keuangan Owner menampilkan jumlah DP yang hangus sebagai pemasukan


==================================================
FILE: 02-WORKFLOW/15-CORRECTION-ADJUSTMENT.md
==================================================

# Correction & Adjustment Setelah Order CLOSED

## Prinsip Dasar

Setelah order berstatus CLOSED:
- **Tidak ada edit langsung** ke record yang sudah ada
- Setiap koreksi dibuat sebagai **record baru** yang merujuk ke record asli
- Ini menjaga integritas data dan audit trail

---

## Kapan Correction Diperlukan

- Ditemukan kesalahan input setelah order ditutup (misalnya: jumlah salah, harga salah)
- Ada penyesuaian keuangan setelah closing (misalnya: diskon yang terlambat dicatat)
- Koreksi material yang baru ditemukan ketika rekonsiliasi stok
- Ada komplain konsumen yang ditemukan setelah order CLOSED

---

## Siapa yang Bisa Buat Correction

- **Owner** — untuk semua jenis correction
- **Supervisor** — hanya untuk correction operasional (qty, material) bukan keuangan

Admin Sales dan Designer **tidak bisa** buat correction pada order yang sudah CLOSED.

---

## Alur Correction

```
Owner/Supervisor masuk ke halaman order (status: CLOSED)
  → Klik "Buat Koreksi"
  → Pilih kategori: Keuangan / Material / Quantity / Lainnya
  → Isi form:
      - Field yang dikoreksi
      - Nilai lama (sudah terisi otomatis dari data asli)
      - Nilai baru
      - Alasan koreksi (wajib, min 20 karakter)
  → Submit → Sistem buat record correction baru
  → Correction muncul di laporan sebagai catatan terpisah
  → Audit log mencatat: siapa, apa yang dikoreksi, kapan, alasan
```

---

## Hasil Correction

- Record asli **tidak berubah**
- Record correction baru dibuat dengan referensi ke record asli
- Laporan menampilkan nilai asli + nilai koreksi secara terpisah
- Laporan keuangan mencerminkan koreksi di bulan/periode saat koreksi dibuat (bukan periode asli)

---

## Database

Tabel `corrections`:
```
id
order_id          (FK ke orders)
corrected_entity  (contoh: payments, order_items, material_movements)
corrected_id      (FK ke record yang dikoreksi)
category          (FINANCIAL / MATERIAL / QUANTITY / OTHER)
field_name        (nama field yang dikoreksi)
old_value
new_value
reason            (wajib)
created_by        (user_id)
created_at
approved_by       (user_id Owner jika correction oleh Supervisor)
approved_at
```


==================================================
FILE: 02-WORKFLOW/16-DIRECT-SALES-POS.md
==================================================

# Direct Sales / POS Workflow

Fitur Direct Sales (Point of Sale) dirancang untuk memfasilitasi penjualan barang jadi (seperti kertas, bolpoin, penggaris, dsb) tanpa harus melalui alur panjang produksi printing.

## State Machine Khusus (OrderType.RETAIL)

Jika pesanan dibuat dengan `order_type = RETAIL`, sistem akan menggunakan "Fast-Track Workflow":

```
[ NEW_RETAIL_ORDER ] --> [ PAYMENT_COMPLETED ] --> [ CLOSED ]
```

### 1. NEW_RETAIL_ORDER
- **Aktor:** Kasir / Admin Sales (via modul POS)
- **Proses:** 
  - Kasir men-scan barcode atau memilih barang dari katalog `retail_products`.
  - Sistem membuat baris di tabel `orders` dengan `order_type = RETAIL`.
  - Item disimpan di `order_items` dengan merujuk pada `retail_product_id` (bukan `product_id`).
  - (Opsional) `customer_id` bisa diisi, atau dibiarkan `null` untuk pelanggan Walk-in/Guest.

### 2. PAYMENT_COMPLETED
- **Aktor:** Kasir
- **Proses:**
  - Kasir menerima pembayaran (Tunai/QRIS).
  - Saat pembayaran dikonfirmasi lunas:
    - Status pesanan langsung menjadi `PAYMENT_COMPLETED` (atau langsung `CLOSED`).
    - **Trigger Otomatis:** Sistem langsung memotong stok di tabel `retail_products` dan mencatat mutasi stok di `retail_stock_movements`.

### 3. CLOSED (Handover)
- **Aktor:** Kasir / Warehouse
- **Proses:**
  - Barang langsung diserahkan kepada pelanggan saat itu juga.
  - Pesanan dianggap ditutup dan masuk ke pelaporan pendapatan tanpa perlu melalui proses Design, Production, QC, atau Finishing.

## Penanganan Hybrid (Pelanggan Membeli Printing & Retail Sekaligus)
Berdasarkan keputusan desain, **pesanan hybrid tidak digabung dalam 1 nota**.
- Jika pelanggan memesan cetak spanduk dan membeli 1 lusin bolpoin:
  1. Kasir membuat **1 Nota RETAIL** khusus bolpoin. Transaksi selesai saat itu juga dan pelanggan membawa pulang bolpoinnya.
  2. CS/Desainer membuat **1 Nota PRINTING** khusus spanduk yang akan mengikuti alur panjang standar (Design -> Approval -> Produksi).
- Ini menghindari kompleksitas status "sebagian barang sudah diambil, sebagian masih diproduksi".


==================================================
FILE: 07-REPORTS/DAILY-REPORT.md
==================================================

# LAPORAN HARIAN (Daily Report)

## Akses
- Owner: akses penuh + export
- Supervisor: akses penuh + export (produksi & material, tanpa nominal keuangan detail)
- Admin Sales: akses ringkasan order & pickup + export
- Role lain: tidak ada akses

---

## 1. Ringkasan Harian

**Tampil di:** Dashboard Owner (widget) + halaman laporan lengkap

| Kolom | Keterangan |
|-------|-----------|
| Tanggal | |
| Total Order Baru | Jumlah order dibuat hari itu (PRINTING + RETAIL digabung, bisa difilter terpisah) |
| Order Selesai (Picked Up) | Jumlah order PRINTING status PICKED_UP hari itu |
| Transaksi Retail Selesai | Jumlah pesanan RETAIL dengan status CLOSED hari itu |
| Pendapatan Retail Hari Ini | Total nominal transaksi RETAIL yang CLOSED hari itu (hanya tampil ke Owner & Admin) |
| Job Produksi Aktif | Job berstatus PRODUCTION_STARTED / FINISHING_STARTED pada hari itu |
| Order Siap Diambil | Jumlah order READY_FOR_PICKUP belum diambil per akhir hari |
| Order Overdue | Jumlah order dengan deadline lewat, belum selesai |
| Jumlah Exception | Total insiden/anomali tercatat hari itu (QC FAIL, waste tinggi, WA gagal, dll) |

---

## 2. Daftar Order Hari Ini

| Kolom | Keterangan |
|-------|-----------|
| Kode Order | |
| Nama Konsumen | |
| Tipe Order | Walk-in / Makloon / WhatsApp / RETAIL |
| Status | Status pill sesuai `08-UI-UX/DESIGN-SYSTEM.md` |
| Status Pembayaran | Belum DP / DP Terpenuhi / Lunas |
| Deadline | |
| Dibuat Oleh | |

Filter: Semua / Draft / Produksi / Siap Diambil / Selesai / Overdue / **Retail**

---

## 3. Daftar Job Produksi Aktif

| Kolom | Keterangan |
|-------|-----------|
| Kode Job | |
| Kode Order | |
| Mesin | |
| Operator | |
| Status | PRODUCTION_STARTED / QC_PENDING / FINISHING_STARTED / dst |
| Deadline | |

---

## 4. Daftar Exception / Insiden Hari Ini

Ringkasan lintas modul, untuk deteksi masalah cepat tanpa perlu buka laporan detail per modul.

| Kolom | Keterangan |
|-------|-----------|
| Waktu | |
| Kategori | QC FAIL / Waste Tinggi / WA Gagal / Cancel Request / Stok Menipis / Lainnya |
| Kode Terkait | Job/Order/Bahan terkait |
| Deskripsi Singkat | |
| Status Tindak Lanjut | Menunggu / Selesai |

Filter tersedia: tanggal, kategori, status tindak lanjut.

---

## Catatan Penting

- Laporan Harian adalah ringkasan lintas modul untuk pemantauan cepat — detail lengkap per topik tetap ada di `EMPLOYEE-REPORT.md`, `FINANCIAL-REPORT.md`, `MATERIAL-REPORT.md`, `PRODUCTION-REPORT.md`
- Laporan Harian mencakup **kedua jenis transaksi** (PRINTING dan RETAIL) — dapat difilter terpisah di halaman laporan lengkap
- Data direfresh real-time selama hari berjalan; ringkasan final terkunci pada pukul 23:59 hari itu

---

## 5. Export

Semua laporan harian bisa diexport ke **PDF**, **XLSX**, **CSV**.
Export dicatat di audit log: siapa yang export, kapan, laporan apa.


==================================================
FILE: 07-REPORTS/EMPLOYEE-REPORT.md
==================================================

# LAPORAN PEGAWAI (Employee Report)

## Akses
- Owner: akses penuh + export
- Supervisor: akses ringkasan (tanpa data gaji/absensi detail)
- Role lain: tidak ada akses

> ⚠️ Laporan ini hanya untuk evaluasi kinerja operasional. Bukan sebagai satu-satunya bukti kesalahan atau pelanggaran disiplin.

---

## 1. Ringkasan Kinerja Pegawai

Periode: harian / mingguan / bulanan

| Kolom | Keterangan |
|-------|-----------|
| Nama Pegawai | |
| Role | |
| Jumlah Hari Hadir | Dari data fingerprint (jika sudah diimport) |
| Jumlah Hari Terlambat | |
| Rata-rata Jam Masuk | |
| Pelanggaran Istirahat | Jumlah istirahat melebihi 60 menit |
| Total Job Dikerjakan | (untuk operator/finishing/QC) |
| Total Qty Produksi | (untuk operator) |
| Total Waste | (untuk operator) |
| Jumlah QC Fail | (untuk QC inspector — fail yang ditemukan) |
| Jumlah Rework | (untuk operator — job yang harus diulang) |

---

## 2. Laporan Absensi Detail

| Kolom | Keterangan |
|-------|-----------|
| Nama Pegawai | |
| Tanggal | |
| Jam Masuk | Dari fingerprint |
| Status Masuk | TEPAT WAKTU / TERLAMBAT |
| Menit Terlambat | |
| Jam Mulai Istirahat | Dari PrintFlow |
| Jam Selesai Istirahat | Dari PrintFlow |
| Durasi Istirahat | |
| Status Istirahat | NORMAL / BERLEBIH |
| Catatan Owner | (jika ada) |

---

## 3. Laporan Aktivitas per Pegawai

Log semua aksi yang dilakukan oleh satu pegawai dalam periode tertentu.
Berguna untuk investigasi jika ada indikasi kecurangan.

| Kolom | Keterangan |
|-------|-----------|
| Waktu | |
| Aksi | |
| Entitas yang Diubah | Order / Job / Payment / dll |
| Detail | |

---

## 4. Export

Semua laporan pegawai bisa diexport ke **PDF** dan **XLSX**.
Export dicatat di audit log.


==================================================
FILE: 07-REPORTS/FINAL-AUDIT-REPORT.md
==================================================

# Final Audit Report

For each order show:

## Order
- Order ID
- Customer
- Product
- Quantity
- Deadline

## Finance
- total
- paid
- balance
- result

## Material
- expected
- issued
- used
- waste
- difference
- result

## Production
- Job ID
- machine
- operator
- planned qty
- actual qty
- reprint
- duration

## QC
- result
- inspector
- defects/rework

## Finishing
- operator
- completion
- QR/barcode verification

## Storage
- location
- stored by
- stored at
- storage scan result

## Customer Notification
- event
- recipient
- sent status
- sent time
- provider reference

## Pickup/Delivery
- release status
- receiver/courier
- timestamp

## Final Result
GREEN / YELLOW / RED


==================================================
FILE: 07-REPORTS/FINANCIAL-REPORT.md
==================================================

# LAPORAN KEUANGAN (Financial Report)

## Akses
- Owner: akses penuh + export
- Supervisor: lihat saja (tanpa nominal detail, hanya ringkasan)
- Admin Sales, Designer, Operator, dll: tidak ada akses

---

## 1. Laporan Pendapatan Harian

**Tampil di:** Dashboard Owner (widget) + halaman laporan lengkap

| Kolom | Keterangan |
|-------|-----------|
| Tanggal | |
| Total Order Baru | Jumlah order PRINTING dibuat hari itu |
| Total DP Masuk | Jumlah rupiah DP yang dikonfirmasi (PRINTING) |
| Total Pelunasan Masuk | Jumlah rupiah pelunasan yang dikonfirmasi (PRINTING) |
| Total Pendapatan Printing | DP + Pelunasan (PRINTING) |
| **Pendapatan Retail Hari Ini** | Total transaksi RETAIL yang CLOSED hari itu |
| **Total Pendapatan Gabungan** | Pendapatan PRINTING + Pendapatan RETAIL |
| Diskon yang Diberikan | Total nominal diskon yang di-approve |
| DP Hangus (Cancel) | DP dari order yang dibatalkan saat produksi sudah jalan |
| Piutang Baru | Order confirmed tapi belum lunas |

---

## 2. Laporan Piutang (Outstanding)

Daftar order yang sudah selesai atau sedang berjalan tapi belum lunas.

| Kolom | Keterangan |
|-------|-----------|
| Kode Order | |
| Nama Konsumen | |
| Total Order | |
| DP Dibayar | |
| Sisa yang Harus Dibayar | |
| Deadline Order | |
| Status Order | |
| Hari Sejak Siap Diambil | Untuk pressure collection |

Filter: Semua / Overdue / Belum Siap / Siap Diambil Belum Lunas

---

## 3. Laporan Bulanan Owner

**Periode:** Per bulan kalender (bisa pilih rentang custom)

| Metrik | Keterangan |
|--------|-----------|
| Total Omset (bruto) | Total nilai order PRINTING + nilai transaksi RETAIL |
| Total Diskon | |
| Total Omset (neto) | Bruto - Diskon |
| Total Pendapatan Masuk | Uang yang benar-benar diterima (DP + pelunasan PRINTING + RETAIL) |
| **Pendapatan Retail Bulanan** | Total transaksi RETAIL yang CLOSED dalam periode |
| **Persentase Retail vs Printing** | Perbandingan kontribusi dua lini bisnis |
| Total Piutang Akhir Bulan | Khusus PRINTING (RETAIL tidak ada piutang — pembayaran langsung) |
| Total DP Hangus | |
| Jumlah Order | Jumlah order PRINTING |
| **Jumlah Transaksi Retail** | Jumlah transaksi RETAIL yang CLOSED |
| Order Selesai | |
| Order Dibatalkan | |
| Rata-rata Nilai Order | Rata-rata nilai order PRINTING |
| **Rata-rata Nilai Transaksi Retail** | Rata-rata nominal transaksi RETAIL |
| Produk Terlaris | Top 5 produk PRINTING |
| **Produk Retail Terlaris** | Top 5 barang retail yang paling banyak terjual |
| Mesin Tersibuk | Berdasarkan jam produksi |

---

## 5. Laporan Penjualan Retail

**Akses:** Admin Sales (lihat), Owner (penuh + export)

Rekap khusus untuk transaksi `order_type = RETAIL`. Dapat difilter per hari/bulan.

| Kolom | Keterangan |
|-------|-----------|
| Tanggal Transaksi | |
| Kode Transaksi | Kode order RETAIL |
| Nama Pembeli | Nama konsumen atau "Guest" jika tidak terdaftar |
| Kasir | Admin Sales yang memproses |
| Produk Terjual | Nama produk retail + qty |
| Subtotal | |
| Diskon | Jika ada |
| Total | |
| Metode Pembayaran | TUNAI / QRIS |

Filter: Tanggal (dari–sampai), Kasir, Produk, Metode Pembayaran.

---

## 6. Laporan Diskon

Semua diskon yang pernah diberikan — untuk audit Owner.

| Kolom | Keterangan |
|-------|-----------|
| Kode Order | |
| Nama Konsumen | |
| Total Sebelum Diskon | |
| Nominal Diskon | |
| Persentase Diskon | |
| Disetujui Oleh | Nama Owner |
| Tanggal Approval | |
| Alasan Diskon | |

---

## 5. Export

Semua laporan keuangan bisa diexport ke:
- **PDF** (untuk arsip dan print)
- **XLSX / Excel** (untuk analisis lanjutan)
- **CSV** (untuk import ke tools lain)

Export dicatat di audit log: siapa yang export, kapan, laporan apa.

---

## Catatan Penting

- PrintFlow adalah **satu-satunya sumber kebenaran keuangan** — tidak ada rekap ke sistem lain
- Semua angka berdasarkan transaksi yang dikonfirmasi oleh Admin Sales
- **Laporan keuangan mencakup kedua lini:** PRINTING (DP/pelunasan) dan RETAIL (transaksi langsung). Keduanya dihitung dalam total pendapatan gabungan.
- RETAIL tidak memiliki sistem piutang — pembayaran langsung saat transaksi. Laporan piutang hanya mencakup PRINTING.
- Koreksi angka keuangan setelah CLOSED hanya lewat `02-WORKFLOW/15-CORRECTION-ADJUSTMENT.md`
- Tidak ada fitur delete transaksi — hanya correction record baru


==================================================
FILE: 07-REPORTS/MATERIAL-REPORT.md
==================================================

# LAPORAN MATERIAL (Material Report)

## Akses
- Owner: akses penuh + export
- Supervisor: akses penuh + export
- Admin Sales: akses penuh + export (karena yang input stok masuk)
- Role lain: tidak ada akses

---

## 1. Stok Saat Ini (Real-time)

Tampil di halaman Inventori, dikelompokkan per mesin.

| Kolom | Keterangan |
|-------|-----------|
| Nama Bahan | |
| Mesin | |
| Tipe | MEDIA / INK |
| Stok Saat Ini | |
| Satuan Stok | Roll / Meter / Liter / dll |
| Stok Minimum | |
| Status | 🟢 AMAN / 🟡 PERHATIAN / 🔴 MENIPIS |
| Terakhir Diupdate | |

---

## 2. Laporan Mutasi Stok

Semua pergerakan stok (masuk, keluar, waste, adjustment) dalam periode tertentu.

| Kolom | Keterangan |
|-------|-----------|
| Tanggal | |
| Nama Bahan | |
| Mesin | |
| Tipe Gerakan | IN / OUT / WASTE / ADJUSTMENT |
| Jumlah | |
| Satuan | |
| Stok Sebelum | |
| Stok Sesudah | |
| Terhubung ke Job | (jika OUT) |
| Dikerjakan Oleh | Nama pegawai |
| Alasan / Catatan | |

Filter tersedia: per bahan, per mesin, per tipe gerakan, per tanggal, per pegawai.

---

## 3. Laporan Pemakaian Bulanan

Rekap pemakaian per bahan per bulan — berguna untuk estimasi pembelian bulan berikutnya.

| Bahan | Stok Awal Bulan | Total Masuk | Total Terpakai | Total Waste | Stok Akhir Bulan | Rekomendasi Beli |
|-------|----------------|-------------|----------------|-------------|-----------------|-----------------|

---

## 4. Laporan Anomali Material

Sistem secara otomatis menandai hal-hal berikut sebagai anomali:
- Bahan keluar tanpa Job ID (menandakan kebocoran stok)
- Waste yang sangat tinggi di satu job (> 20% dari total pemakaian)
- Adjustment tanpa alasan yang jelas
- Stok minus (seharusnya tidak terjadi — sistem blokir, tapi dicatat jika terjadi bug)

Laporan anomali muncul di dashboard Owner dengan label merah.

---

## 5. Export

Semua laporan material bisa diexport ke **PDF**, **XLSX**, **CSV**.


==================================================
FILE: 07-REPORTS/MONTHLY-OWNER-REPORT.md
==================================================

# LAPORAN BULANAN OWNER (Monthly Owner Report)

## Akses
- Owner: akses penuh + export
- Role lain: tidak ada akses

> Untuk detail keuangan lengkap (omset, piutang, diskon, produk terlaris, mesin tersibuk), lihat `07-REPORTS/FINANCIAL-REPORT.md` §3 "Laporan Bulanan Owner". Laporan ini fokus pada metrik **operasional non-finansial** sebagai ringkasan level-tinggi bagi Owner.

---

## 1. Ringkasan Operasional Bulanan

**Periode:** Per bulan kalender (bisa pilih rentang custom)

| Metrik | Keterangan |
|--------|-----------|
| Total Order | Jumlah order dibuat dalam periode |
| Order Selesai (Picked Up) | Jumlah & persentase completion rate terhadap total order |
| Order Dibatalkan | Jumlah & persentase cancel terhadap total order |
| Order Overdue | Jumlah order yang pernah melewati deadline dalam periode |
| Rata-rata Waktu Penyelesaian | Dari CONFIRMED sampai PICKED_UP |
| Total Waste Material | Akumulasi waste seluruh mesin (lihat detail per bahan di `MATERIAL-REPORT.md` §3) |
| Persentase Waste | waste / (aktual + waste) × 100% |
| Jumlah QC FAIL | Total job FAIL dalam periode |
| Jumlah Rework | Total job yang melalui proses rework |
| Jumlah Eskalasi ke Owner | Rework yang FAIL 2x berturut, wajib keputusan Owner |
| Jumlah Exception Audit | Total temuan RED/YELLOW dari `FINAL-AUDIT-REPORT.md` dalam periode |

Ringkasan ini merujuk ke `PRODUCTION-REPORT.md` dan `MATERIAL-REPORT.md` untuk breakdown lengkap per mesin/operator/bahan.

---

## 2. Completion Rate per Kategori Produk

| Kolom | Keterangan |
|-------|-----------|
| Kategori Produk | Outdoor / Indoor / Sublimasi / A3 / UV / DTF / Bendera |
| Total Order | |
| Selesai Tepat Waktu | |
| Selesai Terlambat | |
| Dibatalkan | |
| Completion Rate | Selesai / Total × 100% |

---

## 3. Audit Exception Bulanan

Rekap temuan Final Audit (`FINAL-AUDIT-REPORT.md`) sepanjang bulan.

| Kolom | Keterangan |
|-------|-----------|
| Kode Order | |
| Kategori Exception | Finance / Material / Quantity / Production / QC / Finishing / Storage / Pickup |
| Hasil Akhir | GREEN / YELLOW / RED |
| Status Tindak Lanjut | Selesai / Menunggu |
| Catatan | |

Filter: kategori exception, status tindak lanjut, hasil akhir (GREEN/YELLOW/RED).

---

## 4. Overdue & Anomali

| Kolom | Keterangan |
|-------|-----------|
| Kode Order/Job | |
| Kategori Anomali | Overdue / Waste Tinggi / Bahan Keluar Tanpa Job ID / Adjustment Tanpa Alasan |
| Tanggal Ditemukan | |
| Status | Selesai Ditangani / Masih Terbuka |

Sumber data anomali material mengikuti definisi di `MATERIAL-REPORT.md` §4.

---

## Catatan Penting

- Laporan ini adalah ringkasan operasional bulanan — untuk angka omset, piutang, diskon, produk terlaris, dan mesin tersibuk, buka `FINANCIAL-REPORT.md` §3 agar tidak terjadi duplikasi sumber data
- Untuk breakdown kinerja pegawai per bulan, lihat `EMPLOYEE-REPORT.md`

---

## 5. Export

Laporan bulanan Owner bisa diexport ke **PDF**, **XLSX**, **CSV**.
Export dicatat di audit log: siapa yang export, kapan, laporan apa.


==================================================
FILE: 07-REPORTS/PRODUCTION-REPORT.md
==================================================

# LAPORAN PRODUKSI (Production Report)

## Akses
- Owner: akses penuh + export
- Supervisor: akses penuh + export
- Admin Sales: lihat ringkasan saja
- Operator, QC, Finishing: tidak ada akses laporan

---

## 1. Laporan Harian Produksi

**Tampil di:** Dashboard Supervisor + Owner

| Kolom | Keterangan |
|-------|-----------|
| Job Code | |
| Order Code | |
| Nama Produk | |
| Mesin | |
| Operator | |
| Qty Target | |
| Qty Aktual | |
| Waste | Jumlah bahan terbuang |
| Durasi Produksi | actual_end - actual_start |
| Status | Selesai / Rework / Gagal |
| Keterangan | |

---

## 2. Laporan Kinerja per Mesin

**Periode:** Harian / Mingguan / Bulanan

| Kolom | Keterangan |
|-------|-----------|
| Nama Mesin | |
| Total Job | |
| Total Qty Produksi | |
| Total Waste | |
| Persentase Waste | waste / (aktual + waste) × 100% |
| Rata-rata Durasi per Job | |
| Total Jam Kerja Mesin | |
| Jumlah QC Fail | |
| Jumlah Rework | |
| Utilisasi Mesin | jam kerja / jam tersedia × 100% |

---

## 3. Laporan Kinerja per Operator

| Kolom | Keterangan |
|-------|-----------|
| Nama Operator | |
| Total Job Selesai | |
| Total Qty Produksi | |
| Total Waste | |
| Persentase Waste | |
| Rata-rata Durasi per Job | |
| Jumlah QC Fail di Job Mereka | |
| Jumlah Rework | |

> ⚠️ Laporan ini hanya untuk evaluasi kinerja — bukan sebagai satu-satunya bukti kesalahan. Gunakan bersama data audit log dan catatan supervisor.

---

## 4. Laporan Waste Material

Waste yang tinggi bisa menandakan masalah teknis mesin, skill operator, atau kualitas bahan.

| Kolom | Keterangan |
|-------|-----------|
| Tanggal | |
| Job Code | |
| Mesin | |
| Operator | |
| Bahan yang Terbuang | |
| Jumlah Waste | |
| Satuan | |
| Alasan | Dari input operator |
| Estimasi Nilai Waste | qty × standard_cost |

---

## 5. Laporan QC

| Kolom | Keterangan |
|-------|-----------|
| Job Code | |
| QC Inspector | |
| Tanggal Inspeksi | |
| Hasil | PASS / FAIL |
| Kategori Masalah | (jika FAIL) |
| Rework Ke- | 0 = pertama kali lulus, 1 = rework 1x, dst |
| Keputusan Owner | Approve / Reject rework |

---

## 6. Export

Semua laporan produksi bisa diexport ke **PDF**, **XLSX**, **CSV**.


==================================================
FILE: 00-PROJECT/12-IMPLEMENTATION-PLAN.md
==================================================

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


==================================================
FILE: 00-PROJECT/ANTIGRAVITY-PROMPT.md
==================================================

# Antigravity Master Prompt

Build the Printing Workflow System using all documents in this repository as the source of truth.

This is not merely a POS application. It is an operational control system for a printing business.

Primary workflow:
CUSTOMER -> DESIGNER/SALES -> ORDER -> DESIGN -> CUSTOMER APPROVAL -> PAYMENT -> PRODUCTION -> MATERIAL CONTROL -> QC -> FINISHING -> STORAGE -> PICKUP/DELIVERY -> FINAL AUDIT -> CLOSED

Critical rules:
1. Designer/Sales can be the direct entry point for customers.
2. Designer/Sales may create orders and designs.
3. Designer/Sales cannot silently control company payment, material issue, warehouse release, or final closing.
4. Every production action requires a valid Job ID.
5. Every material movement must be traceable.
6. Every finished job must have a storage location.
7. Final Audit is mandatory before CLOSED.
8. RED audit blocks closing.
9. CLOSED records cannot be silently edited/deleted.
10. Critical actions require audit logs.

Implement role-based access, server-side authorization, relational database, validation, audit trail, reporting, responsive UI, QR-ready workflows, and exportable reports.

Read all files before implementation. Do not invent business rules that conflict with these documents.


==================================================
FILE: 00-PROJECT/PROJECT-GOALS.md
==================================================

# Project Goals

## Goal utama
Membuat sistem percetakan yang transparan, mudah digunakan, dan sulit dimanipulasi.

## Masalah yang harus diselesaikan
- Desainer dapat memotong order dan menerima uang pribadi.
- Customer dapat berpindah ke hubungan personal.
- Material tidak tercatat.
- Waste tidak terkontrol.
- Barang jadi sulit ditemukan.
- Owner sulit mengetahui siapa melakukan apa.
- Tidak ada audit akhir yang konsisten.

## Kontrol barang jadi
Setiap Job memiliki QR/Barcode. Finishing melakukan scan, warehouse melakukan scan lokasi, lalu sistem mengubah status menjadi READY_FOR_PICKUP.

## Notifikasi customer
Setelah storage berhasil dikonfirmasi, sistem dapat otomatis mengirim WhatsApp kepada customer bahwa barang sudah selesai dan siap diambil/dikirim.

## Prinsip
- Setiap transaksi memiliki ID.
- Setiap produksi memiliki Job ID.
- Setiap material movement tercatat.
- Setiap barang jadi memiliki lokasi.
- Setiap aktivitas penting memiliki actor dan timestamp.
- CLOSED berarti terkunci.


==================================================
FILE: 00-PROJECT/PROJECT.md
==================================================

# PROJECT — Sistem Workflow Percetakan

## Tujuan

Membangun sistem manajemen workflow digital untuk percetakan yang mencakup:
- Pengelolaan order dari awal (konsumen datang) hingga akhir (barang diambil)
- Pelacakan produksi berbasis QR Code yang di-scan via kamera HP/tablet di browser
- Notifikasi otomatis ke konsumen via WhatsApp saat barang siap diambil
- Perlindungan data konsumen dari akses yang tidak berhak
- Audit trail real-time untuk mencegah kecurangan pegawai
- Laporan untuk Owner

---

## Scope Sistem

### Yang Dicakup (In-Scope)
- Order management (dari draft hingga closed)
- Manajemen desain & approval
- Produksi & QR tracking (10 titik scan)
- QC & rework workflow
- Finishing & label cetak
- Storage 2 lantai (Lantai 3 gudang, Lantai 1 counter)
- Pickup oleh konsumen (semua konsumen datang langsung ke toko)
- Notifikasi WhatsApp otomatis ke konsumen
- Inventory material
- Laporan & dashboard per role
- Audit trail real-time
- Manajemen user & RBAC (8 role)

### Yang Tidak Dicakup (Out-of-Scope)
- Pengiriman via kurir (delivery) — semua konsumen datang langsung ke toko
- Payment gateway online (pembayaran offline/manual)
- Customer portal (konsumen tidak punya login ke sistem)
- Machine integration sensor otomatis
- E-commerce / marketplace integration

---

## Alur Order Utama (Ringkasan)

```
KONSUMEN DATANG / HUBUNGI TOKO
  ↓
DESIGNER/SALES input order + data konsumen
  ↓
APPROVAL DESAIN (sesuai tipe konsumen — lihat detail di 03-DESIGN-APPROVAL.md)
  ↓
KONFIRMASI PAYMENT (DP 50%)
  ↓
PRODUKSI (scan QR di setiap titik)
  ↓
QC → PASS / FAIL (jika FAIL: rework workflow)
  ↓
FINISHING + LABEL CETAK
  ↓
SIMPAN KE GUDANG (LT3) + SCAN LOKASI
  ↓
NOTIFIKASI WHATSAPP OTOMATIS ke konsumen
  ↓
KONSUMEN DATANG → VERIFIKASI → RELEASE
  ↓
FINAL AUDIT → CLOSED
```

---

## Tipe Konsumen

| Tipe | Cara Order | Approval Desain |
|------|-----------|----------------|
| **Walk-in** | Datang langsung ke toko | Langsung di tempat — tidak perlu digital |
| **Makloon** | Bawa file desain sendiri | File langsung dicetak, tidak butuh approval |
| **WhatsApp** | Order via WA | Admin Sales konfirmasi di sistem |

---

## Modul yang Harus Dibangun

1. Authentication & User Management
2. Customer Management (dengan proteksi data sensitif)
3. Order Management
4. Design & Approval
5. Payment Management
6. Production & Job Management
7. QC & Rework
8. Finishing & Label
9. Storage (2 lantai)
10. Pickup & Release
11. WhatsApp Notification (+ Email fallback)
12. Material Inventory
13. Audit Trail
14. Reports & Dashboard
15. QR Code Generate & Scan

---

## Role yang Ada

| Role | Fungsi Utama |
|------|-------------|
| Owner | Akses penuh, laporan, approve exception |
| Supervisor | Kelola produksi, approve rework, monitor |
| Admin Sales | Order, payment, pickup, notifikasi |
| Designer Sales | Desain, versioning, approval |
| Operator | Produksi, scan QR, input qty/waste |
| QC | Inspeksi, PASS/FAIL, approve rework |
| Finishing | Packing, label, scan QR |
| Warehouse | Gudang, storage in/out, release |


---

## Catatan Implementasi

- Platform: **Web application** (bukan mobile app)
- Scan QR: via kamera HP/tablet di browser (tidak perlu install apapun)
- Semua konsumen **datang langsung ke toko** — tidak ada fitur delivery kurir
- **Frontend** (tampilan & workflow UI) dikerjakan terpisah oleh tim desain
- **Backend & database** dikerjakan terpisah oleh tim developer
- Dokumentasi ini adalah spesifikasi lengkap untuk kedua tim

---

## Status Proyek

| Fase | Status |
|------|--------|
| Dokumentasi Sistem | ✅ Selesai (folder ini) |
| Implementasi Backend | 🔜 Belum mulai |
| Implementasi Frontend | 🔜 Belum mulai |
| Testing & QA | 🔜 Belum mulai |
| Go-Live | 🔜 Belum mulai |


==================================================
FILE: 00-PROJECT/README.md
==================================================

# PRINTING WORKFLOW SYSTEM

Sistem manajemen dan kontrol operasional percetakan.

Tujuan utama:
1. Menutup kebocoran order dan pembayaran.
2. Mengontrol bahan dan waste.
3. Mengontrol produksi berdasarkan Job ID.
4. Mengetahui lokasi barang jadi.
5. Menyediakan audit trail.
6. Mewajibkan Final Audit sebelum closing.
7. Menyediakan laporan yang mudah dipahami owner.

Alur utama:

CUSTOMER -> DESIGNER/SALES -> ORDER -> DESIGN -> APPROVAL -> PAYMENT -> PRODUCTION -> MATERIAL -> QC -> FINISHING -> STORAGE -> PICKUP/DELIVERY -> FINAL AUDIT -> CLOSED

Semua dokumen di folder ini menjadi sumber aturan bisnis dan teknis untuk pembangunan aplikasi.


==================================================
FILE: 05-DATABASE/AUDIT-LOG.md
==================================================

# Audit Log

Log:
- login/logout
- order create/update
- price changes
- payment actions
- design upload/approval
- production start/finish
- material movements
- QC
- finishing
- storage movement
- pickup/release
- audit
- closing
- role/permission changes

Store actor, action, entity, old value, new value, timestamp, and request metadata where appropriate.

Closed data must use correction/adjustment rather than destructive editing.


==================================================
FILE: 05-DATABASE/DATABASE-ARCHITECTURE.md
==================================================

# Database Architecture

Use a relational database.

Core entities:
users, roles, customers, products, materials, material_stock, orders, order_items, design_jobs, design_versions, machines, production_jobs, material_movements, qc_records, finishing_jobs, storage_locations, storage_items, payments, deliveries, pickup_records, audits, audit_items, audit_logs, notifications.

Use foreign keys and indexes for IDs, status, customer, job, timestamps.


==================================================
FILE: 05-DATABASE/RELATIONSHIPS.md
==================================================

# Relationships

Customer 1:N Orders
Order 1:N Order Items
Order 1:1 Design Job
Design Job 1:N Design Versions
Order 1:N Production Jobs
Production Job N:1 Machine
Production Job N:1 Operator/User
Production Job 1:N Material Movements
Production Job 1:N QC Records
Production Job 1:1 Finishing Job
Production Job 1:N Storage Items
Storage Location 1:N Storage Items
Order 1:N Payments
Order 1:1 Pickup record
Order 1:N Notification Events
Order 1:N Audits
Audit 1:N Audit Items
All critical entities 1:N Audit Logs


==================================================
FILE: 05-DATABASE/TABLES.md
==================================================

# Tables

Konvensi tipe data: `id`/`*_id` (FK) = `uuid`; harga/nominal = `decimal`; waktu = `timestamptz`; teks pendek (kode, nama, status/enum) = `varchar`; teks panjang (notes, deskripsi, alasan) = `text`; boolean = `boolean`; angka bulat non-uang (qty, count) = `integer`.

## users
id (uuid, PK), name (varchar), username (varchar, unique), email (varchar, unique), password_hash (varchar), role_id (uuid, FK → roles.id), phone (varchar) [SENSITIVE], active (boolean), last_login_at (timestamptz),
failed_login_count (integer), locked_until (timestamptz),
must_change_password (boolean),
deactivated_at (timestamptz), deactivated_by (uuid, FK → users.id), created_at (timestamptz), updated_at (timestamptz)

## roles
id (uuid, PK), name (varchar)
*(Values: owner, supervisor, admin_sales, designer_sales, operator, qc, finishing, warehouse)*

## customers
id (uuid, PK), customer_code (varchar, unique, CST-XXXXX), name (varchar), phone (varchar) [SENSITIVE], email (varchar) [SENSITIVE], address (text), company (varchar), notes (text), created_by (uuid, FK → users.id), created_at (timestamptz), updated_at (timestamptz)
*Akses phone/email: hanya admin_sales, supervisor, owner*

## products
id (uuid, PK), name (varchar), category (varchar), default_material_id (uuid, FK → materials.id), active (boolean)

---

## MACHINES & MATERIALS

## machines
id (uuid, PK), machine_code (varchar, unique, M-OUT-01, M-IND-01, ...), name (varchar), category (varchar)
(OUTDOOR/INDOOR/SUBLIMASI/A3/UV/DTF/BENDERA),
status (varchar, enum: ACTIVE/MAINTENANCE/INACTIVE),
notes (text), created_at (timestamptz), updated_at (timestamptz)

## materials
id (uuid, PK), material_code (varchar, unique, MAT-OUT-001, MAT-INK-OUT-001, MAT-SHARED-001 ...),
name (varchar), type (varchar, enum: MEDIA/INK),
unit_stock (varchar, enum: ROLL/METER/LEMBAR/LITER/KG/RIM/BOTOL/PCS/CUSTOM — satuan pencatatan stok),
unit_usage (varchar, enum: METER/LEMBAR/ML/GRAM/PCS/CUSTOM — satuan pemakaian operator),
unit_custom (varchar, diisi jika salah satu = CUSTOM),
conversion_factor (decimal, contoh: 1 Roll = 50 Meter → factor = 50),
is_shared (boolean — true jika bisa dipakai di lebih dari 1 mesin),
min_stock (decimal), current_stock (decimal), standard_cost (decimal),
added_by (uuid, FK → users.id), active (boolean), created_at (timestamptz), updated_at (timestamptz)
*(Admin/Owner dapat menambahkan bahan baru kapan saja)*

## machine_materials
id (uuid, PK), machine_id (uuid, FK → machines.id), material_id (uuid, FK → materials.id)
*(Relasi many-to-many: satu bahan bisa dipakai di beberapa mesin)*
*(Bahan shared (is_shared=true) memiliki lebih dari 1 baris di tabel ini)*

## material_movements
id (uuid, PK), material_id (uuid, FK → materials.id), machine_id (uuid, FK → machines.id — mesin mana yang pakai, penting untuk shared material),
job_id (uuid, FK → production_jobs.id, nullable — null jika IN/ADJUSTMENT),
movement_type (varchar, enum: IN/OUT/WASTE/ADJUSTMENT),
quantity_usage (decimal, dalam unit_usage — input dari operator),
quantity_stock_change (decimal, setelah konversi ke unit_stock),
before_stock (decimal), after_stock (decimal),
supplier (varchar, nullable, untuk tipe IN),
unit_cost (decimal, nullable, untuk tipe IN),
performed_by (uuid, FK → users.id), reason (text), created_at (timestamptz)

---

## ORDERS

## orders
id (uuid, PK), order_code (varchar, unique, ORD-YYYYMMDD-XXXX), order_type (varchar, enum: PRINTING/RETAIL), customer_id (uuid, FK → customers.id, nullable untuk RETAIL guest), created_by (uuid, FK → users.id), designer_id (uuid, FK → users.id, nullable untuk RETAIL),
status (varchar, enum: DRAFT, DESIGNING, ..., NEW_RETAIL_ORDER, RETAIL_PAYMENT_COMPLETED, CLOSED — lihat `09-TECHNICAL/STATUS-MACHINE.md`), subtotal (decimal), discount (decimal), discount_approved_by (uuid, FK → users.id), discount_approved_at (timestamptz), discount_reason (text),
total (decimal), dp_required (decimal, total × 0.5, nullable untuk RETAIL), dp_override_pct (decimal), dp_override_by (uuid, FK → users.id), dp_override_reason (text),
paid_amount (decimal), balance (decimal), deadline (timestamptz, nullable untuk RETAIL), notes (text),
cancelled_at (timestamptz), cancelled_by (uuid, FK → users.id), cancellation_reason (text), cancellation_approved_by (uuid, FK → users.id),
dp_refund_amount (decimal), dp_refund_method (varchar),
closed_at (timestamptz), created_at (timestamptz), updated_at (timestamptz)

## order_items
id (uuid, PK), order_id (uuid, FK → orders.id), product_id (uuid, FK → products.id, nullable), retail_product_id (uuid, FK → retail_products.id, nullable), description (text), quantity (integer), size (varchar), material_id (uuid, FK → materials.id, nullable), finishing (varchar), unit_price (decimal), total_price (decimal)

---

## RETAIL & POS

## retail_products
id (uuid, PK), sku (varchar, unique), name (varchar), category (varchar), price (decimal), stock_quantity (integer), min_stock (integer), active (boolean), created_at (timestamptz), updated_at (timestamptz)

## retail_stock_movements
id (uuid, PK), retail_product_id (uuid, FK → retail_products.id), order_id (uuid, FK → orders.id, nullable), movement_type (varchar, enum: IN/OUT/ADJUSTMENT), quantity_change (integer), before_stock (integer), after_stock (integer), performed_by (uuid, FK → users.id), reason (text), created_at (timestamptz)

---

## DESIGN

## design_jobs
id (uuid, PK), order_id (uuid, FK → orders.id), designer_id (uuid, FK → users.id), status (varchar, enum), current_version (integer), approval_method (varchar, enum:
WALK_IN/MAKLOON/WHATSAPP), created_at (timestamptz), updated_at (timestamptz)

## design_versions
id (uuid, PK), design_job_id (uuid, FK → design_jobs.id), version_no (integer), file_path (varchar), preview_path (varchar), uploaded_by (uuid, FK → users.id), uploaded_at (timestamptz),
approval_status (varchar, enum: PENDING/APPROVED/REJECTED), approved_at (timestamptz), approved_by (uuid, FK → users.id),
approval_method (varchar, enum: WALK_IN/MAKLOON/WHATSAPP), approval_notes (text), rejection_reason (text)

---

## PRODUCTION

## production_jobs
id (uuid, PK), order_id (uuid, FK → orders.id), job_code (varchar, unique, JOB-YYYYMMDD-XXXX), machine_id (uuid, FK → machines.id), operator_id (uuid, FK → users.id), status (varchar, enum), priority (integer),
planned_start (timestamptz), planned_end (timestamptz), actual_start (timestamptz), actual_end (timestamptz),
planned_qty (integer), actual_qty (integer), reprint_qty (integer), waste_qty (integer), waste_reason (text),
parent_job_id (uuid, FK → production_jobs.id, untuk rework), rework_count (integer), rework_reason (text),
notes (text), created_at (timestamptz), updated_at (timestamptz)

## qc_records
id (uuid, PK), job_id (uuid, FK → production_jobs.id), inspector_id (uuid, FK → users.id), result (varchar, enum: PASS/FAIL/PENDING), checklist_json (jsonb),
notes (text), photo_path (varchar), rework_recommendation (varchar),
rework_decision (varchar, enum: APPROVED/REJECTED/HOLD), rework_decided_by (uuid, FK → users.id), rework_decided_at (timestamptz), rework_reason (text),
created_at (timestamptz)

## finishing_jobs
id (uuid, PK), job_id (uuid, FK → production_jobs.id), operator_id (uuid, FK → users.id), status (varchar, enum), started_at (timestamptz), completed_at (timestamptz), actual_qty (integer), notes (text),
job_qr_scanned_at (timestamptz), label_printed_at (timestamptz), created_at (timestamptz)

---

## STORAGE

## storage_locations
id (uuid, PK), location_code (varchar, unique, LT3-A-01-01 / LT1-COUNTER-01), name (varchar), floor (integer, 1/3), zone (varchar), rack (varchar), slot (varchar),
capacity_max (integer, default 1), capacity_current (integer),
qr_code_value (varchar), active (boolean), created_at (timestamptz)

## storage_items
id (uuid, PK), job_id (uuid, FK → production_jobs.id), location_id (uuid, FK → storage_locations.id), quantity (integer), status (varchar, enum: STORED/IN_TRANSIT/RELEASED/INCIDENT),
stored_by (uuid, FK → users.id), stored_at (timestamptz),
transit_at (timestamptz), transit_by (uuid, FK → users.id), transit_location_id (uuid, FK → storage_locations.id),
released_by (uuid, FK → users.id), released_at (timestamptz),
incident_reported_at (timestamptz), incident_reported_by (uuid, FK → users.id), incident_notes (text)

---

## PAYMENT & PICKUP

## payments
id (uuid, PK), order_id (uuid, FK → orders.id), amount (decimal), method (varchar, enum: CASH/TRANSFER/QRIS), reference (varchar), status (varchar, enum: PENDING/CONFIRMED/REJECTED),
received_by (uuid, FK → users.id), paid_at (timestamptz), notes (text)

## pickup_records
id (uuid, PK), order_id (uuid, FK → orders.id), released_by (uuid, FK → users.id), receiver_name (varchar), receiver_id_type (varchar), receiver_id_number (varchar), photo_path (varchar), notes (text), released_at (timestamptz)

---

## NOTIFICATION

## notification_events
id (uuid, PK), order_id (uuid, FK → orders.id), customer_id (uuid, FK → customers.id), event_type (varchar), channel (varchar, enum: WHATSAPP/EMAIL),
recipient (varchar) [SENSITIVE], template_code (varchar), status (varchar, enum: PENDING/SENT/FAILED/RETRY),
provider_message_id (varchar), error_message (text), sent_at (timestamptz),
is_resend (boolean), resent_by (uuid, FK → users.id), retry_count (integer), created_at (timestamptz)

---

## AUDIT & REPORTING

## audits
id (uuid, PK), order_id (uuid, FK → orders.id), audited_by_id (uuid, FK → users.id — dilakukan oleh Admin Sales), result (varchar, enum: GREEN/YELLOW/RED),
financial_status (varchar), material_status (varchar), quantity_status (varchar), production_status (varchar), storage_status (varchar),
exception_count (integer), notes (text), audited_at (timestamptz), approved_at (timestamptz), approved_by (uuid, FK → users.id)

## audit_items
id (uuid, PK), audit_id (uuid, FK → audits.id), category (varchar), severity (varchar, enum: INFO/WARNING/CRITICAL), expected_value (varchar), actual_value (varchar), difference (varchar), status (varchar), note (text)

## audit_logs
id (uuid, PK), actor_id (uuid, FK → users.id), action (varchar), entity_type (varchar), entity_id (uuid),
old_value_json (jsonb), new_value_json (jsonb),
ip_address (varchar), user_agent (varchar), notes (text), created_at (timestamptz)
*(Tidak ada UPDATE/DELETE endpoint. Hanya INSERT. Owner bisa hapus via panel khusus dengan logging terpisah.)*

## corrections
id (uuid, PK), order_id (uuid, FK → orders.id), corrected_entity (varchar), corrected_id (uuid),
category (varchar, enum: FINANCIAL/MATERIAL/QUANTITY/OTHER),
field_name (varchar), old_value (text), new_value (text), reason (text),
created_by (uuid, FK → users.id), created_at (timestamptz),
approved_by (uuid, FK → users.id), approved_at (timestamptz)

## deadline_alerts
id (uuid, PK), order_id (uuid, FK → orders.id),
alert_type (varchar, enum: H1_WARNING/OVERDUE),
triggered_at (timestamptz), resolved_at (timestamptz)

---

## ABSENSI

## attendance_imports
id (uuid, PK), imported_by (uuid, FK → users.id), import_date (timestamptz), file_path (varchar),
period_start (timestamptz), period_end (timestamptz), row_count (integer), late_count (integer), created_at (timestamptz)

## attendance_records
id (uuid, PK), import_id (uuid, FK → attendance_imports.id), user_id (uuid, FK → users.id, nullable),
employee_name (varchar), date (timestamptz),
check_in (timestamptz), check_out (timestamptz),
check_in_status (varchar, enum: ON_TIME/LATE), late_minutes (integer),
break_start (timestamptz), break_end (timestamptz), break_duration_min (integer),
break_status (varchar, enum: NORMAL/EXCEEDED),
warning_sent_at (timestamptz),
owner_note (text), created_at (timestamptz)
*(Data tidak bisa diedit. Owner hanya bisa isi owner_note.)*

---

## Catatan Umum Database

- Semua tabel menggunakan UUID untuk primary key
- Semua tabel memiliki `created_at` dan `updated_at` (kecuali audit_logs dan attendance_records yang immutable)
- Field [SENSITIVE] distrip dari API response untuk role yang tidak berhak
- Tidak ada soft-delete untuk tabel inti — nonaktifkan dengan field `active = false`
- `audit_logs` dan `attendance_records` menggunakan role PostgreSQL khusus yang hanya punya INSERT permission

---

## Index yang Direkomendasikan

Index dipilih untuk mendukung pola akses paling sering: filter status per tahap workflow, lookup via kode unik (scan QR, pencarian), sorting/filter berdasarkan tanggal, dan join lewat foreign key.

### Kolom status (filter cepat per tahap workflow)
- `orders.status`
- `production_jobs.status`
- `qc_records.result`
- `finishing_jobs.status`
- `storage_items.status`
- `payments.status`
- `notification_events.status`
- `design_versions.approval_status`
- `machines.status`
- `materials.active`, `customers.active`, `users.active`
- `attendance_records.check_in_status`, `attendance_records.break_status`

### Kolom kode unik (lookup exact — scan QR, pencarian manual)
- `orders.order_code` (unique index)
- `production_jobs.job_code` (unique index)
- `customers.customer_code` (unique index)
- `storage_locations.location_code` (unique index)
- `materials.material_code` (unique index)
- `machines.machine_code` (unique index)
- `users.username` (unique index)

### Kolom timestamp (sorting/filter tanggal)
- `orders.created_at`, `orders.deadline`
- `production_jobs.created_at`, `production_jobs.planned_start`, `production_jobs.planned_end`
- `payments.paid_at`
- `audit_logs.created_at`
- `material_movements.created_at`
- `notification_events.sent_at`
- `deadline_alerts.triggered_at`
- `attendance_records.date`

### Foreign key (semua kolom `*_id` yang merujuk tabel lain)
Semua kolom bertipe `FK →` pada daftar tabel di atas direkomendasikan memiliki index, termasuk namun tidak terbatas pada:
`users.role_id`, `customers.created_by`, `products.default_material_id`, `machine_materials.machine_id` + `machine_materials.material_id` (composite unique index untuk mencegah duplikasi pasangan mesin-material), `material_movements.material_id` + `material_movements.machine_id` + `material_movements.job_id`, `orders.customer_id` + `orders.designer_id` + `orders.created_by`, `order_items.order_id` + `order_items.product_id` + `order_items.material_id`, `design_jobs.order_id` + `design_jobs.designer_id`, `design_versions.design_job_id`, `production_jobs.order_id` + `production_jobs.machine_id` + `production_jobs.operator_id` + `production_jobs.parent_job_id`, `qc_records.job_id` + `qc_records.inspector_id`, `finishing_jobs.job_id` + `finishing_jobs.operator_id`, `storage_items.job_id` + `storage_items.location_id` + `storage_items.transit_location_id`, `payments.order_id`, `pickup_records.order_id`, `notification_events.order_id` + `notification_events.customer_id`, `audits.order_id` + `audits.audited_by_id`, `audit_items.audit_id`, `audit_logs.actor_id` + composite (`entity_type`, `entity_id`) untuk lookup riwayat per entitas, `corrections.order_id`, `deadline_alerts.order_id`, `attendance_records.import_id` + `attendance_records.user_id`.

### Index komposit tambahan yang berguna
- `production_jobs (machine_id, status)` — antrian per mesin
- `production_jobs (operator_id, status)` — job aktif per operator
- `orders (status, deadline)` — deteksi overdue per status
- `storage_items (location_id, status)` — cek kapasitas lokasi real-time


==================================================
FILE: 11-FUTURE/ABSENSI-FINGERPRINT.md
==================================================

# ABSENSI — Aturan & Workflow

## Model Hybrid

Sistem menggunakan pendekatan hybrid antara mesin fingerprint dan PrintFlow:

| Aktivitas | Dicatat di | Keterangan |
|-----------|-----------|-----------|
| Masuk kerja | Mesin Fingerprint | Import CSV ke PrintFlow |
| Pulang kerja | Mesin Fingerprint | Import CSV ke PrintFlow |
| Mulai Istirahat | PrintFlow (tombol di HP/browser) | Real-time tracking |
| Selesai Istirahat | PrintFlow (tombol di HP/browser) | Real-time tracking |

---

## Aturan Absensi

### 1. Keterlambatan Masuk

- **Batas masuk:** 09:15 WIB
- Jika jam masuk (dari fingerprint) > 09:15 → status otomatis: **TERLAMBAT**
- Label terlambat **tidak bisa diubah** oleh siapapun kecuali Owner
- Saat data fingerprint diimport, sistem otomatis memberi label per pegawai
- Laporan keterlambatan langsung muncul di:
  - Dashboard Owner (notifikasi real-time setelah import)
  - Dashboard Admin Sales (tampilan saja, tidak bisa diubah)

### 2. Istirahat

- **Durasi maksimal istirahat:** 60 menit (1 jam)
- Pegawai klik **"Mulai Istirahat"** di PrintFlow saat akan istirahat
- Pegawai klik **"Selesai Istirahat"** saat kembali kerja

#### Peringatan 15 Menit Sebelum Selesai
- Sistem otomatis menghitung: `waktu_mulai_istirahat + 45 menit`
- Pada menit ke-45: sistem kirim peringatan ke pegawai:
  - Badge/popup di halaman browser yang sedang dibuka pegawai
  - WhatsApp ke nomor HP pegawai (jika terdaftar di sistem)
- Pesan peringatan: *"Istirahat Anda berakhir dalam 15 menit. Silakan kembali ke tempat kerja."*

#### Istirahat Melebihi 1 Jam
- Jika pegawai belum klik "Selesai Istirahat" setelah 60 menit:
  - Status otomatis: **ISTIRAHAT BERLEBIH**
  - Alert merah muncul di dashboard Owner dan Admin
  - WhatsApp otomatis ke Owner: *"[Nama Pegawai] sudah istirahat lebih dari 60 menit sejak [jam]"*
- Sistem tetap mencatat waktu sebenarnya saat pegawai klik Selesai Istirahat

---

## Aturan Immutability (Tidak Bisa Diubah)

| Data | Bisa Diubah? | Pengecualian |
|------|-------------|-------------|
| Jam masuk (dari fingerprint) | ❌ Tidak | Owner bisa tambahkan catatan koreksi (bukan ubah data) |
| Label TERLAMBAT | ❌ Tidak | Owner bisa tambahkan keterangan (misal: ada alasan sah) |
| Waktu mulai istirahat | ❌ Tidak | Tercatat otomatis saat klik tombol |
| Waktu selesai istirahat | ❌ Tidak | Tercatat otomatis saat klik tombol |
| Label ISTIRAHAT BERLEBIH | ❌ Tidak | Owner bisa tambahkan keterangan |

Owner **tidak bisa menghapus atau mengedit** data absensi — hanya bisa menambahkan **catatan/keterangan** sebagai lampiran. Ini menjaga integritas data.

---

## Tombol di PrintFlow (Per Pegawai)

Di halaman dashboard masing-masing pegawai (Operator, Finishing, QC, dll):

```
┌─────────────────────────────────────────┐
│  STATUS HARI INI                        │
│  Masuk: 09:10 ✅ (dari fingerprint)     │
│                                         │
│  [ 🍽️  MULAI ISTIRAHAT  ]              │
│  (tombol muncul jika belum istirahat)   │
└─────────────────────────────────────────┘
```

Saat istirahat berjalan:
```
┌─────────────────────────────────────────┐
│  ISTIRAHAT BERJALAN                     │
│  Mulai: 12:00 | Berlangsung: 35 menit  │
│  Sisa: 25 menit                         │
│                                         │
│  [ ✅  SELESAI ISTIRAHAT  ]            │
└─────────────────────────────────────────┘
```

---

## Notifikasi WhatsApp ke Pegawai

Agar bisa kirim WhatsApp ke pegawai, **nomor HP pegawai harus disimpan di data user**.

Tambahkan field `phone` di tabel `users`:
```
users.phone  — nomor HP pegawai (opsional, untuk notifikasi internal)
```

Jenis notifikasi WA ke pegawai:
| Trigger | Pesan |
|---------|-------|
| 45 menit istirahat | *"Istirahat Anda berakhir dalam 15 menit. Silakan kembali ke tempat kerja."* |
| 60 menit istirahat terlewat | *"Istirahat Anda sudah melebihi batas 1 jam. Segera kembali."* |

---

## Notifikasi ke Owner & Admin

| Event | Channel | Isi |
|-------|---------|-----|
| Pegawai terlambat (saat import CSV) | Dashboard Owner + WA Owner | "[Nama] terlambat masuk. Jam masuk: [jam]" |
| Istirahat > 60 menit | Dashboard Owner + Admin + WA Owner | "[Nama] sudah istirahat [X] menit." |
| Import absensi fingerprint selesai | Dashboard Owner | "Data absensi [tanggal] berhasil diimport. [X] pegawai hadir, [Y] terlambat." |

---

## Laporan Absensi

Tampil di **Owner Dashboard** dan **Laporan Bulanan Owner**:

| Kolom | Keterangan |
|-------|-----------|
| Nama Pegawai | |
| Tanggal | |
| Jam Masuk | Dari fingerprint |
| Status Masuk | TEPAT WAKTU / TERLAMBAT |
| Jam Mulai Istirahat | Dari PrintFlow |
| Jam Selesai Istirahat | Dari PrintFlow |
| Durasi Istirahat | Dihitung otomatis |
| Status Istirahat | NORMAL / BERLEBIH |
| Keterangan Owner | Catatan opsional dari Owner |

**Tidak tampil di dashboard Designer, Operator, Finishing, Warehouse.**
Admin Sales hanya bisa **lihat** laporan absensi, tidak bisa edit.

---

## Database

### Tabel `attendance_records`
```
id
user_id               (FK ke users)
date
check_in              (dari import fingerprint)
check_out             (dari import fingerprint)
check_in_status       (ON_TIME / LATE)
late_minutes          (selisih dari 09:15)
break_start           (dari tombol PrintFlow)
break_end             (dari tombol PrintFlow)
break_duration_min    (dihitung otomatis)
break_status          (NORMAL / EXCEEDED)
warning_sent_at       (timestamp kirim peringatan 15 menit)
owner_note            (catatan Owner, tidak mengubah data)
import_id             (FK ke attendance_imports)
created_at
```

### Tabel `attendance_imports`
```
id
imported_by           (user_id Owner/Admin)
import_date
file_path
period_start
period_end
row_count
late_count
created_at
```

---

## Fase Implementasi

Fitur absensi ini masuk **Fase 2** setelah core workflow selesai.

Urutan implementasi Fase 2:
1. Tambah field `phone` di tabel `users`
2. Buat halaman import CSV fingerprint
3. Buat tombol Mulai/Selesai Istirahat di dashboard pegawai
4. Buat cron job untuk peringatan 15 menit & 60 menit
5. Buat laporan absensi di Owner dashboard
6. Integrasi WA notification ke pegawai


==================================================
FILE: 11-FUTURE/MACHINE-INTEGRATION.md
==================================================

# MACHINE INTEGRATION

Future reconciliation between machine/RIP production events and official Job IDs. Must be investigated per machine/vendor.


==================================================
FILE: 11-FUTURE/PAYMENT-GATEWAY.md
==================================================

# PAYMENT GATEWAY

QRIS/payment gateway and reconciliation.


==================================================
FILE: 11-FUTURE/QR-CODE.md
==================================================

# QR / Barcode Integration

QR is recommended as the primary scan format because it can carry a Job ID and work well with phone cameras.

## Job QR
Generated for each Production Job / finished order.

Used at:
- production
- finishing
- storage
- pickup
- audit

## Storage QR
Each rack/slot/location gets a unique QR.

## Important
QR is an identifier, not an authorization mechanism. User permissions are always checked server-side.


==================================================
FILE: 11-FUTURE/WHATSAPP.md
==================================================

# WhatsApp Integration (Future Enhancement)

Status: **DIPINDAH ke 04-MODULES/WHATSAPP-NOTIFICATION.md**

WhatsApp Notification sudah diangkat menjadi fitur inti (bukan future).
Lihat spesifikasi lengkap di: `04-MODULES/WHATSAPP-NOTIFICATION.md`

## Yang Masih Menjadi Future

- **WhatsApp Business API resmi (Meta/BSP)**: Jika saat ini menggunakan provider informal (Fonnte/Wablas), migrasi ke WABA resmi bisa dilakukan di masa depan tanpa mengubah core system karena sudah menggunakan abstraction layer.
- **WhatsApp chatbot / 2-way communication**: Konsumen bisa reply WA untuk tracking order mandiri (Phase 2+).
- **Broadcast promo**: Kirim promo ke konsumen lama via WhatsApp (butuh template approved oleh Meta).
