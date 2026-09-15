# Audit Product–Material Cluster dan Setup Gudang

**Tanggal:** 15 September 2026  
**Ruang lingkup:** form order Admin/Designer Sales, katalog produk, master material Gudang, validasi server, Operator/Scan, dan dampaknya ke produksi.  
**Contoh bisnis:** produk **Banner** hanya boleh menampilkan material Flexi China 280 gr, 350 gr, dan 400 gr.

## Ringkasan keputusan

Kebutuhan ini valid dan perlu dijadikan aturan katalog di server. Sistem sebaiknya memakai **allowlist material per produk** (relasi many-to-many), bukan hanya `Product.category`, `Material.type`, atau satu `default_material_id`.

Alur targetnya:

```text
Gudang membuat master material + stok
        ↓
Admin/Owner mengatur material yang diizinkan untuk setiap produk
        ↓
Admin memilih produk Banner pada form order
        ↓
Form hanya memuat material yang aktif dan diizinkan untuk Banner
        ↓
Default material terpilih otomatis
        ↓
Server memvalidasi ulang product–material sebelum membuat OrderItem
        ↓
Operator melihat material order sebagai saran utama
        ↓
Pemakaian stok hanya dicatat dengan material yang kompatibel,
atau substitusi darurat melalui override beralasan dan audit log
```

Pada audit awal, implementasi **belum memenuhi** alur tersebut. UI dan server masih memperlakukan semua material aktif tenant sebagai pilihan umum.

## Status implementasi setelah persetujuan

Rekomendasi ini sudah diterapkan pada kode dan database lokal:

- Tabel `ProductMaterial` dan index tenant/product sudah ditambahkan.
- Migration `20260915160000_product_material_allowlist` sudah berhasil diterapkan.
- Katalog Produk sekarang menyimpan allowlist material dan material default secara atomik.
- Form order memfilter material berdasarkan produk dan mengosongkan pilihan lama saat produk berganti.
- Server menolak produk tanpa mapping aktif atau material yang tidak termasuk allowlist.
- Auto-release, dashboard kesiapan, Operator, dan Scan membawa validasi material yang sama.
- Seed development sekarang memiliki contoh mapping Banner/Flexi dan produk lain.

Produk existing yang belum memiliki mapping sengaja ditahan sampai Admin/Owner melengkapinya; sistem tidak memilihkan semua material secara otomatis.

## 1. Temuan implementasi saat ini

### 1.1 Model data hanya punya satu material default

`Product` hanya memiliki `default_material_id`, sedangkan `OrderItem` memiliki satu `material_id`. Tidak ada tabel penghubung yang menyatakan daftar material yang diizinkan untuk sebuah produk. Lihat [schema.prisma](</Users/drefan/Projects/PRINT PILOT/frontend/prisma/schema.prisma:349>).

Konsekuensinya:

- Produk Banner tidak dapat menyimpan daftar Flexi 280/350/400 gr secara eksplisit.
- `category` produk hanya label katalog; tidak menjamin kompatibilitas bahan.
- `Material.type` hanya membedakan MEDIA/INK/OTHER; tidak membedakan GSM, lebar, lapisan, atau kecocokan produk.
- `MachineMaterial` menyatakan material yang bisa dipakai mesin, bukan material yang boleh dipilih untuk produk tertentu.

### 1.2 Form order menampilkan seluruh material aktif

`getOrderFormData()` mengambil semua `Material` aktif milik tenant tanpa filter produk di [orders.ts](</Users/drefan/Projects/PRINT PILOT/frontend/src/actions/orders.ts:647>). Data `default_material_id` memang dikirim bersama produk di baris 645–686, tetapi [NewOrderModal.tsx](</Users/drefan/Projects/PRINT PILOT/frontend/src/components/orders/NewOrderModal.tsx:303>) menerima satu array `materials` global dan menampilkannya pada setiap item.

Akibat UX dan bisnis:

- Setelah memilih Banner, bahan kertas, tinta, atau material produk lain masih terlihat.
- Admin dapat salah memilih bahan yang secara teknis tidak cocok.
- Pergantian produk pada baris yang sama dapat meninggalkan material lama jika browser sudah mengisi pilihan sebelumnya.
- Default material belum otomatis dipilih dan belum menjadi filter.

### 1.3 Validasi server belum memeriksa kompatibilitas

`createPrintingOrder()` hanya memeriksa bahwa material memiliki `id`, `tenant_id` yang sama, dan `active = true` di [orders.ts](</Users/drefan/Projects/PRINT PILOT/frontend/src/actions/orders.ts:231>). Tidak ada pemeriksaan bahwa `materialId` diizinkan untuk `productId`.

Ini adalah temuan **P0/P1 integritas transaksi**. Payload yang dimanipulasi, versi browser lama, atau integrasi lain tetap bisa menyimpan pasangan produk–material yang salah walaupun UI nantinya sudah difilter.

### 1.4 Katalog hanya menyediakan “Material Default”

Modal produk di [admin/products/page.tsx](</Users/drefan/Projects/PRINT PILOT/frontend/src/app/(dashboard)/admin/products/page.tsx:95>) hanya memiliki satu dropdown `Material Default`. Action `createPrintingProduct()` dan `updatePrintingProduct()` juga hanya menyimpan `default_material_id` di [master-data.ts](</Users/drefan/Projects/PRINT PILOT/frontend/src/actions/master-data.ts:225> dan `:260`). Belum ada panel **Material yang Diizinkan**.

### 1.5 Operator dan Scan masih menerima semua material

Dashboard Operator menerima daftar material umum dari job dan form pemakaian produksi tidak dibatasi oleh produk/order item. `finishProduction()` hanya memeriksa material berada di tenant di [production.ts](</Users/drefan/Projects/PRINT PILOT/frontend/src/actions/production.ts:584>). Jalur Scan juga memuat semua material dari `getOrderFormData()` di [scan/page.tsx](</Users/drefan/Projects/PRINT PILOT/frontend/src/app/(dashboard)/scan/page.tsx:48>) dan menampilkannya pada penyelesaian produksi di baris 395–405.

Risikonya adalah stok material yang salah berkurang walaupun desain/order memakai material lain.

### 1.6 Dokumen sudah menyebut “material relevan”, implementasi belum

Dokumen order menyatakan bahan dipilih dari daftar material yang relevan dengan produk di [02-ORDER.md](</Users/drefan/Projects/PRINT PILOT/02-WORKFLOW/02-ORDER.md:28>). Pernyataan ini belum didukung oleh skema, action, maupun UI. Dokumentasi perlu dipertahankan sebagai target bisnis, tetapi status implementasi harus ditandai **belum tersedia** sampai allowlist diterapkan.

## 2. Audit setup Gudang

### Yang sudah tersedia

Master material menyimpan data yang berguna untuk stok dan biaya:

- kode material otomatis (`MAT-xxxx`)
- nama
- tipe `MEDIA`, `INK`, atau `OTHER`
- satuan stok dan satuan pemakaian
- satuan custom dan faktor konversi
- stok minimum dan stok aktual
- biaya standar
- material shared atau tidak
- status aktif/nonaktif
- relasi material ke mesin melalui `MachineMaterial`
- pencatatan `MaterialMovement` saat stok disesuaikan atau dipakai produksi

Form tambah material saat ini berada di tab Material pada Gudang/Finishing dan memiliki field tersebut di [MaterialTab.tsx](</Users/drefan/Projects/PRINT PILOT/frontend/src/app/(dashboard)/finishing/MaterialTab.tsx:25>). Ini cukup untuk fondasi inventori dasar.

### Gap setup Gudang yang memengaruhi cluster

