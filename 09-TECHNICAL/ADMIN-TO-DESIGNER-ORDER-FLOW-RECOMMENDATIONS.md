# Rekomendasi Lengkap Alur Order Admin → Designer

**Tanggal:** 15 September 2026  
**Dasar:** laporan audit Admin → Designer, dokumen workflow/roles, schema Prisma, server action, query, dan UI.

## Keputusan utama

Print Pilot sebaiknya memakai satu lifecycle order dengan handoff berbasis gate:

1. Admin atau Designer Sales membuat order DRAFT dan sistem membuat satu DesignJob.
2. Designer menangani desain setelah menjadi PIC atau mengambil job secara atomik.
3. Setiap file desain memiliki target slot: satu item atau seluruh order.
4. Approval hanya boleh dilakukan terhadap versi PENDING terbaru.
5. Revisi membuat versi lama SUPERSEDED dan selalu membutuhkan file baru.
6. Order tidak boleh masuk produksi sebelum semua item non-retail memiliki desain final, DP terpenuhi, data item lengkap, dan routing mesin tersedia.
7. Setelah ProductionJob dibuat, perubahan order dan desain harus berpindah ke alur correction/reprint.

Model ini menjaga separation of duties, aman untuk satu orang maupun banyak pegawai, dan tetap sesuai untuk tenant kecil.

## Prioritas 0 — wajib sebelum transaksi produksi nyata

### 1. Kunci validasi tenant dan katalog di server

Masalahnya: payload client dapat berisi productId, materialId, designerId, atau harga yang tidak sesuai tenant, status, atau role.

Rekomendasi:

- Muat produk dengan filter id + tenant_id + active.
- Muat material dengan filter id + tenant_id + active.
- Validasi material kompatibel dengan produk atau tandai sebagai override dengan alasan.
- Validasi designerId dengan tenant_id, active, dan role designer_sales pada role utama atau extra_roles.
- Tolak semua ID yang tidak ditemukan; jangan membuat order sebagian.
- Terapkan tenant scope pada semua relasi production dan design.

Kriteria selesai: payload berisi ID dari tenant lain, user non-Designer, user nonaktif, atau material nonaktif selalu ditolak.

### 2. Tetapkan aturan harga Admin

UI Admin dapat mengubah harga, sedangkan permission quote.edit_price belum konsisten dengan role Admin.

Keputusan yang disarankan:

- Admin memakai harga katalog sebagai default.
- Owner boleh mengubah harga langsung.
- Jika Admin boleh override, berikan permission quote.edit_price dan wajibkan alasan.
- Simpan harga katalog, harga quote, actor override, dan alasan.
- Designer Sales tidak boleh mengirim harga; server menghitung dari katalog aktif dan ukuran.

Kriteria selesai: harga yang diterima server selalu sesuai permission dan perubahan manual memiliki audit log.

### 3. Perbaiki lifecycle versi desain

Gunakan alur:

PENDING → APPROVED → SUPERSEDED  
PENDING → REJECTED → upload versi baru

Aturan:

- approveDesign hanya menargetkan PENDING terbaru.
- REJECTED tidak dapat di-ACC kembali.
- Revisi tidak menghapus histori.
- Saat file baru disetujui, versi approved lama menjadi SUPERSEDED.
- Coverage hanya menghitung satu versi aktif terbaru per slot.
- Designer, Operator, Scan, readiness, dan auto-release memakai helper latestVersionPerSlot yang sama.
- Operator hanya menerima file aktif terbaru; histori tetap tersedia bagi Admin/Owner.

Kriteria selesai: V1 approved → revisi → belum upload V2 tidak lolos gate, dan V2 approved membuat Operator hanya melihat V2.

### 4. Blokir transaksi keuangan pada status terlarang

addPayment hanya boleh berjalan pada status DRAFT, DESIGNING, WAITING_APPROVAL, WAITING_PAYMENT, dan CONFIRMED untuk pelunasan sebelum pickup.

Tolak payment pada CANCELLED, CLOSED, FINAL_AUDIT_COMPLETE, PICKED_UP, dan status setelah produksi yang tidak lagi menerima transaksi baru.

decideDiscount hanya boleh sebelum ProductionJob dibuat. Perubahan setelah produksi harus melalui correction atau financial approval.

Kriteria selesai: tidak ada payment confirmed atau perubahan total pada order terminal.

### 5. Implementasikan edit order pra-produksi

Dokumen menjanjikan edit DRAFT dan edit terbatas sebelum produksi, tetapi action update order belum tersedia.

Buat action terpisah:

- updateOrderHeader untuk customer, deadline, catatan, tipe.
- updateOrderItem untuk produk, ukuran, qty, material, finishing, deadline.
- repriceOrder untuk harga, diskon, dan DP.

Aturan status:

- DRAFT: Admin dan Designer sesuai permission.
- DESIGNING/WAITING_PAYMENT: Admin dapat mengubah data operasional; perubahan yang memengaruhi desain mengulang review.
- CONFIRMED atau sudah ada ProductionJob: tidak boleh edit langsung.
- Setelah produksi: gunakan correction/reprint.

Simpan before/after di audit log. Perubahan produk, ukuran, qty, atau material wajib mengulang completeness gate.

## Prioritas 1 — wajib sebelum operasi multi-pegawai diperluas

### 6. Gunakan model antrean Designer sebagai default

Untuk SaaS dengan jumlah pegawai yang berubah-ubah:

- Admin membuat order tanpa PIC.
- Designer yang berhak melihat antrean.
- Satu Designer claim secara atomik.
- Admin dapat reassign saat cuti, overload, atau eskalasi.
- Assignment langsung disediakan hanya untuk Owner/Admin bila diperlukan.

Dengan model ini tenant kecil tetap dapat beroperasi walau hanya satu orang, tetapi tenant besar tetap dapat membagi tugas secara aman.

### 7. Satukan permission server dan UI

UI jangan menentukan kebijakan dari role utama saja. Gunakan permission efektif dari semua role:

- canCreateOrder
- canEditPrice
- canReceivePayment
- canApproveOnline
- canApproveWalkin
- canUploadDesign

Server action tetap menjadi otoritas final. User multi-role harus melihat kemampuan gabungan yang benar-benar diizinkan, bukan pembatasan berdasarkan role utama saja.

### 8. Bekukan kamus status

Order:

DRAFT → DESIGNING → WAITING_PAYMENT → CONFIRMED → PRODUCTION_ASSIGNED → PRODUCTION_STARTED → PRODUCTION_COMPLETE → READY_FOR_PICKUP → PICKED_UP → CLOSED

DesignJob:

PENDING → DESIGNING → WAITING_APPROVAL → APPROVED

Revisi mengembalikan DesignJob ke DESIGNING. Setelah ProductionJob dibuat, revisi hanya melalui correction/reprint.

Label UI yang disarankan: Menunggu Diambil, Sedang Dikerjakan, Menunggu ACC Admin, Perlu Revisi, Disetujui, Menunggu DP, dan Siap Produksi. Kode teknis hanya ditampilkan pada detail dan audit.

### 9. Jadikan completeness gate satu-satunya pintu produksi

Semua jalur harus memanggil helper yang sama: pembayaran, approval desain, approval diskon, release Admin, manual assignment, dan correction/reprint.

Manual assignment boleh mengganti mesin, operator, prioritas, atau deadline, tetapi tidak boleh melewati DP, file approved, item lengkap, bahan valid, deadline valid, operator aktif, grant mesin, dan mesin aktif.

Jika override perlu tersedia, buat forceReleaseToProduction dengan permission Owner, alasan wajib, dan audit khusus.

### 10. Samakan konteks Designer dan Operator

ProductionJob harus memuat produk, deskripsi, ukuran, qty, material, finishing, deadline, file desain terbaru, versi aktif, dan instruksi teknis yang disetujui.

Pisahkan:

- Catatan revisi: histori komunikasi dan perubahan desain.
- Instruksi produksi: data final yang boleh dipakai Operator.

Instruksi produksi tidak boleh berubah setelah produksi dimulai.

## Prioritas 2 — profesionalisasi operasional

### 11. Tambahkan SLA dan aging queue

Simpan waktu order dibuat, job diambil, upload pertama, setiap upload, approval, revisi, DP terpenuhi, release, mulai, dan selesai.

Dashboard perlu menampilkan order DRAFT terlalu lama, desain melewati SLA, Online menunggu Admin, DP lengkap tetapi belum release, queue tanpa Operator, dan revisi berulang.

### 12. Lengkapi audit event

Minimal catat ORDER_CREATED, ORDER_UPDATED, DESIGN_JOB_CLAIMED, DESIGN_VERSION_UPLOADED, DESIGN_APPROVED, DESIGN_REVISION_REQUESTED, DESIGN_VERSION_SUPERSEDED, PAYMENT_ADDED, DISCOUNT_APPROVED, ORDER_RELEASED, PRODUCTION_ASSIGNED, dan PRODUCTION_STARTED.

Event sensitif menyimpan actor, role efektif, tenant, order/job, before/after, alasan, dan timestamp server.

### 13. Perkuat bukti approval

