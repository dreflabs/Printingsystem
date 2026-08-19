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
