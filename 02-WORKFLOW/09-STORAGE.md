# Storage Layout & Workflow

## Gambaran Umum Dua Lantai

Percetakan ini memiliki dua area penyimpanan dengan fungsi yang berbeda:

| Area | Lokasi | Fungsi | Ukuran |
|------|--------|--------|--------|
| **Gudang Finishing** | Lantai 3 | Penyimpanan barang jadi setelah QC & finishing | Luas |
| **Counter Penyerahan** | Lantai 1 | Area pengambilan oleh konsumen | Kecil |

---

## Lantai 3 — Gudang Finishing (Main Storage)

### Fungsi
Semua barang jadi disimpan di sini setelah proses finishing selesai.
Ini adalah lokasi resmi yang terdaftar di sistem.

### Sistem Penomoran Lokasi

```
Format: LT3-[ZONA]-[RAK]-[SLOT]

Contoh:
LT3-A-01-01  = Lantai 3, Zona A, Rak 01, Slot 01
LT3-A-01-02  = Lantai 3, Zona A, Rak 01, Slot 02
LT3-B-02-01  = Lantai 3, Zona B, Rak 02, Slot 01
```

### Pembagian Zona (Rekomendasi)
- **Zona A**: Banner, spanduk, backdrop (ukuran besar)
- **Zona B**: Sticker, label, kartu nama (ukuran kecil, terlipat/tergulung)
- **Zona C**: Box, produk packaging, cetak packaging
- **Zona D**: Holding area — barang yang belum siap sepenuhnya atau sedang dalam proses

### Kapasitas
- Setiap slot memiliki kapasitas maksimal (field `capacity_max` di database)
- Sistem memberi peringatan jika slot sudah penuh
- Staff tidak bisa assign ke slot yang sudah penuh tanpa override

### Alur Masuk Storage Lantai 3
```
Finishing Complete
  → Staff finishing SCAN Job QR (via kamera HP/tablet browser)
  → Pilih "Simpan ke Gudang"
  → Warehouse Staff SCAN QR Lokasi (LT3-A-01-01)
  → Sistem validasi: job status sudah FINISHING_COMPLETE?
  → Sistem validasi: lokasi masih tersedia?
  → SIMPAN → Status: READY_FOR_PICKUP
  → Notifikasi WhatsApp otomatis dikirim ke konsumen
```

---

## Lantai 1 — Counter Penyerahan (Pickup Counter)

### Fungsi
Bukan gudang permanen. Ini adalah **area transit sementara** saat konsumen sudah datang dan barang sedang diambilkan dari gudang lantai 3.

### Kapasitas
- Kecil: hanya untuk menampung 5–15 order yang sedang aktif diproses penyerahan
- Bukan tempat penyimpanan jangka panjang

### Alur Pengambilan (Pickup Flow)

```
Konsumen datang ke counter
  ↓
Admin Sales cari order (by nama / order_code) atau SCAN Job QR konsumen
  ↓
Sistem tampilkan: nama konsumen, produk, jumlah, status payment, lokasi di gudang
  ↓
Admin Sales minta staff ambil barang dari LT3-[lokasi]
  ↓
Staff ambil barang dari Lantai 3
  ↓
Staff SCAN Job QR di Counter Lantai 1 (konfirmasi "Barang sudah di counter")
  ↓
Admin Sales verifikasi: identitas konsumen + payment lunas?
  ↓ (jika payment ada sisa tagihan → proses payment dulu)
Admin Sales klik "Serahkan" → SCAN Job QR (konfirmasi final)
  ↓
Konsumen tanda tangan / konfirmasi (opsional, bisa foto bukti)
  ↓
Status: PICKED_UP
  ↓
Barang fisik keluar dari sistem storage
```

### Lokasi Counter di Database
- Counter Lantai 1 memiliki kode lokasi: `LT1-COUNTER-01`, `LT1-COUNTER-02`, dst
- Scan di counter mencatat perpindahan dari LT3 ke LT1 (transit)
- Saat diserahkan ke konsumen, status berubah ke PICKED_UP dan storage_item dilepas

---

## Penanganan Barang Tidak Ditemukan

Jika barang yang dicari di lokasi yang tercatat tidak ada secara fisik:

1. Staff melaporkan "Barang tidak ditemukan" di sistem
2. Sistem menampilkan last scan location dan last scan timestamp
3. Dibuat incident report otomatis
4. Notifikasi ke Owner dan Supervisor
5. Order status berubah ke INCIDENT — tidak bisa diserahkan sampai diselesaikan
6. Admin Sales tidak memberitahu konsumen sebelum ada kejelasan dari Owner

---

## Database — Tabel yang Relevan

### `storage_locations`
```
id
location_code      (e.g., LT3-A-01-01)
name               (label ramah: "Lantai 3 Zona A Rak 1 Slot 1")
floor              (1 atau 3)
zone               (A / B / C / D / COUNTER)
rack               (nomor rak)
slot               (nomor slot)
capacity_max       (max job yang bisa disimpan, default 1 per slot)
capacity_current   (diupdate otomatis saat ada barang masuk/keluar)
qr_code_value      (nilai unik untuk QR lokasi ini)
active             (boolean)
```

### `storage_items`
```
id
job_id
location_id        (FK ke storage_locations)
quantity
stored_by          (user_id)
stored_at
transit_at         (waktu barang dipindah ke counter LT1)
transit_by
released_by
released_at
status             (STORED / IN_TRANSIT / RELEASED / INCIDENT)
```

---

## QR Lokasi Storage

Setiap lokasi fisik (rak/slot) memiliki stiker QR yang ditempel permanen.
Format QR content: `LOC:{location_code}` (e.g., `LOC:LT3-A-01-01`)

Saat di-scan:
- Jika dalam konteks "simpan barang": sistem tahu ini adalah SCAN LOKASI TUJUAN
- Jika dalam konteks "ambil barang": sistem tahu ini adalah konfirmasi LOKASI SUMBER
- Konteks ditentukan oleh halaman/state aktif di browser user saat scan
