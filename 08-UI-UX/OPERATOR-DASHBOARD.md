# OPERATOR DASHBOARD

Dashboard mobile untuk **Operator Mesin**: job yang di-assign, scan QR mulai/selesai produksi, dan input pemakaian material/waste. Layout mengikuti breakpoint Mobile (360–430px) di `DESIGN-SYSTEM.md`, tombol besar minimum tinggi 56px.

---

## Widget Ringkasan (baris atas)

| Card | Isi |
|------|-----|
| Job Aktif Saya | Job berstatus PRODUCTION_STARTED yang sedang dikerjakan (dengan timer berjalan) |
| Antrian Job Berikutnya | Job PRODUCTION_ASSIGNED menunggu dikerjakan |
| Selesai Hari Ini | Jumlah job PRODUCTION_COMPLETE hari ini |
| Total Waste Hari Ini | Akumulasi waste dari job yang diselesaikan |

---

## Aksi Utama (tombol besar, sesuai mockup 06-OPERATOR-DASHBOARD)

- **SCAN QR MULAI JOB** — scan Job QR → tampilkan produk, spesifikasi, qty, deadline → konfirmasi "MULAI PRODUKSI" (SCAN 1, lihat `13-QR-SCAN-FLOW.md`)
- **SELESAI PRODUKSI** — untuk job aktif: scan Job QR → form actual qty, waste qty (+ alasan wajib jika > 0), notes → submit (SCAN 2)

---

## Panel Job Aktif

Saat ada job PRODUCTION_STARTED:
- Nama produk + spesifikasi ringkas
- Mesin yang digunakan
- Quantity target
- Deadline
- Timer berjalan (durasi sejak `actual_start`)
- Tombol "Selesai Produksi"

---

## Tabel / List — Antrian Job Berikutnya

Kolom (list card, bukan tabel padat — sesuai gaya mobile):

| Kolom | Keterangan |
|-------|-----------|
| Kode Job | |
| Nama Produk | Spesifikasi ringkas |
| Mesin | |
| Jumlah Target | |
| Deadline | Highlight oranye/merah sesuai urgensi |
| Status | PRODUCTION_ASSIGNED (status pill biru) |

## Filter

- Hanya menampilkan job yang di-assign ke Operator yang login (tidak bisa lihat job operator lain)
- Toggle: Semua / Hanya Deadline Hari Ini / Overdue

---

## Form Input Selesai Produksi

- Actual quantity (wajib, tidak boleh 0)
- Waste quantity (wajib isi alasan jika > 0)
- Notes (opsional)

---

## Aksi yang Bisa Dilakukan dari Dashboard

- Lihat job yang di-assign ke dirinya sendiri
- Scan QR Job untuk mulai & selesai produksi
- Input actual qty & waste saat selesai
- Input pemakaian material per job
- Lihat spesifikasi produk dan nama konsumen pada job

## Yang Tidak Boleh Tampil

- Nomor HP / email konsumen
- Job milik operator lain
- Laporan apapun (produksi, keuangan, dll)
- Input stok material masuk (hanya pemakaian per job, bukan stok masuk)
