# LAPORAN PEGAWAI (Employee Report)

## Akses
- Owner: akses penuh + export
- Admin: akses ringkasan (tanpa data gaji/absensi detail)
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
| Total Job Dikerjakan | (untuk Operator/Gudang) |
| Total Qty Produksi | (untuk operator) |
| Total Waste | (untuk operator) |
| Jumlah QC Fail | (untuk Gudang — fail yang ditemukan) |
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
| Jam Mulai Istirahat | Dari Print Pilot |
| Jam Selesai Istirahat | Dari Print Pilot |
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
