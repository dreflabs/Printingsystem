# Laporan Audit Workflow Designer Sales

**Tanggal audit:** 14 September 2026  
**Ruang lingkup:** alur order yang dibuat Designer, claim job, brief, upload V1/V2/V3, approval Walk-in/Makloon/Online, revisi, pembayaran Admin, completeness gate, auto-release produksi, handoff ke Operator, dan kontrol RBAC/tenant.  
**Sumber:** `02-WORKFLOW/01-CUSTOMER-DESIGNER.md`, `02-WORKFLOW/02-ORDER.md`, `02-WORKFLOW/03-DESIGN-APPROVAL.md`, `02-WORKFLOW/17-AUTO-RELEASE-PRODUKSI.md`, `03-ROLES/DESIGNER-SALES.md`, server actions, query, dan komponen Designer/New Order.

## Kesimpulan audit

Workflow Designer memiliki fondasi yang benar: order dimulai sebagai `DRAFT`, pembayaran dipisahkan ke Admin, desain disimpan sebagai versi, approval Online dibatasi Admin/Owner, dan produksi hanya menerima desain approved yang lolos completeness gate. Secara keseluruhan alur mendapat skor **6,6/10**.

Empat risiko paling serius adalah kebocoran data harga/kontak pada form order Designer, claim job yang dapat mengalami race condition, mutasi desain tanpa verifikasi PIC di server, dan revisi setelah desain sudah approved/masuk produksi tanpa rekonsiliasi status order.

## Alur yang seharusnya

1. Designer menerima kebutuhan konsumen dan membuat order `DRAFT`.
2. Sistem membuat satu `DesignJob` `PENDING` dengan Designer yang dipilih atau tanpa PIC.
3. Designer claim job secara atomik jika belum ada PIC.
4. Designer membaca brief dan spesifikasi, lalu upload V1.
5. Sistem menentukan cabang approval: Walk-in disetujui Designer dengan bukti persetujuan; Makloon otomatis `APPROVED`; Online menunggu konfirmasi Admin.
6. Jika revisi, versi terakhir ditolak dengan alasan dan Designer upload V2/V3.
7. Setelah seluruh item memiliki file approved, DesignJob menjadi `APPROVED`.
8. Order masuk `WAITING_PAYMENT` atau `CONFIRMED` bila DP sudah memenuhi; pembayaran tetap dilakukan Admin.
9. Completeness gate memeriksa DP, desain, item, material, deadline, diskon, dan mesin default.
10. Jika lolos, sistem membuat ProductionJob dan Operator mengambil job.

## Yang sudah berjalan baik

- `createPrintingOrder` membatasi pembuatan order ke Owner/Admin/Designer Sales dan mencatat `created_by` serta audit log.
- Order baru dibuat `DRAFT` dan DesignJob dibuat `PENDING`, sehingga Designer tidak langsung melewati pembayaran atau produksi.
- Designer tidak dapat menambah pembayaran melalui permission `payment.receive`; alur uang tetap berada pada Admin/Owner.
- Approval Online ditolak di server untuk Designer dan hanya Admin/Owner yang dapat mengonfirmasi.
- Makloon otomatis approved sesuai dokumen karena file dianggap berasal dari konsumen.
- Upload memvalidasi ekstensi, ukuran maksimum, namespace tenant, dan menyimpan uploader serta metadata versi.
- Approval multi-item memakai coverage check; produksi baru dapat berjalan ketika setiap item non-retail memiliki file approved.
- Completeness gate mencegah produksi ketika desain, DP, item, deadline, bahan, harga, atau mesin belum lengkap.
- Handoff ke Operator memakai production queue dan auto-release yang idempotent.
- File desain dilayani melalui route terautentikasi dan tenant-scoped, bukan URL storage mentah.

## Temuan prioritas tinggi

### P1 — Form order Designer membocorkan nomor HP dan nominal harga

`getOrderFormData()` selalu mengirim `customer.phone` (`frontend/src/actions/orders.ts:520-558`). `NewOrderModal` menampilkan nomor tersebut pada suggestion customer dan mengisi field nomor HP (`frontend/src/components/orders/NewOrderModal.tsx:141-145, 180-208`). Form yang sama juga menampilkan harga item, total order, dan diskon kepada Designer (`NewOrderModal.tsx:319-325, 380-453`).

Hal ini bertentangan dengan `03-ROLES/DESIGNER-SALES.md`, yang melarang Designer melihat nomor HP/email dan nominal harga/pembayaran.

**Dampak:** pemisahan tugas finansial dan perlindungan kontak gagal pada alur paling awal, walaupun dashboard queue sudah menyembunyikan data tersebut.

**Perbaikan:** buat payload `getOrderFormData` berbasis permission; untuk Designer kirim hanya nama customer, tipe, katalog, bahan, dan metadata kerja. Pisahkan form Designer dari form Admin/POS: sembunyikan harga, diskon, DP, dan nomor HP; server mengunci harga berdasarkan katalog.

### P1 — Claim job tidak atomik

