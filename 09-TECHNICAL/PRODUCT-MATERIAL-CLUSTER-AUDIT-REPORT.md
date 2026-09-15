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

**Koreksi audit ulang 15 September 2026:** implementasi baru memenuhi sebagian rekomendasi. Rincian kondisi terbaru ada di bagian 9; bagian 1–8 mencatat audit awal dan target bisnis, bukan jaminan seluruh fitur sudah tersedia. Database lokal dan aplikasi pada screenshot belum terbukti merupakan lingkungan yang sama.

Bagian berikut sudah diterapkan pada kode dan database lokal:

- Tabel `ProductMaterial` dan index tenant/product sudah ditambahkan.
- Migration `20260915160000_product_material_allowlist` sudah berhasil diterapkan.
- Katalog Produk sekarang menyimpan allowlist material dan material default secara atomik.
- Form order memfilter material berdasarkan produk dan mengosongkan pilihan lama saat produk berganti.
- Server menolak produk tanpa mapping aktif atau material yang tidak termasuk allowlist.
- Auto-release dan dashboard kesiapan membawa mapping material. Operator/Scan juga menerima mapping, tetapi pembatasan dan validasi penyelesaian produksi belum setara dengan validasi order (lihat bagian 9).
- Seed development sekarang memiliki contoh mapping Banner/Flexi dan produk lain.

Produk existing yang belum memiliki mapping sengaja ditahan sampai Admin/Owner melengkapinya; sistem tidak memilihkan semua material secara otomatis.

## 1. Temuan audit awal — sebelum perubahan allowlist

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

## Kesimpulan audit awal

Konsep “cluster material per product” adalah perubahan kontrol bisnis, bukan sekadar filter dropdown. Implementasi sekarang baru memiliki master material dan satu default; belum memiliki allowlist produk, UI konfigurasi cluster, atau validasi server. Rekomendasi profesional adalah `ProductMaterial` sebagai sumber kebenaran kompatibilitas, Material Family sebagai metadata opsional, dan validasi yang sama pada order, produksi, serta pengurangan stok.

Dengan model ini, Admin mendapatkan form yang ringkas dan benar, Gudang tetap mengendalikan stok, Operator tidak salah memakai bahan, dan sistem tetap aman untuk tenant yang hanya memiliki satu orang maupun tenant dengan banyak Admin/Gudang/Operator.

## 9. Audit ulang berdasarkan screenshot pukul 17.13–17.15

### 9.1 Metode dan batas bukti

Audit ini memeriksa empat screenshot, kode lokal pada commit `cceb57e4`, migration, dokumen, dan query SELECT melalui Prisma ke PostgreSQL lokal. Tidak membuat order, mengubah konfigurasi bahan, mengurangi stok, atau mengubah kode aplikasi. Skenario uji di bawah adalah kriteria penerimaan, belum hasil pengujian E2E.

Alamat aplikasi tidak terlihat pada screenshot. Belum ada konfirmasi apakah screenshot berasal dari localhost atau website server. Audit tidak membaca database server atau memverifikasi build yang sedang dilayani server tersebut.

### 9.2 Mengapa semua material masih terlihat?

**Bukti screenshot:** produk BANNER menawarkan Art Paper A3, Stiker Vinyl, dan Tinta Eco Solvent bersama bahan Flexi. Ini tidak memenuhi kebutuhan pembatasan bahan utama per produk. Placeholder berbunyi “Pilih bahan...”.

**Bukti kode lokal:** `NewOrderModal.tsx:274` mengambil `selectedProduct.allowedMaterials`, bukan array material umum. Pada baris 322–330, placeholder sudah menjadi “Pilih bahan untuk produk...”; produk tanpa mapping menampilkan pesan konfigurasi dan dropdown dinonaktifkan. Admin dan Designer menggunakan komponen modal yang sama. `orders.ts:232` juga menolak pasangan produk–material yang tidak terdaftar.

Artinya, mapping kosong pada kode baru **tidak menjelaskan dropdown berisi semua material**. Screenshot lebih konsisten dengan form versi lama atau lingkungan aplikasi berbeda. Ini inferensi, belum kepastian. Alternatif yang perlu diperiksa pada lingkungan screenshot adalah seluruh material memang dicentang untuk BANNER; hal ini bisa membuat pilihan terlalu luas, walaupun perbedaan placeholder tetap perlu dijelaskan.

