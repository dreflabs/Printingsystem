# QR Scan Flow — Alur Lengkap

## Prinsip Dasar

1. QR adalah **identitas, bukan otorisasi** — scan tidak pernah langsung eksekusi aksi
2. Setiap scan: sistem cek login + role + status sebelum memperbolehkan aksi
3. Semua scan dilakukan via **browser di HP/tablet** — tidak butuh app tambahan
4. Dua jenis QR: **Job QR** (per order/job) dan **Location QR** (per slot di rak)

---

## Dua Jenis QR Code

### Job QR
- Dibuat otomatis saat Production Job dibuat
- Berisi: URL ke halaman job + Job Code (`https://app.percetakan.com/scan/job/JOB-20260814-0001`)
- Dicetak pada label yang ditempel di barang fisik
- Digunakan sepanjang siklus hidup order: dari produksi sampai pickup

### Location QR (Storage)
- Dibuat saat lokasi storage didaftarkan
- Berisi: kode lokasi (`LOC:LT3-A-01-01`)
- Dicetak dan ditempel permanen di setiap rak/slot
- Tidak berubah selama lokasi itu aktif

---

## Peta Titik Scan

```
PRODUKSI
  ├── [SCAN 1] Operator scan Job QR → Mulai Produksi
  └── [SCAN 2] Operator scan Job QR → Selesai Produksi

QC
  └── [SCAN 3] QC Inspector scan Job QR → Buka Form QC

FINISHING
  ├── [SCAN 4] Finishing Staff scan Job QR → Mulai Finishing
  └── [SCAN 5] Finishing Staff scan Job QR → Selesai Finishing + Cetak Label

STORAGE (Lantai 3)
  ├── [SCAN 6] Warehouse scan Job QR → "Mau simpan barang ini"
  └── [SCAN 7] Warehouse scan Location QR → Konfirmasi Lokasi Penyimpanan

PICKUP (Lantai 1 Counter)
  ├── [SCAN 8] Admin Sales scan Job QR → Cari & verifikasi order konsumen
  ├── [SCAN 9] Warehouse Staff scan Job QR → Konfirmasi "Barang sudah di counter"
  └── [SCAN 10] Admin Sales scan Job QR → Release final ke konsumen

AUDIT
  └── [SCAN opsional] Admin Sales scan Job QR → Lihat histori lengkap untuk Audit
```

---

## Detail Setiap Titik Scan

---

### 🔵 SCAN 1 — Mulai Produksi
**Siapa:** Operator Mesin  
**Di mana:** Stasiun mesin / area produksi (HP/tablet operator)  
**Kapan:** Saat mulai mengerjakan job  
**QR yang di-scan:** Job QR  

**Alur:**
1. Operator buka browser → Login → Masuk halaman "Produksi Aktif Saya"
2. Klik "Scan Mulai Job"
3. Scan Job QR dari Work Order / print-out
4. Sistem tampilkan: nama produk, spesifikasi, quantity, deadline
5. Operator klik "MULAI PRODUKSI"
6. Status → `PRODUCTION_STARTED`, `actual_start` tercatat

**Validasi server:**
- Apakah user ini adalah operator yang di-assign ke job ini?
- Apakah status job adalah `PRODUCTION_ASSIGNED`?
- Jika tidak → tampilkan error, jangan ubah status

---

### 🔵 SCAN 2 — Selesai Produksi
**Siapa:** Operator Mesin  
**Di mana:** Stasiun mesin  
**Kapan:** Setelah produksi fisik selesai  
**QR yang di-scan:** Job QR  

**Alur:**
1. Operator buka halaman "Job Aktif" → Klik "Scan Selesai"
2. Scan Job QR
3. Sistem tampilkan form:
   - Actual quantity: ___
   - Waste quantity: ___ (wajib jika > 0, disertai alasan)
   - Notes: ___
4. Operator submit → Status → `PRODUCTION_COMPLETE`

**Validasi:**
- actual_qty tidak boleh 0
- waste_qty memerlukan `waste_reason` jika > 0
- Hanya operator yang di-assign ke job ini

---

### 🟡 SCAN 3 — QC Inspection
**Siapa:** QC Inspector  
**Di mana:** Area QC / meja inspeksi  
**Kapan:** Setelah SCAN 2 selesai  
**QR yang di-scan:** Job QR  