`takeDesignJob` membaca `designer_id`, lalu melakukan `update` terpisah (`frontend/src/actions/design.ts:616-629`). Dua Designer dapat membaca nilai null secara bersamaan dan keduanya mendapat respons berhasil; update terakhir menjadi PIC sementara dua audit log claim tercatat.

**Perbaikan:** gunakan conditional `updateMany` dengan syarat `designer_id: null` dan status `PENDING`, periksa `count`, lalu kembalikan pesan bahwa job sudah diambil bila hasilnya nol. Alternatifnya, lock baris `DesignJob` dengan `FOR UPDATE`.

### P1 — Mutasi desain tidak mengunci ownership job di server

`createDesignUploadUrl`, `uploadDesignVersion`, dan `requestDesignRevision` memeriksa role dan tenant, tetapi belum memastikan Designer adalah `designJob.designer_id`. UI hanya menyembunyikan tombol untuk job milik Designer lain.

**Dampak:** Designer dapat mengunggah file atau meminta revisi pada job Designer lain melalui pemanggilan server action langsung. Ini berisiko menimpa file, mengacaukan approval, dan membuat audit trail tidak mencerminkan PIC sebenarnya.

**Perbaikan:** setelah mengambil DesignJob, izinkan Designer hanya jika `designer_id === actor.id`; job tanpa PIC hanya boleh diproses setelah claim. Admin/Owner tetap dapat melakukan override sesuai permission dan alasan yang tercatat.

### P1 — Revisi setelah approval/produksi dapat membuat state order tidak konsisten

UI menampilkan `Minta revisi` juga ketika job sudah `APPROVED` (`designer/page.tsx:163-168`). Server `requestDesignRevision` tidak memeriksa `Order.status` dan selalu mengubah DesignJob menjadi `DESIGNING` (`design.ts:406-454`). `uploadDesignVersion` juga tidak memiliki larangan eksplisit setelah ProductionJob dibuat.

**Dampak:** Designer dapat menurunkan DesignJob kembali ke `DESIGNING` tanpa membatalkan production job atau menjalankan completeness gate ulang. Operator dapat mencetak file approved lama sementara Designer membuat versi baru.

**Perbaikan:** batasi revisi Designer pada fase pra-produksi. Setelah production job dibuat, arahkan ke correction/reprint yang memerlukan Admin/Owner, membatalkan atau menandai job lama, membuat versi baru, dan menjalankan gate ulang.

### P1 — Approval Walk-in tidak mengumpulkan bukti yang diwajibkan dokumen

Dokumen meminta nama versi, catatan singkat, dan tanggal persetujuan konsumen. Tombol `ACC` memanggil `approveDesign(r.orderId, {})` tanpa dialog konfirmasi atau nama pihak yang menyetujui (`designer/page.tsx:131-136, 600-601`). Server hanya menyimpan timestamp dan approver; `approval_notes` opsional.

**Dampak:** ketika terjadi sengketa, sistem hanya dapat membuktikan siapa yang menekan ACC, bukan konteks persetujuan konsumen.

**Perbaikan:** tampilkan modal approval Walk-in dengan preview/file, nomor versi, checkbox konfirmasi lisan, nama pihak yang menyetujui, catatan, dan timestamp server. Simpan `customer_approval_name` serta `approval_channel` atau format terstruktur pada `approval_notes`.

## Temuan prioritas menengah

### P2 — `getDesignQueue` belum memiliki role guard

Query queue hanya memanggil `requireTenant()` dan `requireUser()`, lalu mengembalikan seluruh job tenant (`frontend/src/actions/queries.ts:269-309`). Middleware membatasi halaman `/designer`, tetapi server action harus tetap menolak role Operator/Gudang jika dipanggil langsung.

### P2 — Job approved masih dapat di-claim bila PIC kosong

`takeDesignJob` hanya memeriksa apakah `designer_id` sudah terisi. Tidak ada syarat status `PENDING`/`DESIGNING`, sehingga job `APPROVED` tanpa PIC dapat diambil.

### P2 — Status approval Online tidak eksplisit

Dokumen memakai `WAITING_APPROVAL`, sedangkan implementasi mempertahankan DesignJob `DESIGNING` dan hanya menaruh `PENDING` pada versi. UI menampilkan teks `Tunggu ACC Admin` di area aksi, bukan status utama. KPI, filter, dan SLA sulit membedakan “sedang dikerjakan” dari “menunggu keputusan Admin”.

### P2 — Kelengkapan kontak di dokumen tidak sama dengan completeness gate

Dokumen mensyaratkan identitas pemesan dengan nomor HP/email. `checkProductionReadiness()` hanya memeriksa `customer_id` dan nama (`frontend/src/lib/production-readiness.ts:94-99`). Order Designer tanpa kontak dapat lolos bagian identitas dan baru diketahui bermasalah di proses lain.

### P2 — Catatan Designer belum menjadi instruksi Operator

Catatan upload disimpan sebagai `approval_notes`, tetapi query job Operator hanya mengambil file approved dan nama file (`frontend/src/actions/queries.ts:71-79`). Catatan teknis seperti profil warna, bleed, dan mesin target tidak otomatis terlihat saat handoff.

