# Audit Alur User Gudang dan Implementasi Warehouse

**Tanggal audit:** 15 September 2026  
**Ruang lingkup:** role Gudang, navigasi, absensi, material, QC, finishing,
storage, counter, audit trail, validasi server, concurrency, dan kesesuaian
dokumen dengan implementasi.  
**Status:** audit baseline dan implementasi bertahap; Stage 1 dan sebagian Stage 2
sudah diterapkan di working tree. Migrasi database masih menunggu PostgreSQL aktif.

## Kesimpulan eksekutif

Print Pilot sudah memiliki fondasi alur Gudang yang benar:

```
Produksi selesai
  → QC oleh Gudang
  → Finishing dan cetak label
  → Simpan ke lokasi storage
  → Pindah ke counter bila diperlukan
  → Admin menyerahkan ke konsumen
```

Role Gudang yang menggabungkan QC, Finishing, dan Storage cocok untuk
percetakan kecil sampai menengah. Permission mutasi utama juga sudah dipisah:
`qc.submit`, `finishing.execute`, `storage.store`,
`storage.move_to_counter`, dan `storage.report_incident`.

Alur ini belum siap disebut profesional penuh karena ada empat risiko utama:

1. **Stok masuk belum memiliki workflow penerimaan barang yang nyata.** UI hanya
   mengubah Stok Aktual melalui `adjustMaterialStock`; selisih positif kebetulan
   dicatat sebagai `IN`, sehingga pembelian dan stock opname tercampur.
2. **Beberapa query baca Gudang belum memiliki guard permission server-side.**
   Query antrian, riwayat QC, peta storage, dan pencarian storage hanya memakai
   `requireUser()`. Beberapa query juga membawa object customer penuh,
   padahal Gudang tidak boleh melihat nomor telepon/email.
3. **QC, mulai finishing, dan penyimpanan belum seluruhnya atomik/idempotent.**
   Dua petugas dapat memproses job sama pada waktu hampir bersamaan dan membuat
   catatan atau job aktif ganda.
4. **Aturan absensi belum menjadi precondition pekerjaan.** Dokumen mewajibkan
   Operator absen sebelum mengambil job, tetapi `startProduction()` belum
   memeriksa check-in. Aksi Gudang juga tidak memeriksa check-in.

Penilaian audit: **fondasi operasional 7/10; kontrol data dan otorisasi 5,5/10;
kesiapan multi-petugas 5/10**. Nilai ini adalah ringkasan risiko dari audit
kode dan dokumen, bukan benchmark eksternal.

## Tahap audit dan sumber

Audit dilakukan bertahap:

1. Model role dan navigasi: `03-ROLES/GUDANG.md`, `ADMIN.md`,
   `OPERATOR.md`, `OWNER.md`, permission catalog, nav config, middleware.
2. Material: `04-MODULES/MATERIAL-INVENTORY.md`,
   `02-WORKFLOW/06-MATERIAL.md`, `MaterialTab.tsx`, dan action material.
3. QC, finishing, storage: workflow 07–09, action production/storage, dan tiga
   tab dashboard Gudang.
4. Absensi: workflow 18, `clock.ts`, policy eligibility, dan `AbsenCard`.
5. Integritas data: Prisma schema, transaction boundary, row lock,
   compare-and-set, dan test yang tersedia.

Verifikasi teknis:

- `npx tsc --noEmit` — lulus.
- `npx prisma validate` — lulus.
- Belum ada test concurrency untuk QC, finishing, storage, atau penerimaan stok.

## Alur yang berjalan sekarang

### 1. Dashboard dan absensi

Role Gudang diarahkan ke `/finishing`. Sidebar menampilkan **Finishing & QC**
dan **Absensi Saya**. Halaman memuat RoleGuide dan AbsenCard.

