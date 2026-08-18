# Owner Dashboard

Dashboard visibilitas penuh untuk **Owner**: penjualan, produksi, gudang, keuangan, dan seluruh antrian approval kritis. Mengacu ke `DESIGN-SYSTEM.md` untuk warna, status pill, dan gaya card (glassmorphism, glow teal untuk item aktif).

---

## Widget Ringkasan (baris atas)

Card KPI angka besar (36px/700), sesuai `03-ROLES/OWNER.md`:

| Card | Isi |
|------|-----|
| Total Order Hari Ini | Jumlah order dibuat hari ini |
| Siap Diambil | Order READY_FOR_PICKUP |
| Produksi Aktif | Job berstatus PRODUCTION_STARTED / FINISHING_STARTED |
| Omset Bulan Ini | Total pendapatan (DP + pelunasan) bulan berjalan |

---

## Panel Alert Kritis (baris kedua, prioritas tinggi)

Ditampilkan dengan badge merah/oranye/kuning sesuai urgensi:

1. **QC FAIL Menunggu Keputusan** — job dengan rework tereskalasi (2x FAIL berturut) menunggu approve/reject Owner
2. **Permintaan Cancel Order** — cancel order yang produksi sudah berjalan, menunggu approve Owner
3. **Permintaan Diskon** — diskon diajukan Admin Sales, menunggu approve Owner
4. **Order OVERDUE** — daftar order lewat deadline (badge merah)
5. **Notifikasi WA Gagal Terkirim** — daftar pesan gagal, dengan status tindak lanjut Admin Sales
6. **Stok Material Menipis** — bahan dengan status 🔴 MENIPIS
7. **Anomali & Kecurangan** — waste tinggi (>20%), bahan keluar tanpa Job ID, adjustment tanpa alasan (dari `07-REPORTS/MATERIAL-REPORT.md` §4)

---

## Panel Operasional (baris tengah)

- **Pipeline Produksi** — kanban mini per stage (Produksi → QC → Finishing → Storage → Siap Diambil), jumlah job per stage
- **Ringkasan Absensi Hari Ini** — jumlah hadir, terlambat (ringkas, detail ada di Laporan Pegawai)
- **Antrian QC FAIL** — daftar job FAIL terbaru menunggu tindak lanjut

---

## Tabel Utama — Audit Log Terbaru

Widget "Audit log 10 aksi terbaru" langsung di dashboard, kolom:

| Kolom | Keterangan |
|-------|-----------|
| Waktu | |
| Pengguna | Nama + role |
| Aksi | |
| Entitas | Order / Job / Payment / User / dll |
| Detail | Ringkas, klik untuk detail lengkap |

Tombol "Lihat Semua Audit Log" mengarah ke halaman audit log penuh (real-time, tidak terbatas 10 baris).

## Filter (halaman Audit Log penuh)

- Rentang tanggal
- Pengguna / role
- Jenis aksi
- Entitas terkait (order/job/payment/user)

---

## Aksi yang Bisa Dilakukan dari Dashboard

- Approve/Reject rework setelah QC FAIL (termasuk eskalasi 2x FAIL berturut)
- Approve cancel order yang produksi sudah berjalan
- Approve/Apply diskon ke order
- Freeze order (ON_HOLD)
- Buat / nonaktifkan user, reset password
- Override batas DP (bebas persentase)
- Unlock akun terkunci permanen
- Export semua laporan (Keuangan, Produksi, Material, Pegawai, Harian, Bulanan) — lihat `07-REPORTS/`
- Hapus entri audit log via panel khusus (tetap tercatat log penghapusannya)
- Tambah catatan ke data absensi pegawai (tanpa mengubah data asli)

## Ringkasan Laporan Bulanan

Link cepat ke `07-REPORTS/MONTHLY-OWNER-REPORT.md` dan `07-REPORTS/FINANCIAL-REPORT.md` §3 "Laporan Bulanan Owner" untuk detail lengkap omset, piutang, produk terlaris, dan mesin tersibuk — dashboard hanya menampilkan ringkasan angka utama bulan berjalan.
