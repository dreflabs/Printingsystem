# Laporan Audit Alur Order Admin → Designer

**Tanggal audit:** 15 September 2026  
**Ruang lingkup:** order cetak (`PRINTING`) yang dibuat Admin atau Designer Sales, pembuatan brief, penetapan PIC, upload dan approval desain, pembayaran DP, completeness gate, serta handoff sampai siap masuk produksi.  
**Metode:** pembacaan dokumen workflow dan role, review server action/query, review komponen order/designer, pemeriksaan schema Prisma, dan validasi TypeScript/Prisma/build.

## Kesimpulan eksekutif

Alur utama sudah terbentuk dan secara konsep sudah profesional: semua order dimulai sebagai `DRAFT`, setiap order memiliki satu `DesignJob`, Designer tidak menerima pembayaran, approval Online dilakukan Admin/Owner, dan produksi hanya dibuat setelah desain serta kelengkapan order lolos gate. Kontrol tenant, claim job, PIC Designer, upload file, dan routing mesin juga sudah lebih kuat setelah perubahan sebelumnya.

Penilaian saat ini **7,2/10**. Sistem sudah layak untuk uji operasi terkontrol, tetapi belum layak dianggap final untuk data produksi multi-tenant tanpa menutup temuan P1 berikut:

1. `createPrintingOrder()` masih menerima referensi produk, bahan, dan Designer dari client tanpa semua validasi tenant/status/role yang diperlukan. Ini dapat menghasilkan relasi lintas tenant atau data order yang tidak sah bila server action dipanggil langsung.
2. `approveDesign()` menganggap semua versi terbaru selain `APPROVED` sebagai target. Versi `REJECTED` dapat di-ACC kembali tanpa upload file baru, terutama pada order multi-item.
3. Versi approved lama tetap berstatus `APPROVED` setelah revisi. Beberapa query operasional masih dapat mengembalikan lebih dari satu file approved pada slot yang sama sehingga Operator dapat salah memilih file.
4. `addPayment()` dan `decideDiscount()` tidak menolak semua status terminal/produksi. Pembayaran atau perubahan nilai dapat dicatat setelah order dibatalkan, ditutup, atau sudah berjalan.
5. Dokumen menyatakan order DRAFT/pre-produksi dapat diedit, tetapi tidak ditemukan server action `updateOrder` atau UI edit order. Setelah salah input, jalur perbaikannya belum jelas.

Temuan P2 terutama berada pada penetapan PIC yang belum tersedia di form order, konsistensi multi-role di UI, query Designer yang hanya mengenali role utama pada daftar Designer, dan istilah/status dokumen yang masih belum seragam.

## Alur target yang diaudit

```text
Admin/Designer Sales
        │
        ▼
Order DRAFT + OrderItem + satu DesignJob PENDING
        │
        ├─ Designer claim / menerima PIC
        │
        ▼
Upload V1 per item atau file seluruh order
        │
        ├─ Walk-in  → Designer mencatat persetujuan konsumen
        ├─ Online   → Admin memeriksa dan menyetujui
        └─ Makloon  → file konsumen auto-approved
        │
        ▼
Semua item non-retail tertutup file APPROVED
        │
        ▼
WAITING_PAYMENT atau CONFIRMED bila DP sudah memenuhi
        │
        ▼
Completeness Gate: DP, kontak, deadline, item, bahan, harga,
                   diskon, file, dan mesin default
        │
        ├─ Lolos → ProductionJob per mesin → Operator
        └─ Tertahan → alasan tampil ke Admin; rilis/manual assignment
```

## Hasil audit per tahap

### 1. Pembuatan order oleh Admin

`createPrintingOrder()` mewajibkan tenant, actor aktif, permission `order.create`, tipe order yang sah, minimal satu item, dan deadline. Order dibuat sebagai `DRAFT`, total dan DP dihitung, item disimpan, lalu satu `DesignJob` dibuat (`frontend/src/actions/orders.ts:87-257`). Ini sesuai dokumen.