Git lokal menunjukkan commit `cceb57e4 feat: enforce product material allowlists`, satu commit lebih maju dari referensi upstream yang tersimpan lokal. Referensi itu bukan pemeriksaan GitHub terkini. Push sebelumnya belum berhasil; tidak ada bukti deploy server memuat commit tersebut. Commit lokal, push GitHub, build server, migration server, dan mapping katalog merupakan lima langkah berbeda.

Cara memastikan penyebab pada lingkungan yang digunakan:

1. Pastikan URL, tenant/toko, dan commit aplikasi yang berjalan.
2. Periksa apakah edit Produk menampilkan “Material yang Diizinkan untuk Produk”.
3. Periksa daftar mapping BANNER di database lingkungan tersebut.
4. Periksa respons `getOrderFormData`: apakah mapping BANNER hanya berisi bahan yang disetujui?
5. Jika respons benar tetapi UI masih lama, periksa build/proses yang dilayani, lalu muat ulang browser. Refresh sendiri tidak memperbarui deployment.
6. Jika deployment belum diperbarui, jalankan rilis dan migration secara terkontrol, kemudian lengkapi mapping. Jangan menggunakan seed sebagai perbaikan data operasional.

### 9.3 Kondisi database lokal yang terverifikasi ulang

Ditemukan **8 produk aktif lintas tenant lokal**, hanya **1 produk memiliki mapping aktif**, sehingga **7 produk belum terkonfigurasi**. Produk “Cetak Banner Outdoor” belum memiliki mapping maupun default material. Satu mapping yang ada menghubungkan “Spanduk” dengan Albatros; keberadaan relasi ini bukan penilaian bahwa bahan tersebut sesuai secara bisnis.

Nama produk lokal berbeda dari screenshot: database yang diperiksa tidak menampilkan katalog BANNER, BANNER KOREA, BROCURE, dan GANCI UV seperti screenshot. Karena itu angka lokal tidak boleh dianggap sebagai kondisi tenant pada screenshot.

Migration hanya menyalin `default_material_id` lama ke `ProductMaterial`. Ia tidak menebak kompatibilitas dari nama, kategori, atau riwayat order. Maka migrasi berhasil tidak berarti seluruh produk sudah memiliki daftar bahan. Backfill juga belum menyaring status aktif material; pembacaan mapping pada aplikasi menyaring material aktif.

### 9.4 Empat konsep yang perlu dipisahkan

1. **Kategori produk**, misalnya OUTDOOR atau A3+, membantu mencari produk pada dropdown. Kategori ini tidak menghubungkan bahan secara otomatis.
2. **Tipe material**, yaitu MEDIA, INK, OTHER, mengelompokkan fungsi umum persediaan. Semua MEDIA belum tentu cocok untuk Banner.
3. **Kelompok bahan**, misalnya Flexi Banner, Kertas Art Paper, atau Vinyl Stiker, membantu pengelolaan gudang. Field kelompok ini belum tersedia pada modal Gudang yang diperiksa.
4. **Daftar bahan yang diizinkan per produk**, disimpan di `ProductMaterial`, menentukan pilihan sah saat transaksi.

Rekomendasi: gunakan hubungan banyak-ke-banyak yang sudah tersedia. Satu produk dapat memakai beberapa bahan; satu bahan dapat dipakai beberapa produk tanpa menggandakan stok. Kelompok bahan menjadi alat bantu memilih mapping, bukan izin otomatis untuk seluruh bahan baru dalam kelompok.

### 9.5 Alur bisnis yang direkomendasikan

**Setup Gudang oleh Owner/Gudang:** buat material dengan nama jelas, tipe, kelompok, spesifikasi, satuan stok, satuan pemakaian, konversi, dan stok minimum. Kode saat ini membatasi pembuatan material ke Owner/Gudang; jangan menyebut Admin otomatis memiliki izin tersebut.

**Setup Katalog oleh Admin/Owner:** pilih produk BANNER, centang Flexi China 280 gr, 350 gr, dan 400 gr jika memang tersedia dan disetujui toko. Tetapkan default hanya dari daftar tersebut. Pilih mesin yang kompatibel. Material contoh adalah target konfigurasi, bukan klaim bahwa semuanya sudah ada di database.

