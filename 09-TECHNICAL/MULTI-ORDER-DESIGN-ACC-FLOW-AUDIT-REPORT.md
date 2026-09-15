# Audit Skenario Multi-Order dan Multi-Item Desain

**Tanggal:** 15 September 2026
**Ruang lingkup:** konsumen yang memiliki lebih dari satu order cetak, satu order dengan beberapa item cetak, upload file Designer, approval/ACC, revisi, dan readiness produksi.

## Kesimpulan

Alur normal sudah memisahkan data dengan benar:

- **Order berbeda dari konsumen yang sama** memiliki `Order` dan `DesignJob` yang berbeda.
- **Beberapa item dalam satu order** memakai satu `DesignJob`, tetapi setiap file dapat ditujukan ke `order_item_id` tertentu.
- File tidak berpindah otomatis antar-order.
- `DesignJob` baru menjadi `APPROVED` jika seluruh item non-retail pada order tersebut sudah memiliki file approved.
- Order baru dapat masuk produksi setelah desain lengkap, pembayaran, dan completeness gate terpenuhi.

Status keseluruhan: **alur normal sesuai dan cukup aman, tetapi masih ada satu risiko P1 pada revisi/bounce multi-item dan beberapa kelemahan UX/data integrity yang perlu ditutup sebelum SOP dianggap final.**

## Interpretasi skenario

### Skenario A — Satu konsumen membuat beberapa order terpisah

Contoh:

- `ORD-20260915-0001` — Banner 3×1 meter.
- `ORD-20260915-0002` — Sticker A4.
- Keduanya memakai customer yang sama.

Setiap order dibuat dengan:

1. satu `Order`;
2. satu `DesignJob` dengan `order_id` masing-masing;
3. satu kumpulan `DesignVersion` yang hanya boleh mengarah ke `DesignJob` tersebut.

Dashboard Designer menampilkan satu baris per order, bukan satu baris per customer. Designer memilih baris berdasarkan order code, lalu upload menggunakan `row.orderId`. Server memvalidasi `orderId` terhadap tenant dan `DesignJob` sebelum membuat versi.

Artinya, file Banner pada order pertama tidak dapat menutup kebutuhan desain Sticker pada order kedua. Setiap order harus diproses dan di-ACC secara mandiri.

### Skenario B — Satu order memiliki beberapa item cetak

Contoh:

- Banner 3×1 meter.
- Sticker A4.
- Kartu nama.

Sistem menyediakan dua model file:

- `order_item_id = item tertentu`: file hanya menutup item tersebut.
- `order_item_id = null`: file dianggap layout gabungan yang menutup seluruh order.

Upload Designer menampilkan pilihan **Desain untuk**. Setiap item ditampilkan dengan status apakah belum ada, perlu revisi, atau sudah memiliki desain final. Server tetap memverifikasi bahwa `order_item_id` memang milik `orderId` yang sama dan bukan item retail.

## Alur lengkap sampai semua desain di-ACC

### 1. Order dibuat

`createPrintingOrder()` membuat order berstatus `DRAFT`, item-item order, dan satu `DesignJob` berstatus `PENDING` dengan `current_version = 0`.

Per order, PIC Designer disimpan pada `DesignJob.designer_id`. Jika tidak ada PIC, Designer mengambil tugas melalui tombol **Ambil Tugas**. Klaim sudah menggunakan update atomik sehingga dua Designer tidak dapat mengambil job yang sama.

### 2. Designer mengambil dan membuka order

`getDesignQueue()` mengembalikan order aktif dalam tenant yang sama. Baris menampilkan:

- order code;
- nama konsumen;
- PIC Designer;
- metode approval;
- status job desain;
- jumlah item;
- status file desain terbaru per item.

Jika konsumen memiliki beberapa order, order code menjadi identitas utama yang membedakan baris-baris tersebut. Pencarian juga dapat memakai nama konsumen, tetapi untuk menghindari salah order Designer harus mengonfirmasi order code sebelum upload.

### 3. Designer upload hasil desain

Untuk order satu item, Designer dapat langsung upload file ke order tersebut.

Untuk order multi-item, Designer memilih item target pada dropdown:

1. pilih item Banner, Sticker, atau item lain;
2. upload file desain;
3. file disimpan sebagai versi pada slot item tersebut;
4. ulangi proses untuk item berikutnya.

Nomor versi dialokasikan per slot dan dikunci dalam transaksi `DesignJob`, sehingga V1 Banner dan V1 Sticker dapat sama-sama valid tanpa saling tertukar.