`requireAttendanceEligible()` sudah memeriksa tenant, akun aktif,
`attendance_eligible`, dan permission `attendance.self`. Waktu berasal dari
server, selfie/lokasi mengikuti kebijakan tenant, dan unique index melindungi
satu record per user per hari.

Masalahnya, absensi belum menjadi gerbang semua pekerjaan. Role docs menyebut
Gudang wajib absen masuk, istirahat, dan pulang, tetapi
`submitQC()`, `startFinishing()`, `finishFinishing()`, dan
`assignStorageLocation()` tidak memeriksa check-in.

### 2. QC

`QCTab` membaca `getGudangQueues()` dan menampilkan
`PRODUCTION_COMPLETE`. Gudang mengisi checklist jumlah, ukuran, warna,
kualitas cetak, defect fisik, dan finishing. PASS menjadi `QC_PASSED`; FAIL
mewajibkan kategori dan catatan minimal 20 karakter, lalu menjadi
`FAILED_REWORK` dan order `QC_REWORK_PENDING`.

`decideRework()` dibatasi Owner. Bukti QC dicatat di `QcRecord` dan aksi
penting masuk audit log.

Gap:

- Server belum memastikan semua checklist wajib terisi.
- Server belum menolak PASS dengan nilai MAJOR; aturan ini hanya di UI.
- Modal QC tidak menampilkan spesifikasi produk, ukuran, bahan, finishing, atau
  versi desain approved yang diperlukan untuk pemeriksaan.
- `getQCHistory()` mengikutkan `customer: true`, sehingga data kontak yang
  dilarang untuk Gudang dapat ikut terkirim ke browser.
- Tidak ada claim/lock QC; dua Gudang dapat membuat dua catatan untuk tahap sama.

### 3. Finishing

`FinishingTab` menampilkan queue `QC_PASSED`, job aktif
`FINISHING_STARTED`, dan job `FINISHING_COMPLETE` yang siap storage.
Permission `finishing.execute` sudah dipakai untuk mutasi.

Gap:

- `startFinishing()` membaca status lalu membuat `FinishingJob` tanpa
  compare-and-set atau unique guard untuk satu finishing aktif. Dua request
  dapat membuat dua job aktif.
- `finishFinishing()` hanya memeriksa actual quantity lebih dari nol; belum
  membatasi hasil agar tidak melebihi hasil produksi/rencana.
- Queue tidak menampilkan ringkasan instruksi laminasi, potong, jahit, atau mata
  ayam sebelum Gudang menekan mulai.

### 4. Storage dan counter

`StorageTab` menyediakan peta lokasi, kapasitas, pencarian job/order, dan
pengelolaan lokasi untuk Owner/Admin. Gudang menyimpan job melalui scan QR.
`assignStorageLocation()` memvalidasi `FINISHING_COMPLETE`, lokasi aktif,
kapasitas, dan mengubah job menjadi `STORED`. Order multi-item baru menjadi
`READY_FOR_PICKUP` setelah semua job live tersimpan.

`confirmItemAtCounter()` memindahkan item menjadi `IN_TRANSIT`; Admin
melakukan release final dan pemeriksaan pembayaran.

Gap:

- Storage item aktif belum dikunci per job dan belum memiliki unique constraint.
  Dua request dapat membuat job tersimpan di dua lokasi.
- SCAN 9 tetap dapat berjalan tanpa lokasi counter aktif; `transit_location_id`
  dapat menjadi null, padahal dokumen mensyaratkan lokasi terdaftar.
- Incident sudah dapat dilaporkan, tetapi belum ada workflow resolusi formal
  dari `INCIDENT` ke status akhir.
- Query peta dan pencarian storage mengikutkan customer penuh.

### 5. Material dan stok bahan

Lokasi input saat ini adalah **Finishing & Gudang → Material**. Gudang dapat
menambah material dan mengubah Stok Aktual. Server mengunci baris material
sebelum menghitung selisih dan membuat `MaterialMovement`.