Masalahnya berada pada data referensi yang datang dari client:

- Untuk Admin/Owner, `productId`, `materialId`, dan `unitPrice` tidak seluruhnya diverifikasi terhadap tenant aktif dan katalog yang sah. Jalur Designer memang memeriksa produk aktif tenant, tetapi jalur Admin menggunakan nilai client secara langsung (`orders.ts:174-195`, `230-243`).
- `designerId` langsung disalin ke `Order` dan `DesignJob` (`orders.ts:201-256`). Server belum memastikan user tersebut berada pada tenant yang sama, aktif, dan memiliki role `designer_sales` melalui role utama atau `extra_roles`.
- Schema memakai FK ID umum, bukan composite FK dengan `tenant_id`; karena itu filter tenant pada UI tidak cukup sebagai kontrol keamanan.

**Risiko:** pemanggilan server action langsung dapat menautkan order tenant A ke produk/bahan/user tenant B, atau menautkan order ke akun yang bukan Designer. Pada produk dengan `default_machine_id`, relasi lintas tenant juga dapat memengaruhi routing produksi.

**Prioritas: P1.** Server harus memuat semua produk, bahan, dan Designer berdasarkan `{id, tenant_id, active}`; memvalidasi material relevan dengan produk; dan menolak `designerId` yang bukan Designer aktif tenant tersebut. Untuk Admin, tetapkan apakah harga manual memang diizinkan. Bila `quote.edit_price` hanya milik Owner, server harus menolak harga bebas dari Admin; bila Admin memang boleh, permission dan dokumen harus diselaraskan.

### 2. Pembuatan order oleh Designer Sales

Designer menggunakan modal yang sama, tetapi server memaksa harga katalog aktif dan DP 50%, meniadakan diskon, dan tidak memberi akses pembayaran. Kontak pelanggan baru dapat diisi sebagai write-only; daftar customer tidak mengembalikan nomor telepon untuk Designer (`getOrderFormData()` mengembalikan `phone: null` bila tidak punya `customer.view_contact`). Ini sesuai separation of duties.

Namun, komponen masih membaca hanya `r.user.role`, bukan array `r.user.roles` (`NewOrderModal.tsx:493-496`). Pada user multi-role yang role utamanya `designer_sales` tetapi memiliki role Admin/Owner tambahan, server akan memakai hak gabungan sementara UI tetap menampilkan pembatasan Designer. Ini dapat membuat pilihan DP/harga dan perilaku submit berbeda dari izin server.

**Prioritas: P2.** UI harus memakai permission/roles efektif, atau menerima `canEditPrice`, `canReceivePayment`, dan `isDesignerRestricted` dari server agar tampilan dan server memakai sumber aturan yang sama.

### 3. Penetapan Designer/PIC

Jika `designerId` tidak dikirim, job masuk antrean dan Designer mengambilnya melalui `takeDesignJob()`. Claim sekarang menggunakan update bersyarat (`designer_id: null`, status `PENDING`/`DESIGNING`) sehingga dua Designer tidak dapat menang bersamaan. Upload, URL upload, approval, dan revisi sudah memeriksa PIC di server; ini adalah kontrol yang baik.

Form order baru tidak menampilkan pilihan Designer walaupun `getOrderFormData()` mengembalikan daftar `designers` (`orders.ts:549-569`). Komponen `NewOrderModal` tidak pernah mengirim `designerId`. Akibatnya, alur “Admin menetapkan Designer tertentu saat membuat order” belum tersedia dari UI; semua order praktis masuk antrean claim.

**Prioritas: P2.** Pilih salah satu keputusan produk dan dokumentasikan:

- mode antrean: hapus field `designerId` dari kontrak jika penetapan manual memang tidak dibutuhkan; atau
- mode assignment: tambahkan field PIC Designer pada form Admin, tampilkan Designer aktif dari role utama maupun `extra_roles`, dan validasi server.

### 4. Upload desain dan coverage multi-item