Untuk metode `WALK_IN` dan `ONLINE`, file baru berstatus `PENDING`. Untuk `MAKLOON`, file langsung berstatus `APPROVED` setelah upload karena file berasal dari konsumen/makloon.

### 4. ACC sebagian

Jika baru satu atau sebagian item yang sudah diupload, Designer/Admin dapat menyetujui versi yang sudah ada.

`approveDesign(orderId, { itemId: null })` mengambil versi terbaru yang belum approved pada setiap slot dalam **order tersebut saja**. Versi item yang belum diupload tidak dianggap approved.

Setelah approval sebagian:

- versi yang sudah ada berubah menjadi `APPROVED`;
- `DesignJob` tetap `DESIGNING`;
- item yang belum memiliki file approved tetap tercatat sebagai `pendingItems`;
- produksi tidak boleh dimulai.

Designer kemudian kembali ke baris order yang sama, memilih item yang masih kosong/rejected, upload, lalu melakukan ACC lagi.

### 5. Semua desain selesai dan di-ACC

`designCoverage()` menghitung semua `OrderItem` non-retail dalam order tersebut. `DesignJob` berubah menjadi `APPROVED` hanya jika:

- setiap item memiliki file approved sendiri; atau
- satu file `order_item_id = null` secara eksplisit dipakai sebagai layout gabungan seluruh order.

Setelah `DesignJob` menjadi `APPROVED`, sistem menghitung ulang status pembayaran dan completeness gate. Jika DP sudah terpenuhi dan semua data order lengkap, sistem dapat mengubah order menjadi `CONFIRMED` dan menjalankan auto-release ke produksi.

## Kontrol keamanan yang sudah sesuai

- Setiap upload mencari `DesignJob` berdasarkan `orderId` dan `tenant_id`.
- Setiap item target diverifikasi memiliki `order_id` yang sama.
- Designer hanya dapat upload/ACC jika menjadi PIC, kecuali Admin/Owner.
- Order yang sudah masuk produksi tidak dapat diubah melalui upload desain biasa.
- Versi yang masih menunggu ACC tidak dapat diganti dengan upload baru tanpa revisi resmi.
- Slot yang sudah approved tidak dapat di-upload ulang tanpa request revisi.
- `approveDesign()` memproses versi terbaru per slot, bukan semua histori versi.
- `coveredDesignItemIds()` mencegah satu item yang belum memiliki file approved dianggap siap produksi.
- Auto-release membuat job hanya untuk order yang sama dan tidak mengambil file dari order konsumen lain.

Implementasi utama berada di [orders.ts](</Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/orders.ts:247>), [queries.ts](</Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/queries.ts:283>), [design.ts](</Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/design.ts:210>), dan [production-readiness.ts](</Users/drefan/Projects/PRINT%20PILOT/frontend/src/lib/production-readiness.ts:48>).

## Temuan yang masih perlu diperbaiki

### P1 — Bounce/revisi produksi multi-item masih dapat menyisakan desain lama

`bounceDesignFromProduction()` masih memilih satu `DesignVersion` berdasarkan `design.current_version`. `current_version` adalah ringkasan nomor tertinggi lintas slot, sedangkan nomor versi sebenarnya berjalan per item.

Contoh:

- Banner memiliki V1.
- Sticker juga memiliki V1.
- `current_version` bernilai 1.
- Operator mengembalikan order untuk revisi.

Hanya satu record V1 yang dapat terkena penolakan. Slot lain masih dapat berstatus approved. Jika Designer mengupload satu file baru lalu coverage kembali penuh karena slot lain masih memakai file lama, order dapat maju dengan campuran desain baru dan desain lama.

Rekomendasi: saat bounce atau revisi seluruh order, tandai versi terbaru pada **setiap slot** sebagai `REJECTED`/`SUPERSEDED`, hapus atau tahan seluruh job produksi pra-mulai, lalu wajibkan coverage ulang per slot.

### P2 — Item yang identik sulit dibedakan di dropdown Designer

Dropdown saat ini menampilkan produk, ukuran, dan jumlah. Jika satu order berisi dua item dengan produk, ukuran, dan jumlah yang sama, Designer dapat salah memilih slot walaupun server tetap menyimpan file pada `order_item_id` yang benar.

Rekomendasi: tampilkan nomor urut item, deskripsi, finishing, bahan, atau kode pendek `OrderItem` pada pilihan dropdown dan detail.

