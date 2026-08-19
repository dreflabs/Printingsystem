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