Designer memilih item target saat upload. Deret `version_no` dialokasikan per slot item dan dikunci pada baris `DesignJob`, sedangkan object key memakai UUID. `DesignJob` hanya berubah `APPROVED` bila semua item non-retail tertutup. Ini mendukung order combo dan mencegah nomor versi ganda.

Kelemahan integritas versi berada pada approval/revisi:

- `requestDesignRevision()` menandai versi terbaru sebagai `REJECTED`, tetapi versi approved sebelumnya tetap `APPROVED` (`design.ts:546-568`).
- `approveDesign()` memilih semua versi terbaru yang bukan `APPROVED`; artinya `REJECTED` juga menjadi target (`design.ts:429-434`). Pada order dengan item A `REJECTED` dan item B `PENDING`, klik ACC tanpa `itemId` dapat meng-ACC keduanya, termasuk file A yang baru saja ditolak.
- `designCoverage()` dan `coveredDesignItemIds()` menghitung setiap versi approved, bukan hanya versi terbaru per slot. Setelah revisi, file lama tetap memenuhi coverage walaupun file baru belum ada.
- Query scan produksi mengurutkan versi approved, tetapi `getScanContext()` tidak menerapkan pemilihan versi terbaru per slot seperti `getOperatorJobs()`. Akibatnya file lama dan baru dapat sama-sama tampil.

**Dampak:** approval dapat terjadi tanpa file revisi, gate dapat menganggap item sudah lengkap memakai file lama, dan Operator berpotensi memilih file yang salah.

**Prioritas: P1.** Ubah status versi lama menjadi `SUPERSEDED` atau `REJECTED` secara eksplisit saat revisi; target approval hanya `PENDING`; hitung coverage dari versi terbaru per slot; dan gunakan helper yang sama untuk dashboard Designer, Operator, Scan, dan auto-release. Tambahkan unique/index dan integration test untuk skenario “V1 approved → minta revisi → belum upload V2”.

### 5. Approval berdasarkan tipe order

Cabang approval server sudah tepat secara umum:

- `WALK_IN`: Designer PIC atau Admin/Owner dapat approve dengan catatan bukti.
- `ONLINE`: hanya Admin/Owner yang boleh approve; catatan wajib minimal.
- `MAKLOON`: file langsung approved saat upload.

Approval Walk-in di UI sudah meminta nama konsumen dan catatan. Pembatasan PIC dan status order juga ada. Perbaikan yang masih perlu adalah memastikan versi `REJECTED` tidak bisa di-ACC kembali seperti temuan di atas.

Istilah dokumen belum 100% konsisten: beberapa dokumen lama menyebut `WHATSAPP` atau `WAITING_APPROVAL`, sedangkan implementasi menggunakan `ONLINE` dan status DesignJob `DESIGNING` + versi `PENDING`. Ini bukan celah akses, tetapi dapat membuat laporan dan training staf keliru.

**Prioritas: P2.** Bekukan kamus status/approval method dalam satu dokumen canonical dan gunakan label operasional Indonesia di UI.

### 6. Pembayaran dan perubahan nilai order

`addPayment()` membatasi actor ke permission `payment.receive`, tenant, dan nominal positif. Setelah pembayaran, sistem menghitung ulang paid/balance dan memanggil auto-release bila desain approved. Urutan “DP dahulu atau desain dahulu” umumnya didukung.

Dua guard status masih kurang:

- Payment dibuat setelah hanya memeriksa order ada (`orders.ts:320-337`). Tidak ada penolakan eksplisit untuk `CANCELLED`, `CLOSED`, `FINAL_AUDIT_COMPLETE`, atau `PICKED_UP`. Walaupun status tidak selalu dipromosikan, payment confirmed tetap masuk ke ledger order terminal.
- `decideDiscount()` hanya memeriksa diskon belum diputuskan (`orders.ts:422-426`). Owner dapat mengubah total, DP required, dan balance setelah order sudah produksi/closed bila action dipanggil langsung.