1. **Tidak ada Material Group/Family.** Nama bebas seperti `Flexi China 280 gr` belum memiliki metadata terstruktur untuk pencarian, pelaporan, atau validasi.
2. **Tidak ada spesifikasi teknis terpisah.** GSM/berat, lebar, panjang roll, finish, warna, dan kompatibilitas media masih tersirat di nama.
3. **Tidak ada layar pengelolaan material yang diizinkan per produk.** Action `updateMaterial()` ada, tetapi tab material yang diperiksa hanya membuat material dan menyesuaikan stok; belum ada UI untuk mapping produk.
4. **Stok dan kompatibilitas tercampur secara konsep.** `current_stock > 0` tidak berarti bahan boleh digunakan untuk semua produk; sebaliknya material yang stoknya 0 tetap harus tampil di katalog sebagai konfigurasi, tetapi tidak boleh dipilih untuk order baru bila kebijakan stok mewajibkan ketersediaan.
5. **Deaktivasi belum memiliki guard bisnis.** Menonaktifkan material yang menjadi default atau satu-satunya material produk dapat membuat form order dan produksi tidak memiliki pilihan valid.
6. **Relasi mesin belum cukup.** Material yang cocok untuk mesin belum tentu cocok untuk produk; validasi harus merupakan irisan `ProductMaterial` dan `MachineMaterial` saat routing produksi.

## 3. Model bisnis yang disarankan

### 3.1 Pisahkan tiga konsep

**Master Material** dikelola Gudang: apa bendanya dan bagaimana stoknya dihitung.  
**Kompatibilitas Produk** dikelola Admin/Owner: produk mana boleh menggunakan material apa.  
**Kelayakan Produksi** ditentukan sistem: material tersebut aktif, mesin tujuan aktif, dan material terdaftar pada mesin.

Jangan menjadikan nama, kategori, atau `is_shared` sebagai pengganti aturan kompatibilitas.

### 3.2 Relasi `ProductMaterial` yang direkomendasikan

Tambahkan tabel penghubung tenant-scoped, misalnya:

```text
ProductMaterial
- id
- tenant_id
- product_id
- material_id
- role                 PRIMARY / FINISHING / OPTIONAL
- is_default           boolean
- active               boolean
- sort_order           integer
- notes                text nullable
- created_by
- created_at / updated_at
unique (tenant_id, product_id, material_id)
index  (tenant_id, product_id, active)
```

Aturan penting:

- Satu produk dapat memiliki banyak material.
- Satu material dapat dipakai oleh banyak produk.
- Tepat satu material aktif menjadi default untuk produk yang membutuhkan material utama.
- `is_default` harus menunjuk ke material yang juga aktif pada mapping.
- Semua relasi harus memeriksa `tenant_id` pada server.
- `default_material_id` boleh dipertahankan sementara untuk kompatibilitas migrasi, tetapi sumber kebenaran akhir harus `ProductMaterial.is_default`.

Untuk contoh Banner:

```text
Banner
├─ Flexi China 280 gr  (PRIMARY, boleh, default bila dipilih)
├─ Flexi China 350 gr  (PRIMARY, boleh)
└─ Flexi China 400 gr  (PRIMARY, boleh)
```

Material Flexi Korea, kertas foto, tinta, atau media lain tidak tampil kecuali Admin/Owner menambahkannya pada mapping Banner.

### 3.3 Kapan perlu Material Family

Tambahkan `MaterialFamily` hanya sebagai pengelompokan reusable, misalnya `FLEXI_CHINA`, `VINYL`, `KERTAS_FOTO`. Family membantu Gudang mencari dan membuat laporan, tetapi **bukan** otorisasi pemakaian. Produk tetap harus memiliki mapping eksplisit agar penambahan material baru ke family tidak otomatis memperluas pilihan semua produk.

## 4. Alur target dari Gudang sampai order

### Tahap A — Setup material Gudang

1. Gudang membuat material: kode, nama standar, tipe `MEDIA`, satuan beli, satuan pemakaian, konversi, biaya standar, stok minimum, dan spesifikasi teknis.
2. Gudang memasukkan stok awal melalui penerimaan/penyesuaian dengan alasan dan supplier.
3. Material diberi family (misalnya `Flexi China`) dan status aktif.
4. Jika material hanya cocok untuk mesin tertentu, Gudang mengatur `MachineMaterial`.

