# ADMIN DASHBOARD

Dashboard kerja harian untuk **Admin**: order, pembayaran, approval desain online, notifikasi konsumen, pickup di counter, **plus pengelolaan produksi harian** (tugas eks-Supervisor — role Supervisor sudah dihapus dan digabung ke Admin, lihat `03-ROLES/ADMIN.md`). Mengacu ke `DESIGN-SYSTEM.md` untuk warna, status pill, dan gaya card.

---

## Widget Ringkasan (baris atas)

Card KPI ala Owner Dashboard (angka besar 36px/700):

| Card | Isi |
|------|-----|
| Order Baru Hari Ini | Jumlah order status DRAFT dibuat hari ini |
| Menunggu Pembayaran | Order status WAITING_PAYMENT (badge kuning) |
| Siap Diambil | Order READY_FOR_PICKUP (badge hijau terang) |
| Overdue | Order OVERDUE (badge merah) |
| Notifikasi WA Gagal | Jumlah pesan gagal terkirim (badge merah) |
| Menunggu Approval Diskon | Diskon yang diajukan Admin, pending Owner (badge kuning) |
| Job Belum Di-assign | Job CONFIRMED menunggu assignment ke mesin/operator (badge kuning) |
| Job Sedang Berjalan | Job berstatus PRODUCTION_STARTED di semua mesin |
| Antrian QC | Job PRODUCTION_COMPLETE menunggu QC |
| QC FAIL Perlu Tindakan | Job FAIL menunggu penjelasan/rework |
| Mesin Maintenance | Jumlah mesin berstatus MAINTENANCE |

---

## Panel Prioritas (kanan/atas, sebelum tabel utama)

Panel-panel aksi cepat mengikuti pola mockup 05-ADMIN-DASHBOARD:

1. **Order Siap Diambil** — daftar ringkas order READY_FOR_PICKUP, tombol "Proses Pickup" per baris → membuka alur SCAN 8–10 (`13-QR-SCAN-FLOW.md`)
2. **Notifikasi WA Gagal** — daftar pesan gagal kirim, tombol "Kirim Ulang"
3. **Antrian Persetujuan Diskon** — order dengan diskon diajukan, status "Menunggu Owner" (read-only bagi Admin)
4. **Approval Desain Online Menunggu Konfirmasi** — order tipe Online dengan preview desain terkirim ke konsumen, tombol "Konfirmasi Persetujuan Online" (lihat `03-DESIGN-APPROVAL.md` Tipe 3)

---

## Tabel Utama — Daftar Order

Kolom tabel:

| Kolom | Keterangan |
|-------|-----------|
| Kode Order | `ORD-YYYYMMDD-XXXX` |
| Nama Konsumen | |
| Tipe Order | Walk-in / Makloon / Online / **RETAIL** |
| Status | Status pill sesuai `DESIGN-SYSTEM.md` |
| Status Pembayaran | Belum DP / DP Terpenuhi / Lunas |
| Total Order | |
| Sisa Tagihan | |
| Deadline | Highlight kuning jika besok, merah jika lewat |
| Dibuat Oleh | Admin / Designer |
| Aksi | Lihat Detail, Konfirmasi Pembayaran, Proses Pickup (kondisional sesuai status) |

## Filter Tabel

- Status order (dropdown multi-select, sesuai daftar status pill)
- Tipe order (Walk-in / Makloon / Online / **RETAIL**)
- Tanggal order (dari–sampai)
- Nama konsumen (search)
- Kode order (search exact)
- Deadline (dari–sampai)
- Overdue only (toggle)
- Status pembayaran (Belum DP / Partial / Lunas)

---

## Panel Produksi (eks-Supervisor)

### Panel Produksi per Mesin
Kanban/board per mesin: kolom mesin, isi kartu job (kode job, produk, operator, progress, estimasi selesai). Mesin MAINTENANCE ditandai dengan card abu-abu/nonaktif.