**Order oleh Admin/Designer:** pilih BANNER → hanya tiga bahan tersebut muncul → pilih bahan → ukuran/qty → harga dan deadline. Setiap item memiliki filter sendiri. Mengganti produk harus membuang bahan yang tidak sesuai. Server memvalidasi ulang pasangan item, tenant, dan status aktif.

**Desain dan ACC:** bahan dan spesifikasi menjadi bagian konteks item yang disetujui. Jika bahan berubah setelah ACC dan perubahan memengaruhi hasil/desain/harga, lakukan perubahan order tercatat dengan persetujuan ulang sesuai dampaknya, bukan mengganti bahan diam-diam.

**Produksi:** job membawa bahan rencana per item dan mesin yang ditetapkan. Operator mencatat bahan utama sesuai job. Tinta serta bahan pendukung dicatat melalui daftar konsumsi mesin/BOM terpisah. Substitusi memerlukan otorisasi, alasan, dampak harga/desain, dan audit; fitur ini masih rekomendasi.

**Gudang:** stok dipotong berdasarkan pemakaian yang sudah dikonversi ke satuan stok; histori order mempertahankan spesifikasi saat transaksi.

### 9.6 Rekomendasi UI Gudang dan Katalog

- Gudang: tambahkan filter kelompok dan indikator “Dipakai pada N produk” atau “Belum terhubung”. Pengguna berizin katalog dapat membuka pengaturan relasi; pengguna gudang biasa cukup melihat atau meminta konfigurasi.
- Material: tambahkan spesifikasi yang relevan seperti gramasi dan lebar roll. Nama “KOREA” dan “Flexi Korea” pada screenshot perlu ditinjau karena ambigu; jangan otomatis digabung atau dihapus karena belum terbukti bahan yang sama.
- Katalog: tampilkan pencarian dan filter kelompok pada daftar bahan, jumlah yang dipilih, lalu default yang hanya berasal dari pilihan tersebut. Istilah “Bahan yang tersedia untuk produk” lebih mudah dipahami daripada “allowlist”.
- Bahan utama dan konsumsi pendukung perlu dipisahkan. Pada Banner, tinta tidak menjadi opsi bahan utama. Jangan melarang semua tipe OTHER secara global karena produk lain dapat memakai substrat selain kertas/media konvensional.
- Tombol “Tambahkan bahan dari kelompok” boleh membantu memilih banyak bahan, tetapi harus menampilkan daftar yang akan ditambahkan dan disimpan eksplisit. Menambahkan bahan baru ke Gudang tidak langsung memperluas opsi produk.
- Stok nol sebaiknya tetap terlihat dengan penanda dan kebijakan penerimaan order yang jelas. Kompatibilitas dan ketersediaan stok adalah dua hal berbeda.
- Produk tanpa mapping: tampilkan “Bahan produk belum diatur” dan jalur ke konfigurasi bagi pengguna berizin. Tidak boleh kembali menampilkan seluruh material.
- Untuk toko satu orang, Owner dapat melakukan setup Gudang dan Katalog dengan akun yang sama. Pembagian izin tidak perlu memaksa adanya karyawan terpisah.

### 9.7 Celah implementasi lain yang perlu ditangani

**A. Konfigurasi masih bisa salah meski filter bekerja.** Checkbox Katalog menerima semua material aktif tanpa membedakan bahan utama dan pendukung; server memeriksa tenant/status tetapi tidak semantik bahan. Field `ProductMaterial.role` sudah ada, tetapi belum menjadi filter bahan utama pada pembacaan order. Default bersifat opsional; index database hanya menjamin paling banyak satu default aktif, bukan wajib satu. Tetapkan kebijakan default eksplisit dan konsisten.

**B. Harga belum mengikuti bahan.** Harga otomatis masih memakai `Product.base_price` (`orders.ts:256` dan `:266`). Memilih Flexi 400 gr tidak otomatis memberi tarif berbeda dari 280 gr. Rekomendasi: harga per pasangan produk–bahan atau daftar tarif yang memiliki satuan, disimpan sebagai snapshot pada item. Jika tarif belum diatur, minta harga manual sesuai izin; jangan mengesankan bahan lebih mahal sudah dihitung otomatis.

