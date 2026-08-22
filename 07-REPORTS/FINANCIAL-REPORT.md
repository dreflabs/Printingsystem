# LAPORAN KEUANGAN (Financial Report)

## Akses
- Owner: akses penuh + export
- Admin: lihat saja (tanpa nominal detail, hanya ringkasan)
- Designer, Operator, Gudang: tidak ada akses

---

## 1. Laporan Pendapatan Harian

**Tampil di:** Dashboard Owner (widget) + halaman laporan lengkap

| Kolom | Keterangan |
|-------|-----------|
| Tanggal | |
| Total Order Baru | Jumlah order PRINTING dibuat hari itu |
| Total DP Masuk | Jumlah rupiah DP yang dikonfirmasi (PRINTING) |
| Total Pelunasan Masuk | Jumlah rupiah pelunasan yang dikonfirmasi (PRINTING) |
| Total Pendapatan Printing | DP + Pelunasan (PRINTING) |
| **Pendapatan Retail Hari Ini** | Total transaksi RETAIL yang CLOSED hari itu |
| **Total Pendapatan Gabungan** | Pendapatan PRINTING + Pendapatan RETAIL |
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
| Total Omset (bruto) | Total nilai order PRINTING + nilai transaksi RETAIL |
| Total Diskon | |
| Total Omset (neto) | Bruto - Diskon |
| Total Pendapatan Masuk | Uang yang benar-benar diterima (DP + pelunasan PRINTING + RETAIL) |
| **Pendapatan Retail Bulanan** | Total transaksi RETAIL yang CLOSED dalam periode |
| **Persentase Retail vs Printing** | Perbandingan kontribusi dua lini bisnis |
| Total Piutang Akhir Bulan | Khusus PRINTING (RETAIL tidak ada piutang — pembayaran langsung) |
| Total DP Hangus | |
| Jumlah Order | Jumlah order PRINTING |
| **Jumlah Transaksi Retail** | Jumlah transaksi RETAIL yang CLOSED |
| Order Selesai | |
| Order Dibatalkan | |
| Rata-rata Nilai Order | Rata-rata nilai order PRINTING |
| **Rata-rata Nilai Transaksi Retail** | Rata-rata nominal transaksi RETAIL |
| Produk Terlaris | Top 5 produk PRINTING |
| **Produk Retail Terlaris** | Top 5 barang retail yang paling banyak terjual |
| Mesin Tersibuk | Berdasarkan jam produksi |

---

## 4. Laporan Penjualan Retail

**Akses:** Owner (penuh + export), Admin (lihat saja, sesuai `06-SECURITY/ACCESS-CONTROL.md`)

Rekap khusus untuk transaksi `order_type = RETAIL`. Dapat difilter per hari/bulan.

| Kolom | Keterangan |
|-------|-----------|
| Tanggal Transaksi | |
| Kode Transaksi | Kode order RETAIL |
| Nama Pembeli | Nama konsumen atau "Guest" jika tidak terdaftar |
| Kasir | Admin yang memproses |
| Produk Terjual | Nama produk retail + qty |
| Subtotal | |
| Diskon | Jika ada |
| Total | |
| Metode Pembayaran | TUNAI / QRIS |

Filter: Tanggal (dari–sampai), Kasir, Produk, Metode Pembayaran.

---

## 5. Laporan Diskon

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

## 6. Export

Semua laporan keuangan bisa diexport ke:
- **PDF** (untuk arsip dan print)
- **XLSX / Excel** (untuk analisis lanjutan)
- **CSV** (untuk import ke tools lain)

Export dicatat di audit log: siapa yang export, kapan, laporan apa.

---

## Catatan Penting

- Print Pilot adalah **satu-satunya sumber kebenaran keuangan** — tidak ada rekap ke sistem lain
- Semua angka berdasarkan transaksi yang dikonfirmasi oleh Admin
- **Laporan keuangan mencakup kedua lini:** PRINTING (DP/pelunasan) dan RETAIL (transaksi langsung). Keduanya dihitung dalam total pendapatan gabungan.
- RETAIL tidak memiliki sistem piutang — pembayaran langsung saat transaksi. Laporan piutang hanya mencakup PRINTING.
- Koreksi angka keuangan setelah CLOSED hanya lewat `02-WORKFLOW/15-CORRECTION-ADJUSTMENT.md`
- Tidak ada fitur delete transaksi — hanya correction record baru
