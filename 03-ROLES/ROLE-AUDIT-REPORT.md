# Laporan Audit Roles User Print Pilot

Tanggal audit: 14 September 2026  
Ruang lingkup: dokumentasi roles tenant, Super Admin, multi-role, permission catalog, entitlement paket, middleware, Server Actions, dan route file desain.

## Kesimpulan eksekutif

Model lima role tenant sudah tepat untuk SaaS percetakan kecil sampai besar: Owner, Admin, Designer Sales, Operator, dan Gudang. Multi-role juga sudah didukung oleh `UserRole`, JWT `roles[]`, middleware, dan helper `can()`.

Belum aman untuk dinyatakan selesai secara profesional karena enforcement belum konsisten. Sebagian modul sudah memakai permission terpusat dan mode read-only, tetapi modul desain, pembatalan, POS, master data, payroll, laporan, attendance, notifications, dan beberapa query masih memakai pengecekan role langsung. Temuan paling serius berada pada alur desain dan akses file desain.

## Status per role

### Owner

- Role `owner` menerima seluruh permission katalog.
- Owner tetap menjadi approver untuk rework, audit, koreksi, pembatalan pascaproduksi, dan override pickup.
- Risiko utama berasal dari modul yang masih memakai role langsung; hasilnya tetap Owner-only, tetapi belum memiliki kebijakan terpusat atau entitlement yang seragam.

### Admin

- Mencakup order, customer, payment, pickup, produksi, audit submit, laporan, dan konfigurasi storage.
- Permission `qc.submit`, `storage.configure`, dan `storage.report_incident` diberikan kepada Admin, tetapi kemampuan tersebut belum dijelaskan konsisten di `03-ROLES/ADMIN.md`.
- Admin tidak memiliki `audit.approve`, `correction.approve`, `pickup.release_override`, atau `production.rework_decide`.

### Designer Sales

- Mendukung pembuatan order, upload desain, approval walk-in, dan revisi.
- Pembatasan data customer dan harga belum dapat dianggap aman karena `getDesignJob()` dan route file desain hanya memeriksa keanggotaan tenant.
- Guard desain masih langsung berbasis role dan belum menghormati mode read-only Support.

### Operator

- Eksekusi produksi, material, waste, scan, pause, resume, dan finish sudah memakai permission terpusat pada modul produksi.
- `getOperatorJobs()` belum memiliki guard role eksplisit. Dampak saat ini terbatas karena queue dibatasi mesin yang terhubung ke actor, tetapi kontrak aksesnya tetap terlalu longgar.
- Akses `/finishing` tersedia di middleware untuk Operator, sementara navigasi utama lebih menonjolkan Gudang.

### Gudang

- QC, finishing, storage, counter, dan incident sudah memiliki permission terpisah.
- Aksi mutasi storage sudah memeriksa entitlement `storage` dan permission role.
- Input material berada di `master-data.ts` dengan guard Gudang/Owner, sesuai dokumentasi.

### Super Admin

- Disimpan terpisah di `SuperAdmin` dan tidak menjadi role tenant.
- `getPlatformActor()` saat ini memaksa semua akun aktif menjadi `SUPER_ADMIN`; ini konsisten dengan dokumentasi satu level akses.
- Tipe `SUPPORT` dan `FINANCE` masih tersisa di kode, tetapi secara efektif tidak aktif.

## Temuan prioritas tinggi

### Tinggi — Support impersonation masih dapat mengubah desain

`frontend/src/actions/design.ts:104-112`, `149-158`, `270-289`, dan `394-403` menggunakan `requireUser()` serta pengecekan role langsung. Support yang impersonate tenant dikembalikan sebagai actor Owner dengan `readOnly: true`, tetapi guard tersebut tidak memeriksa `readOnly`. Akibatnya Support berpotensi membuat upload URL, upload versi, approve desain, atau meminta revisi.

Perbaikan wajib: gunakan `requireMutableActor()` untuk semua mutasi desain dan ganti `canDesign()` dengan permission `can()`/`canAny()` yang menghormati `readOnly`.

### Tinggi — File desain dapat diakses semua user tenant

`frontend/src/app/api/design/[versionId]/route.ts:23-30` hanya memanggil `requireUser()` dan memfilter `tenant_id`. Route tidak memeriksa role, ownership job, assignment operator, atau status `APPROVED`. User tenant yang mengetahui `versionId` dapat meminta file desain versi PENDING atau REJECTED.

Perbaikan wajib: validasi actor dan konteks job di route. Batasi file APPROVED untuk operator yang ditugaskan, Owner/Admin, dan pihak desain yang berhak; jangan sajikan versi PENDING/REJECTED kecuali actor memiliki permission desain yang sesuai.

### Tinggi — Permission terpusat belum menjadi enforcement universal

Dokumentasi `03-ROLES/MULTI-ROLE.md` menyatakan semua action memakai `actorHasRole()` dan `09-TECHNICAL/PERMISSION-ARCHITECTURE.md` menetapkan permission, entitlement, policy, audit, dan idempotency. Implementasi masih memiliki guard role langsung di `cancel.ts`, `hold.ts`, `pos.ts`, `design.ts`, `master-data.ts`, `payroll.ts`, `reports.ts`, `attendance.ts`, `notifications.ts`, `shop.ts`, `queries.ts`, serta beberapa API route.

Dampaknya: permission catalog, entitlement paket, mode read-only, dan future user overrides tidak berlaku seragam.

## Temuan menengah

### Dokumen dan katalog permission belum sinkron

`frontend/src/lib/permissions.ts` sudah memiliki `storage.configure`, tetapi `03-ROLES/PERMISSIONS.md` belum mencantumkannya. `09-TECHNICAL/PERMISSION-ARCHITECTURE.md` memberi contoh `rework.approve`, sedangkan permission aktual bernama `production.rework_decide`.

### Separation of duties baru terdokumentasi sebagian

`STAFFING-POLICIES.md` menyebut pencegahan Operator melakukan QC sendiri, pembuat payment menyetujui refund, dan larangan Admin menyetujui audit yang ia submit. Implementasi yang diaudit belum menunjukkan enforcement policy tenant yang menyeluruh.

### Quota belum atomik terhadap request bersamaan

Quota user dan order diperiksa sebelum operasi utama. Dua request paralel masih dapat melewati pemeriksaan yang sama. Ini bukan privilege escalation, tetapi dapat melanggar batas paket.

## Rekomendasi urutan perbaikan

1. Tutup dua temuan tinggi pada desain dan route file desain.
2. Migrasikan semua mutation dan endpoint sensitif dari role langsung ke `can()`/`canAny()`; gunakan `requireMutableActor()` untuk setiap mutation.
3. Sinkronkan permission catalog, role docs, API docs, dan navigation matrix.
4. Implementasikan policy separation of duties per tenant dan audit alasan takeover.
5. Tambahkan test matrix per role, multi-role, Support read-only, tenant berbeda, dan paket Starter/Pro.
6. Setelah test lulus, perkuat quota dengan transaksi serializable atau constraint/advisory lock.

## Pemeriksaan yang dilakukan

- Membaca seluruh dokumen role utama dan dokumen permission/entitlement.
- Menelusuri middleware route access, actor/session, role loading, permission mapping, dan Server Actions.
- Memeriksa route API audit log, attendance selfie, dan file desain.
- ESLint file implementasi permission/entitlement dan action terkait: lulus.
- TypeScript: lulus.
- Prisma validate: lulus.
- Build produksi tidak selesai karena environment tidak dapat mengakses Google Font Inter; ini bukan error TypeScript atau Prisma.