**C. Operator/Scan masih mempunyai fallback seluruh material.** Ketika daftar bahan rencana dan mapping sama-sama kosong, kedua UI kembali ke array material umum. Ini berbeda dari form order baru. Tutup fallback untuk pekerjaan berbasis produk; job lama yang belum lengkap membutuhkan peninjauan konfigurasi.

**D. Validasi selesai produksi masih terlalu luas.** `production.ts:600` mengambil seluruh item printing dalam order, menggabungkan semua material, lalu memeriksa terhadap gabungan tersebut. Ini belum memvalidasi pasangan produk–material per item maupun membatasi bahan ke item job/mesin tertentu. Order dua mesin berisiko menerima bahan milik job lain lewat payload. Pemeriksaan kompatibilitas dilewati ketika mapping kosong. Lookup material juga belum mensyaratkan aktif.

**E. Mesin dan substitusi belum lengkap.** Pada jalur penyelesaian yang diperiksa tidak ada pemeriksaan `MachineMaterial`. Pesan error menyuruh memakai alur override, tetapi alur substitusi operasional belum tersedia pada UI yang diperiksa. Dokumen menyatakan lebih banyak daripada implementasi; klaim sebelumnya bahwa semua jalur sudah sama perlu dikoreksi.

**F. Konversi stok perlu prioritas tinggi.** UI Operator meminta satuan pemakaian, sedangkan `finishProduction` mengurangi `usageQty + wasteQty` langsung dari `current_stock`, tanpa `conversion_factor`. Contoh hipotetis: stok 2 roll, 1 roll = 50 meter, pemakaian 5 meter harus mengurangi 0,1 roll, bukan 5 roll. Jangan menyimpulkan semua stok aktual sudah salah tanpa audit movement; risikonya berlaku pada konfigurasi dengan satuan berbeda. Perlu konsistensi ledger, waste, pembulatan, dan satuan biaya. Jika konsumsi memakai m² tetapi stok meter panjang, lebar roll juga harus ikut perhitungan.

### 9.8 Urutan pekerjaan yang disarankan

**Tahap 1 — pastikan lingkungan dan konfigurasi:** cocokkan URL/tenant/commit, verifikasi deployment dan migration, audit mapping pada tenant tersebut, lengkapi daftar bahan produk yang benar. Ini langkah pertama untuk menjelaskan screenshot; belum perlu membangun ulang fondasi relasi yang sudah ada.

**Tahap 2 — perkuat transaksi:** tutup fallback, validasi per item/per job/per mesin, periksa material aktif, tangani perubahan katalog terhadap order terbuka, dan perbaiki konversi stok sebelum mengandalkan pencatatan konsumsi produksi nyata. Jangan mengubah spesifikasi order lama secara otomatis saat mapping katalog berubah.

**Tahap 3 — rapikan setup:** kelompok material, pencarian mapping, pemisahan bahan utama/pendukung, badge produk belum lengkap, default yang konsisten, dan audit log perubahan mapping. Uji izin untuk pengguna dengan satu maupun beberapa role.

**Tahap 4 — harga dan substitusi:** tarif per material, snapshot spesifikasi/harga pada item, prosedur revisi bahan, substitusi terotorisasi, dan konsumsi pendukung mesin. Kelompokkan backlog ini terpisah dari perbaikan dropdown agar cakupan rilis jelas.

### 9.9 Kriteria penerimaan tambahan

1. Banner menampilkan hanya bahan yang diizinkan, termasuk ketika Admin/Designer membuka form yang sama.
2. Item pertama Banner dan item kedua Brosur menampilkan daftar masing-masing; perubahan produk tidak meninggalkan bahan lama.
3. Material baru di Gudang tidak muncul pada Banner sampai mapping disimpan.
4. Payload bahan tidak sesuai, nonaktif, atau lintas tenant ditolak tanpa membuat order parsial.
5. Material diizinkan untuk produk A tidak otomatis sah untuk produk B dalam order yang sama.
6. Operator job mesin A tidak bisa mencatat material item milik job mesin B.
7. Job lama tanpa mapping tidak membuka semua bahan; ada jalur peninjauan yang jelas.
8. Stok 2 roll dengan faktor 50 dan penggunaan 5 meter menghasilkan 1,9 roll serta ledger konsisten; waste memakai konversi yang sama.
9. Pemilihan bahan dengan tarif berbeda memperbarui penawaran sesuai aturan; perubahan katalog tidak menulis ulang harga historis.
10. Penonaktifan bahan/default saat order terbuka menghasilkan keputusan eksplisit, bukan hilangnya pilihan tanpa penjelasan.