Pemakaian produksi lebih terstruktur: Operator mengirim bahan dan waste saat
menyelesaikan job. Sistem memvalidasi bahan terhadap rencana job dan mesin,
mengonversi satuan, mengurangi stok atomik, dan mencatat `OUT`/`WASTE`
dengan Job ID.

Gap:

- Tidak ada action/UI khusus **Stok Masuk**. `adjustMaterialStock()` menerima
  total stok baru; selisih positif dicatat `IN`, sehingga pembelian, opening
  balance, dan opname tercampur.
- UI hanya meminta alasan. Supplier, tanggal terima, nomor dokumen, dan harga
  beli tidak diisi walaupun kolom supplier/unit cost tersedia di model.
- `createMaterial()` dapat mengisi `current_stock` awal tanpa movement
  opening balance.
- `adjustMaterialStock()` tidak menolak `newStock < 0`.
- Tabel Material datar dan filter utamanya `group_name`; dokumentasi menyebut
  stok dikelompokkan per mesin, tetapi relasi mesin hanya terlihat saat edit.
- `getMaterials()` tidak memakai guard permission khusus dan mengembalikan
  seluruh material tenant.

## Matriks role

| Kemampuan | Gudang | Admin | Owner | Operator | Status |
|---|---:|---:|---:|---:|---|
| Absen pribadi | Ya, jika eligible | Opsional | Ya, jika eligible | Ya, jika eligible | Guard ada, precondition kerja belum |
| Melihat queue QC | Ya | Ya melalui permission | Ya | Tidak | Query belum guard server-side |
| Submit QC | Ya | Ya melalui permission | Ya | Tidak | Konflik dengan dokumen Admin |
| Mulai/selesai finishing | Ya | Tidak | Ya | Tidak | Mutation guard sudah ada |
| Simpan ke storage | Ya | Tidak | Ya | Tidak | Capacity update ada |
| Kelola lokasi storage | Tidak | Ya | Ya | Tidak | Sesuai desain |
| Pindah ke counter | Ya | Tidak | Ya | Tidak | Counter aktif belum diwajibkan |
| Input stok masuk | Lewat adjustment | Tidak pada kode | Ya | Tidak | Receipt khusus belum ada |
| Stock adjustment | Ya pada kode | Tidak pada kode | Ya | Tidak | Konflik dengan dokumen |
| Lihat kontak konsumen | Seharusnya tidak | Ya | Ya | Tidak | Payload storage/QC terlalu luas |
| Pickup final | Tidak | Ya | Ya | Tidak | Sesuai separation of duties |

## Temuan prioritas

### P1 — Penerimaan stok masuk belum terpisah

Bukti: `MaterialTab.tsx` memakai `StockAdjuster`; action yang tersedia adalah
`adjustMaterialStock()` pada `master-data.ts:604-648`.

Dokumen mendeskripsikan input jumlah diterima, supplier, tanggal, dan harga beli,
tetapi route/action tersebut belum ada.

Dampak: laporan pembelian, audit supplier, saldo awal, dan stock opname tidak
terpisah.

Rekomendasi: buat permission `material.receive` dan
`receiveMaterialStock()` dengan row lock, jumlah masuk, satuan, supplier,
tanggal terima, invoice/surat jalan, harga beli, dan catatan. Action melakukan
stok lama + jumlah masuk dan membuat movement `IN`.

### P1 — Query Gudang belum konsisten diberi guard dan membocorkan data customer

Bukti:

- `queries.ts:255-259`: `getGudangQueues()` hanya `requireUser()`.
- `production.ts:779-790`: `getQCHistory()` hanya `requireUser()` dan
  mengikutkan customer penuh.
- `storage.ts:544-590`: peta dan pencarian storage hanya `requireUser()`
  dan mengikutkan customer penuh.

Middleware pembatas halaman bukan pengganti authorization server-side.