### Tahap B — Setup produk dan cluster

1. Admin/Owner membuat produk `Banner` dan mengatur satuan/harga/mesin default.
2. Pada panel **Material yang Diizinkan**, Admin memilih Flexi China 280/350/400 gr.
3. Admin memilih satu default, misalnya Flexi China 280 gr.
4. Sistem menolak penyimpanan jika default tidak termasuk allowlist, material nonaktif, atau material tidak berada pada tenant.
5. Sistem menampilkan ringkasan: jumlah material diizinkan, default, dan material yang tidak kompatibel dengan mesin default.

### Tahap C — Pembuatan order

1. Admin memilih `Banner`.
2. Form mengambil mapping produk tersebut; hanya tiga Flexi China yang tampil.
3. Default otomatis terpilih, tetapi Admin boleh mengganti ke 350/400 gr.
4. Jika produk diganti, material lama di-reset; sistem tidak boleh membawa material Banner ke produk Sticker.
5. Jika belum ada mapping, order ditahan dengan pesan **“Material produk belum dikonfigurasi”**; sistem tidak menampilkan semua material sebagai fallback.
6. Server memvalidasi ulang pasangan product–material sebelum `OrderItem` dibuat.

### Tahap D — Produksi dan stok

1. Production Job membawa `orderItem.material_id` sebagai material yang direncanakan.
2. Operator melihat material rencana dan stok/satuan pemakaiannya.
3. Form pemakaian produksi hanya menampilkan material yang diizinkan untuk item tersebut dan kompatibel dengan mesin job.
4. Material alternatif hanya melalui **Ganti Material** dengan alasan wajib, permission Admin/Owner, dan audit log.
5. `finishProduction()` memvalidasi ulang mapping produk–material dan machine–material sebelum membuat `MaterialMovement`.
6. Pemakaian, waste, biaya standar, dan stok tetap dicatat pada material aktual; order item menyimpan material yang direncanakan.

## 5. Rekomendasi UI dan permission

### Form order

- Label: **Material / Bahan untuk Banner** agar konteks produk terlihat.
- Tampilkan nama, kode, spesifikasi utama, stok tersedia, dan satuan pemakaian.
- Default terpilih otomatis.
- Tampilkan peringatan stok rendah tanpa menghapus mapping; keputusan untuk tetap menjual atau menunggu stok mengikuti kebijakan tenant.
- Jika kosong, tampilkan CTA ke **Katalog → Produk → Atur Material**, bukan dropdown semua bahan.

### Katalog Produk

Tambahkan tab/section **Material Produk** pada modal/detail produk:

- daftar material aktif tenant dengan pencarian family/nama/kode
- filter `MEDIA` dan material yang kompatibel dengan mesin default
- centang material yang diizinkan
- radio button untuk default
- urutan tampil (`sort_order`)
- status mapping aktif/nonaktif
- preview “tampil di form order”

### Gudang

Pertahankan kendali Gudang atas master dan stok. Berikan Admin/Owner kendali atas mapping komersial produk. Untuk tenant kecil, satu orang boleh memegang kedua permission melalui role gabungan; hak akses tetap dibedakan di server.

Permission minimum yang disarankan:

- `inventory.material_manage`: membuat/mengubah master material dan status aktif
- `inventory.stock_adjust`: menerima/menyesuaikan stok
- `catalog.product_material_manage`: mengatur allowlist dan default produk
- `production.material_override`: memilih material alternatif dengan alasan

## 6. Prioritas perbaikan

### P0 — sebelum transaksi produksi nyata

1. Tambahkan `ProductMaterial` dan migration tenant-scoped.
2. Tambahkan validasi server pada `createPrintingOrder`, action edit item, dan `finishProduction`.
3. Ubah form order agar menerima material per produk; fail closed bila mapping kosong.
4. Pastikan default selalu berada dalam mapping aktif.

### P1 — sebelum dipakai banyak tenant

