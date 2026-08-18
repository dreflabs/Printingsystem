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