Rekomendasi: gunakan `can()`/permission read khusus pada setiap query.
Gunakan select minimal untuk Gudang, misalnya customer id dan name saja.
Query Admin/Owner harus terpisah bila membutuhkan kontak.

### P1 — QC, finishing, dan storage belum aman untuk dua petugas bersamaan

Bukti: QC membaca status lalu membuat record; finishing membaca status lalu
membuat job; storage memeriksa item lalu membuat item baru. Tidak ada
compare-and-set menyeluruh dan tidak ada constraint satu storage aktif per job.

Dampak: job dapat diperiksa dua kali, finishing dimulai dua kali, atau disimpan
di dua lokasi.

Rekomendasi:

1. Gunakan atomic update dengan status asal eksplisit.
2. Tambahkan unique partial index/constraint untuk FinishingJob aktif dan
   StorageItem aktif per job, atau lock job di transaction.
3. Perlakukan retry jaringan sebagai idempotent.
4. Tampilkan claimed_by, waktu claim, dan tombol release claim berwenang.

### P1 — Kewajiban absensi belum menjadi gerbang kerja

`03-ROLES/OPERATOR.md` mewajibkan absen sebelum mengambil job, tetapi
`startProduction()` tidak memanggil guard check-in. Aksi Gudang juga tidak
memeriksa check-in walau role Gudang wajib absen.

Rekomendasi: buat `requireCheckedInForWork()` dan pakai pada
`startProduction()` serta aksi kerja Gudang sesuai kebijakan tenant. Sediakan
override Owner/Admin yang selalu tercatat untuk kondisi darurat.

### P1 — Counter kosong masih dianggap valid

`confirmItemAtCounter()` mencari counter secara opsional dan tetap menyimpan
`transit_location_id: null` bila tidak ditemukan.