**Alur:**
1. QC Inspector buka halaman "Antrian QC"
2. Klik "Scan Job"
3. Scan Job QR dari barang fisik
4. Sistem tampilkan checklist QC + spesifikasi order (qty, ukuran, finishing)
5. Inspector isi checklist: quantity ✓, ukuran ✓, warna ✓, kualitas cetak ✓, defect ✓
6. Inspector pilih: **PASS** atau **FAIL**
7. Jika FAIL: wajib isi kategori masalah + deskripsi + upload foto
8. Submit → Status diupdate sesuai hasil

**Validasi:**
- Job harus berstatus `PRODUCTION_COMPLETE`
- User harus memiliki role `qc`

---

### 🟠 SCAN 4 — Mulai Finishing
**Siapa:** Finishing Staff  
**Di mana:** Area finishing  
**Kapan:** Setelah QC PASS  
**QR yang di-scan:** Job QR  

**Alur:**
1. Finishing Staff buka halaman "Antrian Finishing"
2. Scan Job QR
3. Sistem tampilkan: spesifikasi finishing (laminating, cutting, welding, dll)
4. Klik "MULAI FINISHING"
5. Status → `FINISHING_STARTED`

**Validasi:**
- Job harus berstatus `QC_PASSED`

---

### 🟠 SCAN 5 — Selesai Finishing + Cetak Label
**Siapa:** Finishing Staff  
**Di mana:** Area finishing  
**Kapan:** Setelah proses finishing fisik selesai  
**QR yang di-scan:** Job QR  

**Alur:**
1. Scan Job QR
2. Isi form selesai: actual_qty, notes
3. Klik "SELESAI FINISHING"
4. Sistem tampilkan **preview label** untuk dicetak:
   - Nama perusahaan
   - Job QR Code (besar)
   - Job Code + Order Code
   - Nama konsumen (tanpa nomor HP)
   - Deskripsi produk singkat
   - Jumlah
5. Operator klik "CETAK LABEL" → printer terhubung cetak label
6. Label ditempel ke barang fisik
7. Status → `FINISHING_COMPLETE`

**Catatan:** Label tidak boleh mencantumkan nomor HP konsumen.

---

### 🟢 SCAN 6 — Scan Job QR untuk Simpan ke Storage
**Siapa:** Warehouse Staff / Lantai 3  
**Di mana:** Area finishing (mengambil barang) atau pintu masuk gudang lantai 3  
**Kapan:** Setelah label tertempel, barang siap disimpan  
**QR yang di-scan:** Job QR (label yang baru ditempel)  

**Alur:**
1. Warehouse Staff buka halaman "Simpan ke Gudang"
2. Scan Job QR dari label barang
3. Sistem tampilkan: informasi job, konfirmasi "Mau simpan ke gudang?"
4. Klik "Pilih Lokasi Penyimpanan"
5. → Lanjut ke SCAN 7

**Validasi:**
- Job harus berstatus `FINISHING_COMPLETE`
- User harus role `warehouse`

---

### 🟢 SCAN 7 — Scan Location QR (Masuk Storage)
**Siapa:** Warehouse Staff  
**Di mana:** Depan rak penyimpanan di Lantai 3  
**Kapan:** Setelah SCAN 6, saat barang diletakkan di rak  
**QR yang di-scan:** Location QR (stiker di rak)  

**Alur:**
1. Dalam halaman yang sama setelah SCAN 6, klik "Scan Lokasi"
2. Scan QR yang tertempel di rak (misal: QR bertuliskan `LOC:LT3-A-01-01`)
3. Sistem tampilkan: info lokasi, kapasitas tersedia
4. Konfirmasi: "Simpan [Job Code] di [LT3-A-01-01]?"
5. Klik "SIMPAN" → Status → `READY_FOR_PICKUP`
6. Sistem otomatis trigger notifikasi WhatsApp ke konsumen

**Validasi:**
- Lokasi harus aktif dan kapasitas belum penuh
- Job belum tersimpan di lokasi lain (cegah duplikasi)
- Jika lokasi penuh: tampilkan error "Pilih lokasi lain"

---

### 🔴 SCAN 8 — Pickup: Verifikasi Order Konsumen
**Siapa:** Admin Sales  
**Di mana:** Counter Lantai 1  
**Kapan:** Saat konsumen datang untuk mengambil barang  
**QR yang di-scan:** Job QR (bisa dari HP konsumen jika ada, atau dicari manual)  