### Panel Reassignment
Daftar job yang butuh reassign (operator tidak hadir / mesin maintenance mendadak), tombol "Reassign" per baris.

### Tabel — Antrian Job Produksi
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

**Filter:** Mesin (dropdown) · Status job · Operator · Deadline (dari–sampai) · Overdue only (toggle)

### Panel QC & Rework
| Kolom | Keterangan |
|-------|-----------|
| Kode Job | |
| Hasil QC | PASS / FAIL |
| Kategori Masalah | (jika FAIL) |
| Rework Ke- | 0 / 1 / 2 |
| Aksi | Lihat Detail (tombol Approve Rework tidak tampil untuk Admin — semua tingkat rework wajib keputusan Owner) |

> Rework ke-1, ke-2, maupun eskalasi setelah 2x FAIL — semuanya wajib keputusan Owner, bukan Admin. Ini sengaja tidak ikut pindah saat penggabungan role Supervisor→Admin karena rework berdampak langsung ke biaya material & waktu produksi.

---

## Aksi yang Bisa Dilakukan dari Dashboard

- Buat order baru (Walk-in / Makloon / Online)
- **Buka modul POS Kasir** (buat transaksi RETAIL barang jadi — tombol di pojok kanan atas bertuliskan "Kasir POS")
- Edit order (hanya status DRAFT / DESIGNING / WAITING_APPROVAL, sesuai `02-ORDER.md`)
- Konfirmasi penerimaan pembayaran (jumlah, metode, referensi, timestamp — lihat `04-PAYMENT.md`)
- Ajukan diskon (pending approval Owner) — tidak bisa apply langsung
- Kirim ulang notifikasi WA yang gagal
- Konfirmasi approval desain Online (bukan Designer)
- Proses pickup konsumen: cari/scan order → verifikasi identitas & payment → serahkan barang (SCAN 8 & 10, Gudang yang mengonfirmasi barang sudah di counter pada SCAN 9)
- **Cek Stok Gudang Real-time** (melihat isi lokasi storage LT3)
- **Lakukan Final Audit Order** (submit hasil GREEN/YELLOW/RED sebelum order di-CLOSED)
- Cancel order (hanya sebelum produksi berjalan)
- Lihat nomor HP konsumen (khusus Admin, tidak tampil di role lain)
- Assign job ke mesin & operator, reassign job
- Set status mesin MAINTENANCE
- Lihat antrian produksi semua mesin dan hasil QC
- Lihat & export laporan produksi dan laporan material
- Lihat audit log (read-only, scoped)

## Yang Tidak Boleh Tampil

- Tombol apply diskon langsung (hanya ajukan)
- Tombol cancel order setelah produksi berjalan (hanya Owner)
- Edit laporan keuangan (hanya lihat)
- **Tombol approve Final Audit hasil YELLOW** (hanya Owner — Admin yang submit hasil audit tidak boleh juga jadi approver-nya sendiri)
- **Tombol approve rework — semua tingkat** (hanya Owner — rework berdampak langsung ke biaya material & waktu produksi)
- Hapus audit log
- Buat user baru (hanya Owner)

---

## Panel Shortcut POS (Kasir)

Sebagai shortcut tambahan (bukan sub-halaman baru), di pojok kanan atas terdapat tombol **"Kasir POS"** yang membuka halaman `POS-DASHBOARD.md`. Panel ini bersifat terpisah dari daftar order PRINTING dan menangani seluruh siklus transaksi RETAIL.

---

## Panel Final Audit

Untuk melakukan aksi **Final Audit Order**, sistem menyediakan checklist (berupa modal atau halaman terpisah khusus Admin) yang harus dilengkapi sebelum order bisa berstatus CLOSED:

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
- **YELLOW** = Approved variance (membutuhkan approval Owner — Admin yang submit tidak bisa approve hasil audit sendiri)
- **RED** = Unresolved / Ada anomali (Order ditahan dan diinvestigasi)
