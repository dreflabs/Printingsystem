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
| Tipe Order | Walk-in / Makloon / Online |
| Produk | Ringkasan item order |
| Versi Desain Terakhir | V1, V2, V3... |
| Status Desain | DRAFT / DESIGNING / WAITING_APPROVAL / APPROVED (status pill) |
| Deadline | Highlight sesuai `DESIGN-SYSTEM.md` |
| Aksi | Upload versi baru, Tandai Disetujui, Lihat Riwayat Versi |

## Filter Tabel

- Status desain (dropdown)
- Tipe order (Walk-in / Makloon / Online)
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
- Untuk **Online**: upload preview desain — approval final tetap dilakukan Admin, Designer hanya menunggu status berubah
- Catat permintaan revisi dan buat versi baru
- Lihat status order yang dibuat

## Yang Tidak Boleh Tampil

- Nomor HP / email konsumen (DILARANG total)
- Nominal harga/pembayaran detail (hanya status terpenuhi/belum)
- Edit harga order
- Akses laporan keuangan atau laporan produksi
- Approve desain via Online (hanya Admin yang berwenang, Designer hanya upload preview)