### P2 — Evidence approval Online masih terlalu bebas

`approveDesign` menerima teks notes opsional. Tidak ada field wajib untuk channel, waktu konfirmasi eksternal, atau attachment screenshot chat sebagaimana workflow Online. Tambahkan format terstruktur dan validasi minimal.

### P2 — Validasi tipe order belum eksplisit di server

`APPROVAL_METHOD[input.orderType]` dapat bernilai undefined bila action dipanggil dengan payload di luar kontrak TypeScript. Server sebaiknya menolak tipe selain `walkin`, `online`, dan `makloon` sebelum membuat order.

## Audit handoff ke pembayaran dan produksi

Pemisahan tugas secara konsep sudah benar: Designer membuat order dan menangani desain, Admin menerima DP, lalu sistem menjalankan auto-release. Dua state perlu dibuat terlihat:

- Setelah approval desain, Designer harus mendapat status jelas `Menunggu Admin menerima DP`.
- Jika gate menahan produksi karena material, mesin default, kontak, atau item belum lengkap, alasan harus terlihat pada detail order yang dapat dibaca Designer dan Admin.

## Skenario penting yang harus diuji

- Dua Designer menekan `Ambil Tugas` pada job yang sama hampir bersamaan.
- Designer A mencoba upload/revisi job milik Designer B melalui server action.
- Designer mencoba upload atau revisi setelah order memiliki ProductionJob.
- Walk-in V1 ditolak, V2 diupload, lalu V2 disetujui dengan bukti persetujuan.
- Online V1 menunggu Admin, Admin meminta revisi, V2 diupload, lalu Admin approve.
- Makloon multi-item mengupload file per item dan memastikan semua item tertutup sebelum produksi.
- Designer membuat order tanpa nomor HP/email dan memeriksa apakah gate menahan order dengan alasan jelas.
- Dua upload paralel pada slot item sama tidak menghasilkan nomor versi ganda.
- User Operator/Gudang mencoba memanggil queue dan mutasi desain secara langsung.

## Roadmap perbaikan

### Gelombang 1 — keamanan dan integritas state

1. Pisahkan payload/form Designer dari Admin/POS untuk menghilangkan kontak dan nominal.
2. Terapkan role guard dan ownership guard pada semua query/mutasi desain.
3. Jadikan claim atomik dengan conditional update atau row lock.
4. Batasi revisi/upload berdasarkan fase order; gunakan correction/reprint setelah produksi dimulai.
5. Tambahkan validasi `orderType` dan kontak wajib di server.

### Gelombang 2 — bukti approval dan handoff

1. Tambahkan modal approval Walk-in dengan bukti persetujuan.
2. Tambahkan state `WAITING_APPROVAL` yang konsisten untuk Online.
3. Tampilkan catatan teknis approved pada job Operator.
4. Tampilkan alasan completeness gate pada detail Designer/Admin.

### Gelombang 3 — pengujian operasional

1. Tambahkan integration test race claim dan race upload.
2. Uji alur Walk-in, Makloon, Online, multi-item, revisi, pembatalan, dan reprint.
3. Tambahkan audit dashboard untuk order Designer yang berhenti di DRAFT/DESIGNING melewati SLA.

## Status implementasi setelah persetujuan rekomendasi

Perubahan berikut sudah diterapkan pada server action dan UI:

- Form order Designer sekarang tidak mengirim nomor kontak atau harga katalog ke UI; harga, diskon, dan DP Designer dikunci di server dan harga item dihitung dari katalog aktif.
- Claim job Designer memakai conditional update atomik, sehingga dua Designer yang menekan tombol bersamaan hanya satu yang berhasil.
- Upload, pembuatan URL upload, approval, dan permintaan revisi memverifikasi PIC Designer serta fase order. Mutasi desain ditolak setelah order masuk produksi.
- Approval Walk-in membutuhkan nama pihak yang menyetujui dan catatan bukti. Approval Online sekarang memiliki panel konfirmasi Admin dengan catatan wajib; server juga memvalidasi panjang minimum catatan agar tidak dapat dilewati melalui pemanggilan langsung.
- Queue desain memiliki role guard; job approved tidak dapat di-claim ulang.
- Completeness gate kini menahan order PRINTING tanpa kontak pemesan.
- Catatan approval/desain dari versi approved ikut diteruskan ke kartu job Operator.
- Validasi tipe order dilakukan secara eksplisit sebelum order dibuat.

Validasi yang dijalankan: `npx tsc --noEmit --pretty false`, `npx prisma validate`, dan `git diff --check` berhasil. Migrasi default versi desain tetap perlu dijalankan pada database PostgreSQL tenant saat service database tersedia; percobaan sebelumnya tertahan karena `localhost:5432` belum aktif.

## Kesimpulan

Workflow Designer sekarang memiliki separation of duties dan kontrol state yang lebih konsisten antara UI, server action, dan dokumen. Area lanjutan yang tetap disarankan adalah pengujian integrasi race condition, format evidence Online yang terstruktur/berlampiran, dan metrik SLA untuk job yang tertahan.
