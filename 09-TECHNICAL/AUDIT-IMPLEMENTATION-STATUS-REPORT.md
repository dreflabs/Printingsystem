# Inventaris Audit dan Status Implementasi Print Pilot

Tanggal pemeriksaan: 16 September 2026  
Branch yang diperiksa: `feat/backend-integration`  
Commit remote terakhir: `a21bb548` (`harden super admin password reset and sessions`)

## Tujuan pemeriksaan

Dokumen ini mencocokkan laporan audit, dokumen workflow/role, riwayat commit, dan status working tree. Status dibagi menjadi:

- **Selesai dan sudah dipush:** perubahan dapat ditemukan di `origin/feat/backend-integration`.
- **Selesai sebagian:** sebagian rekomendasi sudah memiliki implementasi, tetapi masih ada gap yang disebutkan di laporan audit.
- **Sudah dikerjakan lokal, belum dipush:** perubahan masih berada di working tree.
- **Audit selesai, implementasi belum:** temuan dan rekomendasi sudah terdokumentasi, tetapi belum ada bukti perubahan kode yang menutupnya.

## Ringkasan keputusan

Print Pilot sudah memiliki fondasi yang kuat untuk uji operasi terkontrol. Perbaikan penting yang sudah masuk remote meliputi guard role/tenant, alur Designer multi-item, routing mesin, assignment Operator, warehouse dasar, allowlist Product–Material, kontrol absensi awal, dan hardening Super Admin.

Status belum dapat disebut selesai untuk produksi profesional karena masih ada empat kelompok risiko yang nyata:

1. pembayaran dan refund belum memiliki ledger finansial lengkap;
2. absensi belum siap menjadi sumber payroll lintas tenant;
3. satuan harga/unit material masih memiliki perubahan lokal yang belum dipush dan gap HPP;
4. authentication publik masih belum memiliki provider reset password production, verifikasi registrasi, dan rate limit terdistribusi.

## Sudah diaudit dan perbaikannya sudah dipush

### Roles, multi-role, dan akses tenant

Audit role, staffing satu orang sampai banyak orang, serta perbandingan model operasional dengan percetakan kecil sudah dilakukan. Perbaikan utama sudah dipush pada commit `fe44406e`, `0a833e68`, dan `4c482b95`:

- sesi user nonaktif ditolak dan job yang belum dimulai dikembalikan ke antrean;
- mode Solo/Tim memakai policy workspace;
- akses file desain diberi tenant, role, PIC, order, dan status gate;
- default Operator wajib memiliki grant mesin;
- assignment manual dan reassignment memvalidasi Operator aktif serta `UserMachine`;
- query queue Operator memiliki guard permission;
- panel queue tanpa Operator dan indikator beban mesin tersedia;
- dokumentasi diselaraskan ke satu `ProductionJob` per mesin.

Yang masih terbuka: separation of duties/shift sebagai konfigurasi tenant, custom role berbasis permission, PIN untuk aksi sensitif, outlet scope, dan load balancing kapasitas.

### Alur Admin → Designer → Operator

Audit end-to-end order, upload, ACC, pembayaran, auto-release, dan produksi sudah dilakukan. Perbaikan yang sudah dipush mencakup:

- claim Designer/Operator atomik;
- ownership/PIC dan fase order divalidasi di server;
- approval Walk-in/Online membutuhkan bukti yang sesuai;
- upload Makloon yang melengkapi item dapat menghitung ulang DP dan memicu auto-release;
- assignment manual menjalankan readiness gate dan validasi Operator;
- slot desain approved tidak dapat diunggah ulang tanpa revisi resmi;
- Operator menerima versi approved terbaru per slot;
- auto-release mengunci Order agar tidak menggandakan `ProductionJob`.

Gap tersisa: pengujian integrasi race masih perlu dijalankan dengan PostgreSQL, bukti approval Online belum berbentuk attachment/metadata terstruktur, dan SLA order yang tertahan belum menjadi monitoring penuh.

### Desain multi-item dan dashboard Designer

Audit tombol ACC, upload, V1/V2/V3, revisi, multi-item, dan handoff ke Operator sudah dilakukan. Commit `16cce9aa` dan `cceb57e4` sudah memasukkan:

- file desain per `OrderItem`;
- coverage approved per item;
- progres `item approved / total item` dan daftar item yang masih menunggu;
- identitas item yang lebih jelas pada dropdown/detail;
- bounce produksi yang menandai versi terbaru pada seluruh slot;
- unique `DesignJob` per tenant/order;
- label dan state upload/ACC yang lebih jelas.

Fitur salin desain approved antar-order sengaja belum dibuat. Filter Designer yang lebih kaya, riwayat versi lengkap, dan metrik SLA masih merupakan backlog UX/operasional.

### Operator, mesin, dan produksi

Audit alur menerima job, SCAN/claim, banyak Operator, banyak mesin, default Operator, reassignment, dan progress multi-mesin sudah dilakukan. Fondasi yang sudah dipush:

- queue dibatasi grant mesin;
- claim memakai conditional update atomik;
- job pinned hanya dapat dimulai Operator yang dipilih;
- mesin nonaktif ditahan dari auto-release;
- job selesai mengurangi stok sesuai kontrol produksi;
- assignment/reassignment memiliki alasan dan audit event;
- dashboard Admin menampilkan queue tanpa Operator dan beban mesin;
- progress per mesin ditampilkan pada detail order.

Yang belum menjadi fitur otomatis: kapasitas/shift/durasi mesin, load balancing otomatis, dan model forecast deadline.

### Gudang, QC, finishing, storage, dan material dasar

Audit workflow Gudang serta implementasi bertahap sudah dilakukan. Commit `1e58f6b6` dan `40c183f4` sudah memasukkan:

- `material.receive` terpisah dari `material.adjust`;
- penerimaan stok dan PO parsial dengan lock serta larangan over-receipt;
- permission server-side pada query Gudang;
- claim QC/Finishing atomik;
- checklist QC dan batas kuantitas Finishing di server;
- stocktake snapshot dan approval Owner;
- incident Storage dengan keputusan dan audit;
- riwayat movement material dan alert operasional;
- supplier dan Purchase Order.

Yang masih tersisa: test concurrency lintas role, dual control PO cancellation/approval, serta alur replacement/cancellation sampai job pengganti.

### Product–Material cluster

Audit kebutuhan agar Banner hanya menampilkan material Banner, termasuk setup Gudang dan validasi server, sudah dilakukan. Commit `cceb57e4` dan `1e58f6b6` sudah memasukkan relasi Product–Material/allowlist dan validasi order dasar.

Masih terbuka:

- fallback material global pada beberapa jalur Operator/Scan;
- validasi material per item/per job/per mesin saat produksi;
- validasi material aktif dan konfigurasi MachineMaterial pada seluruh jalur;
- alur substitusi material resmi;
- tarif yang benar-benar berbeda per pasangan produk–material;
- konversi stok dan waste yang konsisten untuk seluruh unit.

### Dashboard visual, aksesibilitas, dan nota

Audit visual dashboard semua role dan nota sudah dilakukan. Gelombang utama sudah dipush melalui commit `fe44406e` dan perubahan terkait:

- tema light dikunci;
- token surface/elevation diperbaiki;
- layout KPI Designer dan POS mobile diperbaiki;
- nominal finansial Scanner dibatasi sesuai permission;
- loading/error state dan label aksesibel ditambahkan;
- nota memakai `@page` thermal 80 mm, metadata lebih terbaca, tanpa emoji footer, dan tautan berbasis order code.

Backlog visual: screenshot regression lintas data ekstrem, self-host font, palette chart terpusat, dan penyelarasan seluruh dokumen UI dengan scope aktual.

### Super Admin

Audit password dan akses Super Admin sudah ditutup pada commit `a21bb548` dan sudah dipush:

- login tetap email + password tanpa MFA sesuai keputusan pengguna;
- validasi password reset diperketat;
- reset password menaikkan `password_changed_at` dan mencabut JWT lama;
- bootstrap memakai transaksi dan audit platform;
- migration session revocation sudah dibuat dan diterapkan pada database lokal;
- panduan Coolify/VPS sudah diperbarui.

Yang belum dilakukan karena sengaja dikecualikan: MFA. Backlog tambahan: password history/breach check dan rate limiter terdistribusi.