**Prioritas: P1.** Kunci transaksi pembayaran ke status yang menerima uang (misalnya `DRAFT`, `DESIGNING`, `WAITING_PAYMENT`, `CONFIRMED` sesuai kebijakan), tolak order terminal, dan kunci keputusan diskon sebelum job produksi dibuat. Perubahan nilai setelah produksi harus lewat correction/financial approval.

### 7. Completeness gate dan handoff menuju Operator

`checkProductionReadiness()` memeriksa DP, DesignJob approved, file, diskon, identitas/kontak, deadline, isi item, bahan, harga, ukuran, dan mesin. `autoReleaseToProduction()` mengunci baris order, membuat job per mesin, mem-pin default operator bila aktif dan punya `UserMachine`, atau menaruh job di queue. Manual assignment juga sudah memvalidasi gate, role Operator aktif, grant mesin, dan status mesin.

Ini adalah bagian terkuat dari workflow saat ini. Dua hardening masih disarankan:

- `autoReleaseToProduction()` menghitung existing job dengan `where: { order_id: orderId }` tanpa `tenant_id`, dan beberapa relasi coverage mengandalkan ID global. UUID membuat tabrakan praktis kecil, tetapi semua query mutasi produksi sebaiknya konsisten tenant-scoped.
- Job per mesin menggabungkan quantity beberapa item. Operator harus selalu menerima daftar item dan file terbaru per slot; masalah versi di tahap sebelumnya langsung berdampak pada pekerjaan cetak.

**Prioritas: P2 untuk tenant-scope hardening; P1 untuk pemilihan file terbaru.**

### 8. Edit order dan koreksi sebelum produksi

Dokumen `02-WORKFLOW/02-ORDER.md` menyatakan DRAFT dapat diedit Admin/Designer dan status DESIGNING/WAITING_APPROVAL dapat diedit terbatas oleh Admin. Review source tidak menemukan server action `updateOrder`, `updateOrderItems`, atau UI edit order. Yang tersedia adalah create, payment, diskon, cancel, design, dan production assignment.

**Dampak:** salah produk, material, ukuran, deadline, atau customer setelah order dibuat tidak memiliki jalur koreksi normal. Staf cenderung membuat order baru atau mengubah data langsung, sehingga audit trail dan pembayaran dapat terpecah.

**Prioritas: P1 untuk kelengkapan bisnis.** Implementasikan `updateOrder` dengan state machine eksplisit:

- `DRAFT`: Admin/Designer boleh memperbaiki field sesuai permission.
- `DESIGNING`/`WAITING_PAYMENT`: Admin boleh memperbaiki field non-finansial; perubahan harga/DP/disc harus audit dan re-hitung.
- Setelah `CONFIRMED` atau ada ProductionJob: gunakan correction/reprint, bukan edit langsung.

## Matriks otorisasi yang terverifikasi

- **Admin/Owner:** membuat order, mencatat DP, mengurus approval Online, merilis/assign produksi sesuai permission.
- **Designer Sales:** membuat order tanpa menerima payment, claim job, upload desain, approval Walk-in/Makloon, dan meminta revisi pra-produksi.
- **Operator:** tidak memiliki permission design atau payment; hanya melihat job produksi sesuai machine grant.
- **Server boundary:** action utama tenant-scoped dan ownership design sudah diperiksa; gap terbesar tersisa di validasi referensi pada saat create order dan status terminal keuangan.

## Skenario bisnis yang diuji secara analitis

### Skenario A — Admin membuat Walk-in, desain lalu DP

1. Admin membuat `DRAFT`, item dan DesignJob `PENDING`.
2. Designer claim, upload V1 `PENDING`, lalu ACC dengan bukti.
3. Order menjadi `WAITING_PAYMENT` bila DP belum cukup.
4. Admin catat DP; order menjadi `CONFIRMED` dan auto-release bila gate lengkap.
5. Job masuk per mesin dan Operator melihat sesuai grant.

**Hasil:** jalur happy path bekerja, dengan catatan validasi referensi dan versi di atas.

### Skenario B — Designer membuat order baru