**Alur:**
1. Admin Sales buka halaman "Penyerahan / Pickup"
2. Dua pilihan: **Cari by nama/order code** ATAU **Scan Job QR**
3. Jika scan: konsumen menunjukkan QR di notifikasi WA mereka (atau Admin punya print-out)
4. Sistem tampilkan:
   - Nama konsumen (bukan nomor HP)
   - Order detail
   - **Status payment**: Lunas / Sisa Rp X.XXX
   - Lokasi barang: LT3-A-01-01
5. Admin Sales meminta staff ambil barang dari gudang lantai 3

**Catatan:** Di tahap ini nomor HP konsumen TIDAK ditampilkan di layar.

---

### 🔴 SCAN 9 — Konfirmasi Barang di Counter
**Siapa:** Warehouse Staff (yang mengambil barang dari lantai 3)  
**Di mana:** Counter Lantai 1  
**Kapan:** Setelah mengambil barang dari gudang, tiba di counter  
**QR yang di-scan:** Job QR (dari label barang)  

**Alur:**
1. Staff scan Job QR dari barang yang dibawa dari lantai 3
2. Sistem catat: barang sudah di counter (status storage_item → IN_TRANSIT ke LT1-COUNTER)
3. Admin Sales menerima konfirmasi di layarnya: "Barang sudah di counter"
4. Admin Sales verifikasi identitas konsumen (KTP / nama sesuai order)
5. Jika ada sisa tagihan: proses payment dulu

---

### 🔴 SCAN 10 — Release Final ke Konsumen
**Siapa:** Admin Sales  
**Di mana:** Counter Lantai 1  
**Kapan:** Setelah identitas dan payment verified  
**QR yang di-scan:** Job QR  

**Alur:**
1. Admin Sales scan Job QR (konfirmasi final)
2. Sistem tampilkan ringkasan: nama penerima, produk, qty, status payment
3. Input nama penerima (jika bukan konsumen langsung yang ambil)
4. Opsional: foto bukti penyerahan
5. Klik "SERAHKAN" → Status → `PICKED_UP`
6. `released_by`, `released_at`, `receiver_name` tercatat
7. Storage item di-release dari sistem

**Validasi server (wajib semua terpenuhi):**
- Status order adalah `READY_FOR_PICKUP`
- Payment lunas ATAU ada override Owner yang tercatat
- User adalah `admin_sales` (hanya Admin Sales yang berwenang melakukan release final)
- Belum pernah di-release sebelumnya (cegah double release)

---

## Ringkasan Tabel

| Scan | Siapa | Lokasi Fisik | QR yang Di-scan | Aksi |
|------|-------|-------------|-----------------|------|
| 1 | Operator | Area Mesin | Job QR | Mulai Produksi |
| 2 | Operator | Area Mesin | Job QR | Selesai Produksi + input qty/waste |
| 3 | QC Inspector | Area QC | Job QR | Isi checklist QC |
| 4 | Finishing Staff | Area Finishing | Job QR | Mulai Finishing |
| 5 | Finishing Staff | Area Finishing | Job QR | Selesai Finishing + Cetak Label |
| 6 | Warehouse Staff | Pintu Gudang LT3 | Job QR | Inisiasi Simpan ke Gudang |
| 7 | Warehouse Staff | Depan Rak LT3 | Location QR | Konfirmasi Lokasi Simpan |
| 8 | Admin Sales | Counter LT1 | Job QR / manual | Cari & verifikasi order |
| 9 | Warehouse Staff | Counter LT1 | Job QR | Konfirmasi barang sudah di counter |
| 10 | Admin Sales | Counter LT1 | Job QR | Release final ke konsumen |

---

## Perangkat yang Digunakan

| Stasiun | Perangkat Scan |
|---------|---------------|
| Area Produksi | HP Android/iOS operator (buka browser) |
| Area QC | HP atau tablet QC inspector |
| Area Finishing | HP atau tablet finishing staff |
| Gudang Lantai 3 | HP warehouse staff (dibawa keliling) |
| Counter Lantai 1 | Tablet yang dipasang tetap DI counter, atau HP Admin Sales |

Semua via browser, tidak butuh install app.
WiFi/LTE harus tersedia di semua area ini.