## Sudah diaudit, tetapi baru sebagian diimplementasikan

### Pembayaran dan keuangan

Audit `FINANCIAL-PAYMENT-AUDIT-REPORT.md` sudah tersimpan dan sebagian fondasi sudah dipush:

- validasi harga server-side;
- approval diskon Owner dan gate diskon POS;
- koreksi dan pembatalan order memiliki alur UI;
- nota dan laporan sudah tenant-scoped serta role-gated;
- audit log hash chain tersedia.

Temuan P1 yang masih terbuka:

- refund order cetak belum menjadi ledger immutable;
- `addPayment()` belum diserialisasi penuh untuk dua kasir bersamaan;
- overpayment masih dapat tersembunyi oleh saldo `max(0, total-paid)`;
- diskon setelah pembayaran belum memiliki credit/refund workflow;
- audit event keuangan belum dijamin atomic dengan transaksi.

Temuan P2: `RefundRequest`/`FinancialAdjustment`, runtime schema nominal, definisi metrik gross/cash/refund/net, dan penyelarasan dokumen payment.

### Absensi

Audit role absensi, placement, dan audit komprehensif sudah dilakukan. Guard awal untuk Operator/Gudang dan kebijakan absensi sudah masuk commit `fe44406e`, tetapi laporan terbaru menetapkan status **Conditional Go**.

Sebelum payroll atau multi-tenant skala besar, yang belum selesai adalah:

- timezone IANA tenant untuk punch, cron, report, dan payroll;
- `startBreak` dan seluruh jalur punch yang konsisten memakai eligibility guard;
- import fingerprint dua tahap tanpa user ambigu/unmatched;
- filter jobStats berdasarkan periode laporan;
- permission terpisah untuk import/report/settings;
- punch idempotent untuk dua tab/HP/kiosk bersamaan;
- rate limiter kiosk terdistribusi;
- audit akses selfie dan flag geo/IP per punch;
- UI self-attendance untuk Admin/Owner yang eligible.

Laporan komprehensif masih **untracked** di working tree, sehingga belum ikut remote.

### Authentication registrasi, login, dan forgot password

Audit `AUTH-FLOW-AUDIT-REPORT.md` sudah dilakukan. Login tenant dasar memiliki hashing, tenant scope, lockout, dan generic error. Namun rekomendasi berikut belum tertutup secara penuh:

- provider email production untuk reset password;
- verifikasi email/OTP sebelum tenant aktif;
- rate limit registrasi, request reset, dan reset berbasis IP/device yang terdistribusi;
- TTL reset konsisten 15 menit;
- token reset single-use atomik;
- password policy tunggal untuk register/reset/force-change;
- audit event auth yang lengkap dan sinkronisasi dokumentasi onboarding.

Perubahan Super Admin pada `a21bb548` memperbaiki reset dan revocation untuk platform admin, tetapi tidak otomatis menutup alur forgot password tenant.

### Dashboard Owner/Admin/Designer dan nota

Audit visual sudah selesai dan perbaikan utama sudah masuk remote. P2 yang belum menjadi pekerjaan terpisah mencakup komponen design system bersama, konsistensi tipografi/radius, chart tokens, font fallback, filter Designer lengkap, dan beberapa detail UX status/deadline.

## Sudah dikerjakan lokal, belum dipush

Working tree saat pemeriksaan memiliki perubahan berikut:

- `frontend/src/lib/catalog-constants.ts`: fungsi harga berdasarkan unit produk dan matriks pasangan unit material;
- `frontend/src/actions/orders.ts`: formula harga unit dan snapshot `pricing_unit`/`cost_unit`;
- `frontend/src/actions/master-data.ts`: validasi pasangan unit material di server;
- `frontend/src/components/orders/NewOrderModal.tsx` dan `MaterialTab.tsx`: label/unit yang lebih konsisten;
- `frontend/tests/material-policy.test.ts`: test formula harga dan pasangan unit.

Perubahan ini selaras dengan rekomendasi audit satuan material, tetapi **belum ada di commit remote**. Jangan menganggap server sudah memakai formula tersebut sebelum perubahan dipisah, diuji, di-commit, dan dideploy.

Dua laporan juga masih untracked:

