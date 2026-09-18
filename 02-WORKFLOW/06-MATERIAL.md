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

**Siapa:** Gudang atau Owner (wajib login dengan akun sendiri)

**Input:**
- Pilih bahan dari daftar (dikelompokkan per mesin)
- Jumlah yang masuk (dalam satuan stok: Roll, Rim, Liter, dll)
- Harga beli per satuan (opsional)
- Supplier (opsional)
- Tanggal masuk
- Catatan

Penerimaan memakai menu **Finishing & Gudang → Material & Stok → Stok Masuk**.
Jumlah yang dimasukkan adalah delta barang yang baru diterima, bukan saldo akhir.
Sistem menambahkan delta ke stok lama secara atomik dan menyimpan supplier,
tanggal terima, nomor referensi, dan harga beli bila diisi.

**Hasil:** `material_movements` baru dengan `movement_type = IN`, stok bertambah otomatis.

## Purchase Order dan Penerimaan Parsial

Untuk pembelian yang perlu ditelusuri, gunakan tab **Pembelian** sebelum barang
tiba:

1. Admin/Owner membuat supplier bila belum tersedia.
2. Admin/Owner membuat Purchase Order dengan satu atau beberapa material,
   jumlah, harga beli, dan target tiba.
3. PO berstatus `SUBMITTED` dan dapat diterima Gudang atau Owner secara parsial.
4. Setiap penerimaan mengunci item dan material dalam transaksi, menambah stok,
   serta membuat movement `IN` yang menyimpan PO, item PO, supplier, harga, dan
   nomor referensi.
5. Status PO menjadi `PARTIAL` sampai seluruh item terpenuhi, lalu `RECEIVED`.

Jumlah penerimaan tidak boleh melebihi sisa PO. PO `DRAFT` dan `CANCELLED`
tidak dapat diterima. Dengan aturan ini, penerimaan stok dapat direkonsiliasi
dengan dokumen pembelian dan tidak tercampur dengan adjustment opname.

Pada implementasi saat ini, PO yang dibuat langsung berstatus `SUBMITTED`.
Tenant yang memerlukan dual control dapat menambahkan approval Owner sebelum
status tersebut dibuka untuk penerimaan.

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

**Siapa:** Owner

**Input:**
- Pilih bahan
- Jumlah aktual fisik saat ini
- Alasan adjustment (wajib)

**Hasil:** Stok diupdate ke jumlah aktual, selisih dicatat di `material_movements` dengan `movement_type = ADJUSTMENT`. Wajib masuk audit log.

---

## Alert Stok Minimum

Cek dilakukan setiap kali ada movement OUT atau ADJUSTMENT.
Jika `current_stock ≤ min_stock`, panel Alert Operasional membuat alert in-app
yang dideduplikasi per material. Integrasi WhatsApp dapat ditambahkan sebagai
channel lanjutan tanpa mengubah catatan stok.

## Stock Opname

Gudang memulai sesi opname dari **Material & Stok → Stock Opname**. Sistem
menyimpan snapshot saldo, Gudang mengisi hitung fisik dan catatan, kemudian
mengirim sesi ke Owner. Owner memeriksa selisih dan menyetujui penerapan.
Approval dikunci secara transaksi dan ditolak bila saldo berubah sejak snapshot.
Setiap selisih yang diterapkan dibuat sebagai movement `ADJUSTMENT`, bukan
`IN`, sehingga pembelian tetap dapat dibedakan dari koreksi fisik.