1. Buat UI mapping pada Katalog Produk.
2. Batasi Operator/Scan pada material item + material kompatibel mesin.
3. Tambahkan override terkontrol dengan alasan dan audit log.
4. Tambahkan guard aktivasi/nonaktif material yang digunakan produk aktif atau job terbuka.
5. Tambahkan audit data existing dan dashboard konfigurasi yang belum lengkap.

### P2 — penguatan Gudang dan analitik

1. Tambahkan Material Family dan spesifikasi terstruktur.
2. Tambahkan supplier, lokasi penyimpanan, lead time, reorder quantity, dan lot/batch bila kebutuhan operasional sudah terbukti.
3. Tambahkan laporan konsumsi material per produk, mesin, dan waste.

## 7. Strategi migrasi data

1. Buat tabel `ProductMaterial` tanpa menghapus `default_material_id`.
2. Salin setiap `default_material_id` aktif menjadi mapping default setelah memeriksa tenant dan status material.
3. Audit pasangan historis `OrderItem.product_id` + `material_id`. Jangan otomatis memperluas allowlist dari semua pasangan historis karena data lama mungkin merupakan salah pilih.
4. Tampilkan pasangan historis yang belum terpetakan dalam laporan review Admin/Owner; mapping baru hanya disetujui setelah pemeriksaan bisnis.
5. Produk aktif tanpa mapping diberi status konfigurasi **INCOMPLETE** dan tidak dapat dipakai untuk order baru.
6. Setelah backfill diverifikasi, ubah form dan server ke sumber kebenaran `ProductMaterial`.
7. Hapus `default_material_id` hanya pada migration terpisah setelah semua integrasi dan laporan berpindah ke `ProductMaterial.is_default`.

Hasil verifikasi runtime setelah PostgreSQL tersedia: migration `20260915160000_product_material_allowlist` berhasil diterapkan. Database saat ini berisi 8 produk, 39 baris material, 1 mapping `ProductMaterial`, dan 7 produk aktif tanpa mapping material aktif. Angka ini mencakup seluruh tenant lokal; produk yang belum terkonfigurasi harus dilengkapi melalui Katalog Produk sebelum dapat dipakai membuat order baru.

## 8. Skenario uji penerimaan

- **Pilih Banner:** hanya Flexi China 280/350/400 gr tampil.
- **Pilih Banner lalu ganti ke Sticker:** material Banner ter-reset dan tidak tersimpan.
- **Kirim payload material produk lain lewat browser:** server menolak order.
- **Produk belum punya mapping:** order ditahan dengan pesan konfigurasi; semua material tidak ditampilkan sebagai fallback.
- **Default dinonaktifkan:** sistem menolak konfigurasi atau meminta default baru.
- **Material Banner stok 0:** mapping tetap ada; pilihan menampilkan stok habis sesuai kebijakan stok tenant.
- **Material cocok produk tetapi tidak cocok mesin:** routing/produksi menolak atau meminta mesin alternatif yang kompatibel.
- **Operator mengganti bahan saat produksi:** hanya mapping kompatibel; override wajib alasan dan audit.
- **Material dinonaktifkan saat ada job terbuka:** sistem menolak deaktivasi atau memberi dampak terbuka yang jelas.
- **Tenant A mengirim ID material Tenant B:** server menolak karena tenant scope.

## Kesimpulan

Konsep “cluster material per product” adalah perubahan kontrol bisnis, bukan sekadar filter dropdown. Implementasi sekarang baru memiliki master material dan satu default; belum memiliki allowlist produk, UI konfigurasi cluster, atau validasi server. Rekomendasi profesional adalah `ProductMaterial` sebagai sumber kebenaran kompatibilitas, Material Family sebagai metadata opsional, dan validasi yang sama pada order, produksi, serta pengurangan stok.

Dengan model ini, Admin mendapatkan form yang ringkas dan benar, Gudang tetap mengendalikan stok, Operator tidak salah memakai bahan, dan sistem tetap aman untuk tenant yang hanya memiliki satu orang maupun tenant dengan banyak Admin/Gudang/Operator.