1. Designer membuat order dengan harga katalog, DP default 50%, dan kontak write-only.
2. Job masuk queue; Designer claim secara atomik.
3. Designer upload dan ACC sesuai metode.
4. Admin menerima DP; sistem melanjutkan gate produksi.

**Hasil:** separation of duties berjalan. UI multi-role perlu diselaraskan dengan roles efektif.

### Skenario C — Online

1. Designer upload V1; versi `PENDING`.
2. Designer tidak dapat ACC; Admin/Owner mengisi bukti dan approve.
3. DP diterima dan order turun ke gate.

**Hasil:** role approval benar. Evidence masih disimpan sebagai teks bebas; format channel/waktu/lampiran dapat diperkuat.

### Skenario D — Makloon dengan DP lebih dulu

1. Admin menerima DP saat DesignJob belum approved; order menunggu desain.
2. File Makloon lengkap diupload; upload menghitung ulang DP dan mencoba auto-release.

**Hasil:** jalur ini sudah diperbaiki dan tidak lagi bergantung pada pembayaran kedua.

### Skenario E — Satu order, banyak item

1. Designer upload per item atau satu layout gabungan.
2. Setiap slot ditampilkan dengan `n/m ACC`.
3. Setelah semua tertutup, gate memeriksa item dan routing mesin.

**Hasil:** coverage multi-item berjalan; risiko utama adalah versi approved lama/rejected yang belum disupersede.

### Skenario F — Konsumen minta revisi setelah ACC

1. Sebelum produksi, PIC/Admin meminta revisi dengan alasan.
2. Versi terbaru ditolak dan DesignJob kembali `DESIGNING`.
3. Designer harus upload versi baru dan approval ulang.

**Hasil:** state dasar benar, tetapi server masih memungkinkan versi `REJECTED` di-ACC kembali dan helper coverage masih membaca approval lama. Ini harus ditutup sebelum workflow dianggap aman.

## Prioritas perbaikan

### Gelombang 1 — wajib sebelum produksi multi-tenant

1. Validasi produk, material, Designer, status aktif, dan tenant di server saat create order.
2. Target approval hanya versi `PENDING`; implementasikan status `SUPERSEDED`/latest-per-slot secara konsisten.
3. Tolak payment dan discount decision pada status terminal atau setelah produksi tanpa correction flow.
4. Implementasikan update order pra-produksi atau ubah dokumen agar tidak menjanjikan fitur yang belum ada.

### Gelombang 2 — konsistensi operasi

1. Satukan helper latest-approved untuk Designer, Operator, Scan, readiness, dan auto-release.
2. Tambahkan assignment Designer di UI atau hapus jalur `designerId` yang belum dipakai.
3. Selaraskan UI dengan roles efektif pada user multi-role.
4. Tambahkan tenant filter pada semua query production/order terkait.

### Gelombang 3 — profesionalisasi dan observability

1. Evidence Online terstruktur: channel, waktu, catatan, dan lampiran opsional.
2. Audit SLA: waktu DRAFT, DESIGNING, WAITING_PAYMENT, menunggu release, dan waktu claim.
3. Integration test untuk urutan pembayaran/desain, multi-item, revisi, double-click claim, dan tenant isolation.

## Verifikasi yang dijalankan

- `npx tsc --noEmit --pretty false` berhasil.
- `npx prisma validate` dan `npx prisma migrate deploy` sebelumnya berhasil; database menyatakan tidak ada migration tertunda setelah migration versi desain dan attendance diterapkan.
- `npx next build --webpack` sebelumnya berhasil.
- Review source dilakukan pada `orders.ts`, `design.ts`, `production.ts`, `queries.ts`, `auto-release.ts`, `production-readiness.ts`, `NewOrderModal.tsx`, `designer/page.tsx`, schema Prisma, serta dokumen workflow/roles.

Audit ini bersifat code/document review dan belum menggantikan integration test dengan dua tenant, dua Designer, beberapa urutan payment/approval, dan job production yang berjalan bersamaan.