Rekomendasi: tolak SCAN 9 jika tidak ada satu lokasi aktif dengan
`zone=COUNTER\), dan validasi kapasitas counter secara atomik.

### P2 — Validasi QC hanya kuat di UI

Server hanya mewajibkan catatan/kategori untuk FAIL. Request manual dapat
memasukkan PASS dengan checklist kosong atau MAJOR.

Rekomendasi: validasi daftar checklist wajib dan aturan PASS/MAJOR di server.
Simpan checklist sebagai JSON terstruktur tervalidasi.

### P2 — Dokumen role dan permission tidak sinkron

1. `02-WORKFLOW/06-MATERIAL.md` menyebut Admin, Gudang, Owner boleh Stok
   Masuk, sedangkan `04-MODULES/MATERIAL-INVENTORY.md` menyebut Admin tidak.
2. Adjustment didokumentasikan Admin/Owner, tetapi kode memberi Owner/Gudang.
3. Admin didokumentasikan hanya melihat hasil QC, tetapi permission actual
   memberi Admin `qc.submit`.

Rekomendasi kebijakan: Gudang menerima barang dan mengerjakan QC/finishing/
storage; Owner mengawasi dan override; Admin mengelola order, produksi,
storage setup, dan laporan. Admin tidak submit QC atau adjustment bahan kecuali
permission eksplisit diaktifkan sebagai pengecualian tenant.

### P2 — Finishing belum mengikat jumlah dan instruksi produksi

`finishFinishing()` hanya memeriksa actual quantity > 0. Tambahkan batas
actual_qty terhadap hasil produksi dan tampilkan produk, ukuran, material,
finishing, serta catatan approved sebelum mulai.

### P2 — Incident storage replacement/cancellation belum membuka job pengganti

Resolusi incident sudah tersedia untuk `RESOLVED`, `REPLACEMENT_REQUIRED`, dan
`CANCELLED`, lengkap dengan catatan, waktu, petugas, dan audit log. Namun
keputusan replacement/cancellation belum otomatis membuat job pengganti atau
menjalankan keputusan order; pickup tetap diblokir sampai Admin/Owner menutup
keputusan tersebut.

### P2 — Opening balance dan history material belum cukup audit-able

Material baru dapat memiliki saldo awal tanpa movement. Tambahkan
`OPENING_BALANCE` atau receipt awal eksplisit, serta halaman history berdasarkan
material, movement type, supplier, user, dan periode.

### P3 — Kesenjangan pengalaman dan test

- Tidak ada menu sidebar Inventori/Gudang khusus; fungsi bercampur di
  Finishing & QC.
- Material belum benar-benar dikelompokkan per mesin di tabel utama.
- Tidak ada test concurrency untuk QC, finishing, storage, atau receipt.
- `startBreak()` tidak memanggil `requireAttendanceEligible()` sendiri;
  action terpisah perlu diperketat.

## Rekomendasi bertahap

### Tahap 1 — Wajib sebelum tim Gudang lebih dari satu orang

1. Tambahkan menu dan action **Stok Masuk**.
2. Pisahkan `material.receive` dari `material.adjust`.
3. Tambahkan guard server-side pada semua query Gudang.
4. Hilangkan phone/email/address dari payload Gudang.
5. Buat transisi QC, finishing, dan storage atomik/idempotent.
6. Wajibkan lokasi counter aktif sebelum SCAN 9.
7. Tegakkan check-in sebelum Operator mengambil job.
8. Tegakkan checklist QC pada server.

### Tahap 2 — Perbaikan operasional

1. Tampilkan detail order dan instruksi finishing pada queue.
2. Tambahkan claim/assignment QC dan finishing saat jumlah petugas bertambah.
3. Sediakan history material dan laporan pembelian, pemakaian, waste,
   adjustment, dan stok minimum.
4. Tambahkan resolusi incident serta notifikasi Owner/Admin.
5. Tambahkan test matrix untuk role, multi-role, tenant berbeda, akun nonaktif,
   retry, dan dua petugas bersamaan.

### Tahap 3 — Skala lebih besar

1. Shift dan area kerja Gudang.
2. Penugasan QC/finishing per petugas atau stasiun.
3. Multi-outlet dan scope lokasi.
4. Stock opname terjadwal dengan approval dan dual control.
5. Supplier, purchase order, penerimaan parsial, dan pencocokan invoice.

## Putusan audit

Alur Gudang **benar secara konsep dan dapat dipakai untuk demo atau operasi
sederhana dengan satu orang yang merangkap**. Untuk operasi profesional dengan
dua atau lebih petugas Gudang, perbaikan Tahap 1 harus dilakukan terlebih dahulu.
Risiko terbesar ada pada pencampuran stok masuk dengan adjustment, query server
yang terlalu longgar, dan ketiadaan lock/idempotency pada QC–finishing–storage.

## Status implementasi rekomendasi

Audit ini menjadi baseline sebelum perbaikan. Tahap 1 sudah diimplementasikan
di working tree dengan perubahan berikut:

- `material.receive` dipisahkan dari `material.adjust`. Gudang/Owner mencatat
  barang masuk sebagai delta positif dengan supplier, tanggal terima, nomor
  referensi, harga beli, dan movement `IN`; hanya Owner yang dapat melakukan
  adjustment opname.
- Query Gudang diberi guard permission server-side dan payload customer dibatasi
  ke nama yang diperlukan untuk antrean kerja.
- QC, finishing, dan storage memakai compare-and-set/row lock agar retry atau
  dua petugas bersamaan tidak membuat proses ganda.
- Check-in diwajibkan untuk Operator dan Gudang sebelum menjalankan pekerjaan;
  lokasi counter aktif diwajibkan sebelum barang dipindahkan ke counter.
- Checklist QC divalidasi di server dan hasil PASS ditolak jika ada temuan
  `MAJOR`; job finishing membatasi kuantitas aktual terhadap hasil produksi.
- Dashboard Gudang menampilkan menu `Material & Stok`, tombol `Stok Masuk`,
  dan mode read-only untuk role yang tidak berwenang melakukan adjustment.
- Migrasi `20260915200000_warehouse_workflow_integrity` menambahkan metadata
  receipt dan unique partial index untuk mencegah sesi finishing/storage aktif
  ganda.

Validasi yang sudah dijalankan: `npx tsc --noEmit`, lint target perubahan,
dan `npx next build --webpack` berhasil. `npx next build` default (Turbopack)
gagal karena worker lokal tidak diizinkan membuka port oleh lingkungan OS;
Webpack berhasil menyelesaikan compile, TypeScript, static generation, dan
optimasi route. Migrasi database belum dapat diterapkan pada sesi audit ini
karena PostgreSQL lokal tidak merespons; jalankan `npx prisma migrate deploy`
setelah database aktif.

### Tahap 2 — implementasi awal

Bagian pertama Tahap 2 sudah dikerjakan:

- Job QC dan Finishing memiliki assignee dan waktu klaim pada `ProductionJob`.
- Action `claimQCJob()` dan `claimFinishingJob()` memakai update atomik; dua
  petugas tidak dapat mengambil job yang sama.
- Submit QC dan mulai/selesai Finishing memvalidasi assignee, sehingga petugas
  lain tidak dapat menimpa pekerjaan yang sedang dipegang.
- Antrean Gudang menampilkan mesin, produk, ukuran, material, finishing, file
  desain approved, status petugas, dan deadline.
- Material memiliki riwayat 200 pergerakan terakhir dengan saldo sebelum/sesudah,
  jenis transaksi, referensi, supplier, petugas, mesin, job, dan order.
- Migrasi `20260915210000_gudang_task_assignment` menambahkan assignee QC dan
  Finishing beserta waktu klaim dan index antreannya.
- Incident storage kini memiliki daftar Owner/Admin dan keputusan tercatat;
  `RESOLVED` membuka kembali item ke `STORED`, sedangkan penggantian atau
  pembatalan tetap diblokir sampai tindakan lanjutan.
- Migrasi `20260915220000_storage_incident_resolution` menyimpan keputusan,
  catatan, waktu, dan petugas penyelesaian incident.
- Stock opname terkontrol sudah tersedia: snapshot saldo, input hitung fisik,
  submit, dan approval Owner yang menolak perubahan saldo selama opname.
- Migrasi `20260915230000_material_stocktake` menambahkan sesi opname dan item
  snapshot dengan audit pengguna serta status `DRAFT/SUBMITTED/APPROVED`.
- Dokumentasi QC, Finishing, QR Scan, dan Production sudah menjelaskan klaim
  atomik dan tanggung jawab petugas.

Tahap 2 berikutnya yang belum dikerjakan adalah test matrix concurrency lintas
role, approval/cancellation PO untuk dual control, dan alur
replacement/cancellation sampai job pengganti.

Implementasi alert pada `operational-alerts.ts` membuat alert untuk stok minimum,
incident storage, deadline 24 jam, dan job stagnan. Panel tampil di dashboard
Owner dan Gudang melalui `OperationalAlerts.tsx`; Admin/Owner dapat mengakui
alert. Migrasi `20260916000000_operational_alerts` menambah tabel dan index
deduplikasi.

Supplier dan Purchase Order juga sudah tersedia pada tab **Pembelian**. Admin/
Owner dapat membuat supplier dan PO; Gudang/Owner dapat menerima item secara
parsial. Setiap penerimaan memakai lock transaksi, tidak boleh melebihi sisa
PO, memperbarui status `PARTIAL/RECEIVED`, dan membuat movement `IN` yang
terhubung ke supplier, PO, dan item PO. Migrasi
`20260916010000_purchase_orders` menambahkan tabel Supplier, PurchaseOrder,
PurchaseOrderItem, dan relasi ke MaterialMovement.
