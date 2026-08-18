# Warehouse Dashboard

Dashboard tablet untuk **Warehouse Staff**: penyimpanan barang jadi di gudang LT3, penyerahan barang ke counter LT1, dan pemantauan stok material. Layout mengikuti breakpoint Tablet (768–1024px) di `DESIGN-SYSTEM.md`.

---

## Widget Ringkasan (baris atas)

| Card | Isi |
|------|-----|
| Menunggu Disimpan | Job FINISHING_COMPLETE belum tersimpan di lokasi |
| Slot Terisi | Jumlah slot storage terpakai dari total kapasitas |
| Zona Hampir Penuh | Jumlah zona dengan status merah (penuh) |
| Barang Dipindah ke Counter Hari Ini | Jumlah job yang dikonfirmasi sampai di counter (SCAN 9) |

---

## Tombol Aksi Besar

- **SIMPAN JOB** — Scan Job QR → Scan Location QR → Confirm quantity → Store (SCAN 6–7, lihat `13-QR-SCAN-FLOW.md`)
- **CARI JOB** — Scan Job QR / cari manual → tampilkan lokasi saat ini & status
- **SCAN QR** — akses cepat kamera scan (Job QR atau Location QR)
- **PINDAH KE COUNTER** — konfirmasi barang dibawa dari gudang LT3 ke counter LT1 (SCAN 9)
- **RECEIVE / ISSUE MATERIAL** — input stok material masuk

---

## Tabel Utama — Daftar Barang Menunggu Disimpan

| Kolom | Keterangan |
|-------|-----------|
| Kode Job | |
| Kode Order | |
| Nama Produk | |
| Jumlah | |
| Status Finishing | FINISHING_COMPLETE (status pill) |
| Waktu Selesai Finishing | |
| Aksi | Simpan ke Gudang |

## Peta Gudang Visual

Peta per zona (grid rak): 🟢 kosong, 🔵 terisi, 🔴 penuh. Klik slot menampilkan popup info (Job Code, produk, tanggal simpan).

## Filter

- Zona / rak
- Status slot (Kosong / Terisi / Penuh)
- Kode job / order (search)

---

## Alur Kerja

### Store Job
Scan Job QR -> Scan Location QR -> Confirm quantity -> Store (status → READY_FOR_PICKUP, trigger notifikasi WA otomatis)

### Find Job
Scan Job QR -> tampilkan lokasi saat ini -> tampilkan status

### Konfirmasi ke Counter (Pickup)
Scan Job QR barang yang dibawa dari LT3 -> catat "sudah di counter" -> Admin Sales lanjut verifikasi identitas & payment -> Release final oleh Admin Sales (lihat `10-PICKUP-DELIVERY.md`, Warehouse Staff tidak melakukan release final)

---

## Aksi yang Bisa Dilakukan dari Dashboard

- Scan QR Job (simpan ke storage), Scan QR Lokasi (konfirmasi lokasi)
- Lihat peta gudang LT3
- Pindahkan barang ke counter LT1
- Cari job di gudang
- Laporkan insiden (barang tidak ditemukan)
- Input stok material masuk

## Yang Tidak Boleh Tampil

- Nomor HP konsumen
- Tombol proses pickup / release final (hanya Admin Sales)
- Akses laporan keuangan

Warehouse must never need to manually search through piles of paper to find finished goods.