- `09-TECHNICAL/ATTENDANCE-COMPREHENSIVE-AUDIT-REPORT.md`;
- `09-TECHNICAL/MATERIAL-UNIT-PRICE-CONSISTENCY-AUDIT-REPORT.md`.

## Audit selesai, implementasi belum dibuktikan

Prioritas yang belum memiliki bukti penutupan end-to-end adalah:

1. ledger refund dan rekonsiliasi pembayaran;
2. timezone/atomic punch/import absensi;
3. provider email dan verifikasi registrasi tenant;
4. material substitution, price-per-material, dan HPP berbasis lebar efektif;
5. concurrency test nyata untuk payment, stocktake, receipt, upload, claim, dan auto-release;
6. load balancing mesin berbasis kapasitas/shift;
7. custom role, separation of duties, dan outlet scope;
8. replacement/cancellation job sampai job pengganti;
9. inventory reporting historis dan weighted average cost yang resmi.

## Urutan kerja yang disarankan

### Gelombang 1 — wajib sebelum data uang/stok produksi nyata

1. Pisahkan dan selesaikan perubahan unit material lokal; jalankan test; commit; deploy migration bila ada.
2. Tambahkan serialisasi payment, larangan overpayment, ledger refund, dan rekonsiliasi.
3. Tutup timezone, atomic punch, import ambiguity, dan periode report absensi.
4. Pastikan seluruh migration remote sama dengan lokal dan jalankan smoke test pada server deployment.

### Gelombang 2 — penguatan operasional

1. Selesaikan allowlist material pada semua jalur produksi dan conversion/waste per item/job.
2. Tambahkan test concurrency dan audit trail untuk PO, stocktake, QC, finishing, storage, upload, claim, dan auto-release.
3. Buat dashboard exception: queue tanpa Operator, stok minimum, overpaid, refund pending, unmatched attendance, dan job stagnan.

### Gelombang 3 — skala SaaS profesional

1. Provider email production, verifikasi registrasi, dan distributed rate limiting.
2. Shift, kapasitas mesin, load balancing, outlet scope, dan custom role.
3. HPP weighted average, price-per-material, lebar efektif, lot/batch, dan export historis.

## Verifikasi repository saat audit

- `origin/feat/backend-integration` sama dengan commit lokal `a21bb548`.
- Working tree tidak bersih; perubahan material/unit dan dua laporan audit belum dipush.
- `npx prisma validate`, `npx prisma generate`, TypeScript, lint target, dan `npx next build --webpack` terakhir dilaporkan lulus pada perubahan Super Admin.
- Build Turbopack sebelumnya gagal karena pembatasan lingkungan OS saat membuka worker/port; ini bukan bukti kegagalan compile aplikasi.

## Kesimpulan

Audit Print Pilot sudah luas dan fondasi kontrol utama sudah masuk remote. Pekerjaan yang paling mendesak sekarang bukan menambah role baru, melainkan menutup integritas uang, kesiapan payroll absensi, konsistensi unit material, dan authentication tenant. Perubahan lokal unit material serta dua laporan untracked perlu diperlakukan sebagai kandidat rilis terpisah, bukan dianggap sudah tersedia di server.

## Pembaruan implementasi — 16 September 2026

Tahap lanjutan yang sudah masuk kode:

- **Keuangan:** ledger refund printing, row lock payment/cancel, validasi overpayment, audit event finansial transactional.
- **Absensi:** timezone tenant, atomic clock-in/out, permission import/report/settings, guard attendance eligible, batas laporan periode.
- **Authentication tenant:** provider email abstraction production, token reset 15 menit atomic, password policy terpusat, email verification signup single-use/TTL/rate limit serta route verifikasi.
- **Material:** formula dan pasangan unit, pricing/cost snapshot, validasi produksi dan stock usage.
- **Produksi:** batas job aktif per mesin untuk mencegah overload mesin.

Belum selesai dan tetap menjadi backlog: rate limit terdistribusi, refund approval object/credit note, HPP dan substitusi material lanjutan, load balancing/shift, custom role/outlet scope, dan separation-of-duties penuh. Migrasi baru belum diterapkan ke database lokal karena PostgreSQL lokal tidak tersedia saat verifikasi.
