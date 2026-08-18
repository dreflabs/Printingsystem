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
