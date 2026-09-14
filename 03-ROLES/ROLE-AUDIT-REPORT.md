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

## Audit ulang kompatibilitas 1, 2, dan banyak pegawai — 15 September 2026

### Kesimpulan

Fondasi multi-role Print Pilot sudah kompatibel untuk satu orang, tim 2–3 orang,
dan tim yang lebih besar. Modelnya lebih sesuai dengan proses percetakan daripada
model kasir generik karena role dipisah menjadi Owner, Admin, Designer Sales,
Operator, dan Gudang. Namun, statusnya **belum setara dengan kontrol profesional
Moka** sampai tiga hal diperbaiki: enforcement policy staffing di server,
penonaktifan user yang langsung mencabut sesi/pekerjaan, dan akses granular
berbasis fitur.

### Mekanisme yang benar-benar berjalan

1. `User.role_id` menyimpan primary role; `UserRole` menyimpan role tambahan.
   `getCurrentUser()` memuat keduanya, mengurutkan primary role dengan prioritas
   owner → admin → designer → operator → gudang, dan action memakai union role.
2. `workspace_mode` (`SOLO`, `TEAM_SMALL`, `TEAM_FULL`) hanya mengubah beranda
   dan navigasi. Nilai ini tidak membatasi permission dan tidak memaksa jumlah
   pegawai atau separation of duties.
3. Pada pendaftaran, Owner diberi seluruh role operasional sebagai bootstrap.
   Owner dapat melepas role operasional setelah pegawai pengganti tersedia;
   permission Owner sendiri tetap penuh sebagai jalur takeover darurat.
4. Pegawai baru dibuat dengan password sementara acak, wajib mengganti password,
   dan dibatasi oleh kuota user aktif. Owner dapat menggabungkan beberapa role
   pada satu akun tanpa membuat role baru berdasarkan jumlah orang.
5. Produksi dirutekan ke satu `ProductionJob` per mesin. Mesin dapat memiliki
   default operator; tanpa itu job masuk queue dan di-claim atomik oleh Operator
   yang mempunyai `UserMachine` untuk mesin tersebut.
6. Sidebar pegawai menampilkan menu berdasarkan union role. Dashboard Designer,
   Operator, dan Gudang memiliki akses Absensi Saya; Admin/Owner memiliki modul
   rekap dan konfigurasi.

### Penilaian berdasarkan ukuran tim

**Satu orang — layak dengan catatan (8/10).** Owner bootstrap dapat menjalankan
order, desain, produksi, QC, finishing, storage, dan pickup. Beranda Solo
memberi antrean langkah berikutnya. Kelemahannya, mode Solo adalah presentasi;
tidak ada constraint yang mencegah tenant memiliki pegawai lain atau satu orang
melakukan dua tahap yang sama.

**Dua sampai tiga orang — layak untuk operasi harian (7/10).** Form pegawai
mendukung kombinasi Admin + Operator + Gudang pada satu akun, dan mode
`TEAM_SMALL` disarankan otomatis ketika ada pegawai aktif. Queue per mesin,
claim atomik, dan assignment manual sudah mendukung pembagian kerja. Separation
of duties masih berupa dokumentasi, sehingga konflik pembuat-versus-approver
belum dipaksa oleh policy tenant.

**Empat orang atau lebih — fondasi tersedia, kontrol enterprise belum lengkap
(6/10).** Mode `TEAM_FULL` disarankan mulai lima pegawai, role dapat dipisah,
dan akses mesin dapat dibatasi. Belum ada shift, kapasitas per mesin, lokasi/
outlet, load balancing otomatis, atau custom role berbasis permission. Jika
operator dinonaktifkan, job yang sudah assigned belum otomatis dikembalikan ke
queue atau dibuatkan tugas reassign; Admin hanya melihat sebagian kondisi melalui
overview produksi.

### Temuan implementasi yang harus ditutup

- **P1 — sesi user nonaktif dan pekerjaan yang ditinggalkan (ditutup sebagian).**
  Sesi sekarang langsung gugur di server; job produksi yang belum dimulai
  dikembalikan ke queue, sedangkan job `STARTED/PAUSED` tampil sebagai tugas
  reassign agar progres tidak hilang. Finishing/storage aktif tetap memerlukan
  keputusan manual karena kolom penanggung jawabnya wajib menyimpan jejak.
- **P1 — default operator dan grant mesin (ditutup).**
  Penetapan default otomatis membuat `UserMachine`, dan auto-release memeriksa
  grant operator–mesin sebelum membuat `PRODUCTION_ASSIGNED`.
- **P1 — policy staffing belum menjadi model data/enforcement.** Belum ada
  `TenantPolicy`, konfigurasi separation of duties, shift, atau constraint yang
  dipakai semua action. `STAFFING-POLICIES.md` saat ini adalah aturan bisnis
  terdokumentasi, bukan gerbang server.
