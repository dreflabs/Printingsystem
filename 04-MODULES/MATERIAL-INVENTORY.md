# MATERIAL INVENTORY MODULE

## Tujuan

Mengelola semua bahan baku dan tinta percetakan:
- Pencatatan stok masuk dan keluar
- Stok dikelompokkan per mesin
- Alert stok minimum otomatis
- Gudang (atau Owner) dapat menambahkan bahan baru secara mandiri
- Laporan penggunaan material per job/mesin

---

## Struktur Material

Setiap material memiliki:
- **Kategori Mesin**: bahan hanya muncul di pilihan mesin yang relevan
- **Tipe**: MEDIA (bahan cetak) atau INK (tinta)
- **Satuan**: Roll, Meter, Lembar, Liter, Kg, Rim, Botol, Pcs, atau Custom
- **Stok Minimum**: batas bawah sebelum alert dikirim

---

## Mesin dan Bahan yang Tersedia

| Mesin | Kode | Contoh Bahan |
|-------|------|-------------|
| Outdoor | M-OUT-01 | Flexy China, Flexy Korea, Tinta Solvent |
| Indoor | M-IND-01 | Sticker Vinyl, Photo Paper, Tinta Eco-Solvent |
| Sublimasi | M-SUB-01 | Kertas Transfer, Kain Polyester, Tinta Sublim |
| A3 | M-A3-01 | Art Paper, Photo Paper A3, Tinta Pigment |
| UV | M-UV-01 | Acrylic, PVC Board, Tinta UV, Tinta White |
| DTF | M-DTF-01 | DTF Film, Powder Hot Melt, Tinta DTF White |
| Bendera | M-FLG-01 | Kain Satin, Kain Polyester, Tinta Sublim |

---

## Fitur Tambah Bahan Baru oleh Gudang

Gudang atau Owner dapat menambahkan bahan baru kapan saja langsung dari sistem:

```
Halaman: Inventori → Kelola Bahan → Tambah Bahan Baru

Form input:
- Nama Bahan (teks bebas)
- Kategori Mesin (dropdown — pilih mesin terkait)
- Tipe (MEDIA / INK)
- Satuan (dropdown + opsi "Lainnya" untuk input manual)
- Stok Awal
- Stok Minimum (batas alert)
- Keterangan (opsional)
```

Bahan yang ditambahkan langsung:
- Aktif dan muncul di dropdown saat operator input pemakaian
- Bisa di-edit atau dinonaktifkan oleh Gudang/Owner
- Tidak bisa dihapus permanen (hanya nonaktifkan) untuk menjaga histori

---

## Alur Stok Masuk (Pembelian Bahan)

```
Gudang
  → Halaman Inventori → Stok Masuk
  → Pilih Bahan (dari daftar sesuai mesin)
  → Input:
      - Jumlah yang masuk
      - Satuan (sudah terisi otomatis)
      - Harga beli per satuan (opsional, untuk laporan biaya)
      - Supplier (opsional)
      - Tanggal masuk
      - Catatan
  → Sistem update stok otomatis
  → Tercatat di material_movements (movement_type: IN)
```

**Siapa yang bisa input stok masuk:**
- Owner ✅
- Gudang ✅ (tugas fisik menerima & mencatat bahan masuk)
- Admin, Operator, Designer Sales ❌

---

## Alur Stok Keluar (Pemakaian Produksi)

```
Operator saat selesai produksi
  → Form Selesai Produksi (setelah Scan QR)
  → Wajib input pemakaian bahan:
      - Pilih bahan yang dipakai (sudah difilter sesuai mesin)
      - Jumlah terpakai
      - Jumlah waste/sisa terbuang (dengan alasan jika > 0)
  → Sistem kurangi stok secara otomatis
  → Tercatat di material_movements (movement_type: OUT, terhubung ke Job ID)
```

**Aturan penting:**
- Material OUT **selalu harus ada Job ID** — tidak bisa keluar tanpa terhubung ke produksi resmi
- **TIDAK BLOCKING:** Operator disarankan menginput pemakaian bahan saat selesai produksi, namun jika dilewati, sistem **tidak memblokir** status `PRODUCTION_COMPLETE` (Sesuai `13-QR-SCAN-FLOW.md`). Admin dapat melakukan adjustment stok di kemudian hari jika diperlukan.

---

## Alert Stok Minimum

Saat stok suatu bahan mencapai atau di bawah `min_stock`:
- Badge merah muncul di dashboard Owner dan Admin
- Notifikasi WhatsApp ke Owner: *"Stok [nama bahan] untuk [nama mesin] tinggal [X] [satuan]. Segera lakukan pembelian."*
- Admin juga mendapat badge di dashboard (lihat saja, tidak ada aksi otomatis)

**Alert tidak memblokir produksi** — produksi tetap bisa jalan, tapi Owner sudah diperingatkan.

---

## Stok Adjustment (Koreksi Manual)

Jika ada selisih antara stok sistem dengan fisik aktual (saat stock opname):

```
Owner/Admin
  → Inventori → Adjustment Stok
  → Pilih bahan
  → Input: jumlah aktual fisik
  → Sistem hitung selisih otomatis
  → Wajib isi alasan adjustment
  → Tercatat di material_movements (movement_type: ADJUSTMENT)
  → Dicatat di audit_log
```

**Siapa yang bisa adjustment:** Admin dan Owner.

---

## Tampilan Stok per Mesin (Di Dashboard)

Halaman inventori menampilkan stok dikelompokkan per mesin:

```
📦 STOK MESIN OUTDOOR (M-OUT-01)
┌──────────────────────────────────────────────┐
│ Bahan         │ Stok   │ Satuan │ Status      │
├──────────────────────────────────────────────┤
│ Flexy China   │  5     │ Roll   │ 🟢 AMAN    │
│ Flexy Korea   │  9     │ Roll   │ 🟢 AMAN    │
│ Flexy Premium │  1     │ Roll   │ 🔴 MENIPIS │
│ Tinta Solvent │  8     │ Liter  │ 🟢 AMAN    │
│ ...           │        │        │             │
│ [+ Tambah Bahan Baru]                         │
└──────────────────────────────────────────────┘
```

Warna status:
- 🟢 AMAN: stok > min_stock × 2
- 🟡 PERHATIAN: stok > min_stock tapi < min_stock × 2
- 🔴 MENIPIS: stok ≤ min_stock

---

## Laporan Material

- **Laporan Harian**: bahan yang keluar hari ini per mesin
- **Laporan Bulanan**: ringkasan pemakaian, pembelian, adjustment, selisih
- **Laporan per Job**: berapa bahan yang dipakai untuk satu order tertentu
- **Laporan Waste**: material terbuang per mesin, per operator — untuk audit efisiensi
