# LAPORAN KEUANGAN (Financial Report)

## Akses
- Owner: akses penuh + export
- Supervisor: lihat saja (tanpa nominal detail, hanya ringkasan)
- Admin Sales, Designer, Operator, dll: tidak ada akses

---

## 1. Laporan Pendapatan Harian

**Tampil di:** Dashboard Owner (widget) + halaman laporan lengkap

| Kolom | Keterangan |
|-------|-----------|
| Tanggal | |
| Total Order Baru | Jumlah order dibuat hari itu |
| Total DP Masuk | Jumlah rupiah DP yang dikonfirmasi |
| Total Pelunasan Masuk | Jumlah rupiah pelunasan yang dikonfirmasi |
| Total Pendapatan Hari Ini | DP + Pelunasan |
| Diskon yang Diberikan | Total nominal diskon yang di-approve |
| DP Hangus (Cancel) | DP dari order yang dibatalkan saat produksi sudah jalan |
| Piutang Baru | Order confirmed tapi belum lunas |

---

## 2. Laporan Piutang (Outstanding)

Daftar order yang sudah selesai atau sedang berjalan tapi belum lunas.

| Kolom | Keterangan |
|-------|-----------|
| Kode Order | |
| Nama Konsumen | |
| Total Order | |
| DP Dibayar | |
| Sisa yang Harus Dibayar | |
| Deadline Order | |
| Status Order | |
| Hari Sejak Siap Diambil | Untuk pressure collection |

Filter: Semua / Overdue / Belum Siap / Siap Diambil Belum Lunas

---

## 3. Laporan Bulanan Owner

**Periode:** Per bulan kalender (bisa pilih rentang custom)

| Metrik | Keterangan |
|--------|-----------|
| Total Omset (bruto) | |
| Total Diskon | |
| Total Omset (neto) | Bruto - Diskon |
| Total Pendapatan Masuk | Uang yang benar-benar diterima (DP + pelunasan) |
| Total Piutang Akhir Bulan | |
| Total DP Hangus | |
| Jumlah Order | |
| Order Selesai | |
| Order Dibatalkan | |
| Rata-rata Nilai Order | |
| Produk Terlaris | Top 5 produk |
| Mesin Tersibuk | Berdasarkan jam produksi |

---

## 4. Laporan Diskon

Semua diskon yang pernah diberikan — untuk audit Owner.

| Kolom | Keterangan |
|-------|-----------|
| Kode Order | |
| Nama Konsumen | |
| Total Sebelum Diskon | |
| Nominal Diskon | |
| Persentase Diskon | |
| Disetujui Oleh | Nama Owner |
| Tanggal Approval | |
| Alasan Diskon | |

---

## 5. Export

Semua laporan keuangan bisa diexport ke:
- **PDF** (untuk arsip dan print)
- **XLSX / Excel** (untuk analisis lanjutan)
- **CSV** (untuk import ke tools lain)

Export dicatat di audit log: siapa yang export, kapan, laporan apa.

---

## Catatan Penting

- PrintFlow adalah **satu-satunya sumber kebenaran keuangan** — tidak ada rekap ke sistem lain
- Semua angka berdasarkan transaksi yang dikonfirmasi oleh Admin Sales
- Koreksi angka keuangan setelah CLOSED hanya lewat `02-WORKFLOW/15-CORRECTION-ADJUSTMENT.md`
- Tidak ada fitur delete transaksi — hanya correction record baru
