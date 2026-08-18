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