**Kesimpulan audit ulang:** kebutuhan pengguna tepat dan fondasi filter produk–material sudah ada di kode lokal, tetapi belum terbukti terpasang pada lingkungan screenshot, data lokal sebagian besar belum dipetakan, dan kontrol produksi/gudang masih perlu dilengkapi. Pengelompokan tampilan saja tidak cukup untuk menyatakan alur bisnis selesai.

## 10. Implementasi lanjutan setelah persetujuan rekomendasi

Perubahan berikut sudah diterapkan pada kode lokal dan migration `20260915180000_material_catalog_integrity` sudah berhasil diterapkan ke PostgreSQL lokal:

- Material memiliki kelompok, spesifikasi, dan fungsi `PRIMARY` atau `CONSUMABLE`. Material bertipe INK otomatis menjadi consumable.
- Katalog produk hanya dapat menghubungkan material utama aktif. Tinta tidak dapat dijadikan bahan utama produk.
- Katalog menampilkan pencarian dan filter kelompok bahan, default yang berasal dari pilihan yang sama, serta tarif per pasangan produk–material.
- Harga order memakai tarif pasangan produk–material bila diatur, lalu menyimpan snapshot spesifikasi material dan tarif pada OrderItem. Harga historis tidak mengikuti perubahan katalog berikutnya.
- Relasi item job produksi kini disimpan di `ProductionJobItem`. Scope job tidak lagi dihitung ulang dari mesin default produk setelah job dibuat.
- Auto-release dan assign manual memvalidasi bahwa setiap bahan rencana terdaftar pada mesin job. Job lama tanpa scope item mendapat tombol **Tinjau item & bahan** pada Admin → Produksi.
- Admin/Owner dapat meninjau item dan bahan job yang belum lengkap melalui dialog dengan konfirmasi desain/harga, alasan wajib, serta riwayat pada job dan audit log. Job yang sudah dimulai tidak boleh mengganti rencana bahan melalui dialog tersebut.
- Operator dan Scan hanya menerima bahan utama job serta bahan consumable mesin. Fallback ke seluruh master material dihapus untuk jalur job berbasis item.
- Penyelesaian produksi memvalidasi semua bahan utama job, melarang duplikasi atau bahan dari job lain, memastikan material aktif, dan mengunci baris stok sebelum pengurangan.
- Pemakaian dan waste dikonversi dari satuan pemakaian ke satuan stok menggunakan `conversion_factor` dengan presisi enam desimal. Satuan/konversi material yang sudah dipakai tidak dapat diubah; buat material baru agar histori tetap konsisten.
- Penyesuaian stok mewajibkan alasan, memakai lock per material, dan perubahan material yang masih terkait order terbuka, produk aktif, atau job aktif ditahan.

Verifikasi yang lulus:

- `npx prisma migrate status` — database lokal up to date.
- `npx tsc --noEmit` — lulus.
- `npx next build --webpack` — lulus sampai finalizing page optimization dan menghasilkan seluruh route.
- Unit test policy material — 3 test lulus.
- Integrasi PostgreSQL dengan fixture rollback — 1 test lulus. Fixture dibuat dalam transaksi dan selalu dibatalkan.
- ESLint pada file yang berubah — tidak ada error; tersisa lima warning lama tentang import/props yang tidak dipakai.

Catatan rilis: migration, kode, dan mapping katalog pada server harus dipasang terpisah. Perubahan lokal belum otomatis mengubah website server. Sebelum membuka order baru, Admin/Owner perlu mengisi allowlist produk dan relasi `MachineMaterial`; produk yang belum lengkap akan tertahan dengan alasan yang ditampilkan di dashboard.