Online: channel, nama pihak, waktu konfirmasi eksternal, ringkasan pesan, dan lampiran opsional.

Walk-in: nama konsumen, pernyataan persetujuan, versi, timestamp server, dan Designer pencatat.

Catatan approval dibuat immutable; koreksi dilakukan dengan event baru.

### 14. Notifikasi berdasarkan tanggung jawab

- Designer: job baru, revisi, dan deadline mendekat.
- Admin: Online menunggu approval, DP masuk, gate tertahan, mesin down.
- Owner: diskon, rework, cancel produksi, override, SLA kritis.
- Operator: job baru di mesin, perubahan prioritas, file direvisi sebelum mulai.

Notifikasi tidak boleh mengirim nomor HP atau nominal ke role yang tidak berhak.

## Pengujian yang wajib

### Keamanan

1. Tenant A mengirim product/material/designer ID tenant B.
2. Designer A memanggil upload/revisi order Designer B.
3. Operator memanggil queue desain dan approval.
4. User nonaktif mencoba menerima payment.
5. User tenant B meminta file tenant A.

### State machine

1. DP sebelum desain.
2. Desain sebelum DP.
3. Makloon file terakhir setelah DP.
4. Diskon sebelum dan sesudah DP.
5. Revisi sebelum produksi.
6. Revisi setelah ProductionJob dibuat.
7. Cancel sebelum dan sesudah produksi.
8. Payment setelah cancel/closed.

### Concurrency

1. Dua Designer claim job yang sama.
2. Dua upload pada slot yang sama.
3. Approval dan revisi bersamaan.
4. Approval dan DP bersamaan.
5. Auto-release dan release Admin bersamaan.
6. Dua Operator claim job mesin yang sama.

### Multi-item

1. Dua item dengan dua mesin.
2. Dua item dengan satu mesin.
3. Satu file layout gabungan.
4. Satu item belum ACC.
5. Satu item direvisi setelah item lain approved.
6. Satu item retail dan satu item cetak.

## Urutan implementasi

### Sprint 1 — integritas

- Validasi tenant/status/role saat create order.
- Kunci harga sesuai permission.
- Blokir payment/discount pada status terlarang.
- Approval hanya untuk PENDING terbaru.

### Sprint 2 — lifecycle

- Tambahkan SUPERSEDED atau mekanisme latest-per-slot.
- Satukan helper coverage/version.
- Implementasikan edit order pra-produksi.
- Tambahkan correction/reprint.

### Sprint 3 — staffing

- Selaraskan UI dengan roles efektif.
- Tegaskan queue Designer.
- Tambahkan reassign Designer.
- Tambahkan notifikasi dan SLA.

### Sprint 4 — hardening

- Evidence approval terstruktur.
- Audit event lengkap.
- Integration/concurrency test.
- Staging dua tenant dan deployment verification.

## Kriteria go-live

Print Pilot siap produksi bila seluruh P1 memiliki test negatif, tidak ada relasi lintas tenant, versi lama tidak diterima Operator, order terminal menolak transaksi baru, edit/correction flow tersedia, transisi memiliki audit event, test concurrency dan multi-item berhasil, dan Admin dapat menemukan seluruh order tertahan tanpa membaca database langsung.

## Kesimpulan

Urutan terbaik adalah menutup integritas server dan lifecycle versi terlebih dahulu, lalu mengimplementasikan edit order dan konsistensi multi-role. Polesan UI, SLA, notifikasi, dan evidence approval menyusul setelah kontrol yang mencegah salah tenant, salah versi, dan transaksi setelah order selesai sudah aman.

## Status implementasi setelah persetujuan

Sprint 1 sudah diterapkan pada source:

- Validasi server untuk produk, bahan, Designer aktif, tenant, jumlah, harga, dan deadline item.
- Harga manual membutuhkan permission `quote.edit_price`; Designer tetap dihitung dari katalog.
- Approval hanya menerima versi `PENDING` terbaru.
- Versi lama ditandai `SUPERSEDED` ketika versi baru disetujui.
- Coverage, auto-release, Operator, dan Scan memakai versi terbaru per slot.
- Payment ditolak pada order terminal dan nominal melebihi saldo.
- Keputusan diskon ditolak setelah ProductionJob dibuat atau order terkunci.
- Query production diberi tenant scope tambahan untuk idempotensi release.

Validasi pasca-perubahan berhasil: TypeScript, ESLint file terkait, Prisma generate/validate, Next build webpack, dan `git diff --check`. Edit order, correction/reprint, SLA, notifikasi, serta evidence approval terstruktur tetap menjadi Sprint 2–4.
