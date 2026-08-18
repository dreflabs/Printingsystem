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