- **P1 — akses file desain terlalu luas (ditutup).**
  `getDesignJob()` dan `GET /api/design/[versionId]` sekarang memeriksa role,
  PIC desain, status approval, dan assignment operasional sebelum mengembalikan
  metadata atau file.
- **P2 — permission belum konsisten.** Banyak action masih memakai
  `actor.roles.includes(...)` langsung. Ini ekuivalen untuk role bawaan sekarang,
  tetapi mengabaikan jalur override, entitlement, dan mode read-only yang
  dijanjikan arsitektur permission.
- **P2 — indikator Solo (ditutup).** `getNextSteps()` sekarang membaca
  `workspace_mode`, sehingga jumlah role tidak mengubah tampilan workspace.
- **P2 — multi-role dapat menggandakan label menu.** User non-Owner dengan dua
  role operasional dapat melihat dua shortcut `Absensi Saya` yang menunjuk
  dashboard berbeda; sebaiknya satu shortcut mengikuti dashboard aktif atau
  diarahkan ke halaman absensi bersama.

### Perbandingan dengan Moka

Moka menyediakan dua role standar, Administrator dan Cashier, lalu Owner dapat
membuat employee role sendiri dan memilih permission App/Backoffice per fitur.
Administrator tidak dapat dihapus oleh Owner, sedangkan role Cashier dapat
dihapus bila tidak lagi dipakai. Moka juga menyediakan PIN authorization untuk
fitur sensitif seperti diskon, refund, invoice, dan perubahan bill
([panduan akses karyawan Moka](https://help.mokapos.com/cara-mengatur-akses-karyawan),
[panduan PIN akses karyawan](https://help.mokapos.com/cara-mengatur-pin-untuk-akses-karyawan)).

Moka menekankan laporan shift lintas outlet dan identifikasi pegawai pada setiap
shift ([Employee Management Moka](https://www.mokapos.com/manajemen-karyawan)).
Print Pilot saat ini unggul pada role yang langsung mengikuti rantai desain →
cetak → QC → finishing, tetapi masih single-tenant/single-outlet, tanpa custom
role, feature PIN untuk transaksi, atau shift/outlet scope.

### Putusan audit

Arsitektur role Print Pilot **sudah cocok secara konsep** untuk skala 1 sampai
banyak orang dan lebih tepat untuk percetakan daripada menyalin role kasir Moka
secara mentah. Ia belum boleh diberi label “setara Moka” dalam kontrol akses.
Prioritas implementasi: (1) cabut sesi dan requeue saat user dinonaktifkan,
(2) jadikan grant mesin syarat default assignment, (3) implementasikan policy
separation of duties/shift per tenant, (4) tutup akses file desain, lalu
(5) tambahkan custom role atau feature PIN bila kebutuhan transaksi meningkat.

## Implementasi hasil persetujuan — 15 September 2026

Empat perbaikan prioritas pertama telah diterapkan dan divalidasi:

1. **Sesi akun nonaktif dicabut di server.** `getCurrentUser()` sekarang hanya
   menerima user aktif. Menonaktifkan pegawai mengembalikan job produksi yang
   belum dimulai ke `PRODUCTION_QUEUED`, mencatat jumlah job yang perlu reassign,
   dan memperbarui dashboard produksi. Job yang sudah `STARTED/PAUSED` tidak
   dihapus progresnya; Admin/Owner mendapat panel **Job Operator Nonaktif**.
2. **Default operator wajib punya akses mesin.** Saat mesin diberi default
   operator, `UserMachine` otomatis dibuat. Saat auto-release, sistem tetap
   memeriksa pasangan operator–mesin; jika grant hilang, job masuk antrean dan
   tidak salah-pin ke operator.
3. **Mode Solo konsisten.** Panel langkah berikutnya membaca
   `Tenant.workspace_mode`, bukan jumlah role. Owner multi-role di workspace tim
   tidak lagi melihat antrean Solo secara tidak sengaja.
4. **Akses file desain ditutup.** Owner/Admin atau Designer PIC dapat melihat
   job desainnya. Operator hanya dapat membuka file approved pada order yang
   ditugaskan. QC/Finishing hanya dapat membuka file approved setelah order
   masuk tahap operasional. Endpoint API dan Server Action menerapkan aturan
   yang sama.

Validasi setelah perubahan: `npx tsc --noEmit`, `npx prisma validate`, dan
ESLint pada seluruh file yang berubah berhasil tanpa error. Temuan yang masih
terbuka adalah policy separation-of-duties/shift sebagai konfigurasi tenant,
custom role berbasis permission, PIN untuk aksi sensitif, serta scope outlet dan
load balancing; semuanya merupakan tahap berikutnya, bukan prasyarat untuk
operasi satu sampai banyak pegawai saat ini.
