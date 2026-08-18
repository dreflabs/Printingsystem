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