### P2 — Hasil ACC sebagian belum ditampilkan dengan jelas

Server mengembalikan `pendingItems` dan `fullyApproved`, tetapi callback UI hanya memuat ulang tabel. Designer melihat status tetap `Sedang Dikerjakan`, namun tidak menerima pesan eksplisit item mana yang masih kurang.

Rekomendasi: tampilkan notifikasi seperti `ACC tersimpan. Masih menunggu: Sticker A4, Kartu Nama`.

### P2 — Tidak ada fitur reuse desain antar-order

Dua order dari customer yang sama tidak berbagi file secara otomatis. Ini aman untuk isolasi data, tetapi jika konsumen meminta desain yang sama dicetak ulang pada order baru, Designer harus upload ulang atau membuat mekanisme copy resmi.

Jika fitur reuse dibutuhkan, tambahkan aksi **Salin versi approved ke order baru** dengan pilihan item target, pemeriksaan tenant, dan audit log. Jangan membuat file menjadi shared hanya berdasarkan `customer_id`.

### P2 — DesignJob belum dipaksa unik per order pada database

Schema memiliki relasi `Order.design_jobs` berbentuk array dan belum memiliki unique constraint untuk satu `DesignJob` per tenant/order. Kode action menggunakan `findFirst()`, sehingga duplikasi DesignJob akibat import, retry, atau manipulasi data dapat membuat queue dan approval memilih job yang tidak deterministik.

Rekomendasi: tambahkan unique constraint `@@unique([tenant_id, order_id])`, lakukan migrasi setelah membersihkan data duplikat, dan ubah query menjadi `findUnique()`.

## SOP yang direkomendasikan untuk Designer

1. Selalu cari berdasarkan **order code**, bukan hanya nama konsumen.
2. Buka detail order dan cocokkan jumlah item, ukuran, bahan, serta finishing.
3. Untuk order multi-item, upload satu file untuk satu item pada satu waktu.
4. Gunakan opsi layout gabungan hanya jika satu file benar-benar memuat semua desain item.
5. Setelah upload, lakukan ACC pada versi terbaru yang sudah siap.
6. Jika sistem masih menampilkan `pendingItems`, jangan rilis ke produksi; lengkapi item tersebut.
7. Setelah semua item approved, pastikan status order dan job produksi sudah berubah sebelum mengerjakan order konsumen berikutnya.
8. Jika konsumen meminta desain yang sama pada order baru, gunakan upload/copy resmi dan pastikan order code baru tercatat.

## Tindak lanjut implementasi (15 September 2026)

Perbaikan yang disetujui pada audit ini sudah diterapkan:

- `bounceDesignFromProduction()` sekarang menandai versi terbaru pada setiap slot item sebagai `REJECTED`, bukan hanya nomor `current_version` global. Semua job produksi pra-mulai tetap dibatalkan dalam tenant dan order yang sama.
- Dashboard Designer menampilkan progres `item approved / total item`, daftar item yang masih menunggu, serta notifikasi setelah ACC sebagian.
- Dropdown dan detail desain memakai nomor item serta identitas produk, ukuran, deskripsi, bahan, dan finishing agar item yang mirip tetap dapat dibedakan.
- Database memiliki `@@unique([tenant_id, order_id])` pada `DesignJob`; query workflow utama sudah memakai `findUnique()`.

Migrasi `20260915150000_unique_design_job_per_order` sudah diterapkan pada database lokal. Verifikasi `tsc`, lint file yang berubah, dan build webpack berhasil. Lint seluruh repository masih memiliki temuan lama di luar perubahan ini; build Turbopack juga gagal karena worker tidak diizinkan binding port pada lingkungan lokal, sehingga build webpack dipakai sebagai validasi produksi.

Fitur **Salin versi approved ke order baru** sengaja belum diaktifkan pada UI. Isolasi antar-order tetap aman; saat fitur ini dibutuhkan, implementasi harus membuat versi baru pada order tujuan dengan audit log dan status `PENDING`, bukan membagikan file berdasarkan `customer_id`.

## Putusan audit

Untuk **beberapa order terpisah dari konsumen yang sama**, isolasi data sudah benar dan setiap order harus diupload serta di-ACC secara mandiri.

Untuk **satu order dengan beberapa item**, upload per item dan gate “semua item approved” sudah berjalan. Perbaikan prioritas berikutnya adalah rekonsiliasi bounce/revisi multi-item, kemudian memperjelas identitas item dan feedback ACC sebagian.
