# Material Workflow

## Alur Lengkap Material

```

## Material yang Diizinkan per Produk

Master material Gudang adalah sumber stok fisik. Kompatibilitas komersial diatur
terpisah pada Katalog Produk melalui allowlist `ProductMaterial`.

- Gudang membuat material, spesifikasi, satuan, konversi, stok minimum, dan status aktif.
- Admin/Owner memilih material yang boleh dipakai setiap produk dan menetapkan satu default.
- Form order hanya menampilkan material aktif pada allowlist produk.
- Saat produksi, material rencana harus cocok dengan produk dan material tersebut juga harus terdaftar pada mesin job.
- Material alternatif memerlukan permission, alasan, dan audit log; tidak boleh dipilih bebas dari seluruh master Gudang.

Contoh: produk Banner dapat memetakan Flexi China 280 gr, 350 gr, dan 400 gr.
Kertas atau material produk lain tidak tampil pada form Banner.
BELI BAHAN → TERIMA & INPUT STOK MASUK → TERSEDIA DI SISTEM
  → OPERATOR PAKAI SAAT PRODUKSI → INPUT PEMAKAIAN (KELUAR)
  → WASTE TERCATAT → STOK BERKURANG OTOMATIS
  → JIKA STOK ≤ MIN → ALERT KE OWNER & ADMIN
  → STOCK OPNAME → ADJUSTMENT JIKA ADA SELISIH
```

## Stok Masuk (Pembelian Bahan)

**Siapa:** Admin, Gudang, atau Owner (wajib login dengan akun sendiri)

**Input:**
- Pilih bahan dari daftar (dikelompokkan per mesin)
- Jumlah yang masuk (dalam satuan stok: Roll, Rim, Liter, dll)
- Harga beli per satuan (opsional)
- Supplier (opsional)
- Tanggal masuk
- Catatan

**Hasil:** `material_movements` baru dengan `movement_type = IN`, stok bertambah otomatis.

---

## Stok Keluar (Pemakaian Produksi)

**Siapa:** Operator (saat submit selesai produksi)

**Input:**
- Pilih bahan yang dipakai (sudah difilter sesuai mesin yang digunakan)
- Jumlah pemakaian (dalam satuan pemakaian: Meter, Lembar, mL, Gram)
- Jumlah waste (jika ada, wajib isi alasan)

**Aturan:**
- Wajib ada Job ID — tidak bisa input keluar tanpa job
- Sistem konversi satuan otomatis (meter → meter dari roll)
- Jika stok tidak mencukupi: sistem tampilkan peringatan, tapi tidak blokir (supaya produksi tidak terhenti — dicatat sebagai anomali)

**Hasil:** Stok berkurang, tercatat di `material_movements` dengan `movement_type = OUT` dan `movement_type = WASTE`.

---

## Adjustment Stok (Koreksi Manual)

**Kapan:** Saat stock opname, ditemukan selisih antara sistem dan fisik.

**Siapa:** Admin atau Owner

**Input:**
- Pilih bahan
- Jumlah aktual fisik saat ini
- Alasan adjustment (wajib)

**Hasil:** Stok diupdate ke jumlah aktual, selisih dicatat di `material_movements` dengan `movement_type = ADJUSTMENT`. Wajib masuk audit log.

---

## Alert Stok Minimum

Cek dilakukan setiap kali ada movement OUT atau ADJUSTMENT.
Jika `current_stock ≤ min_stock`:
- Badge merah di dashboard Owner dan Admin
- WhatsApp ke Owner: *"Stok [nama bahan] ([mesin]) menipis: [jumlah] [satuan]. Min: [min_stock]."*
