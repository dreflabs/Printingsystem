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

Catatan rollout: email verification tidak dipaksa pada fase beta/trial. Gate hanya aktif eksplisit dengan `REQUIRE_EMAIL_VERIFICATION=true` saat product release.

## Verifikasi independen — 17 September 2026

Bagian "Pembaruan implementasi — 16 September 2026" di atas ditulis tanpa rujukan commit dan belum diverifikasi terhadap kode nyata. Pemeriksaan ini membaca diff aktual (`git show <hash> -p`) untuk 10 commit terbaru (`f19756b1`..`c8c39452`, semua sudah di working tree bersih, `c8c39452` masih 1 commit di depan `origin/feat/backend-integration`) dan membandingkan dengan file saat ini. Kesimpulan: sebagian besar klaim benar, tetapi ada beberapa **overclaim** dan **temuan baru** yang belum tercatat di mana pun.

### Keuangan/Ledger — sebagian besar benar, dua overclaim

- **Benar dan solid:** `addPayment` (`frontend/src/actions/orders.ts:416`), `cancelOrder` (`frontend/src/actions/cancel.ts:120`), dan `decideDiscount` (`orders.ts:531`) memakai `SELECT ... FOR UPDATE` di dalam `prisma.$transaction` — lock DB nyata, bukan cek level aplikasi. Overpayment kini ditolak keras (`orders.ts:424-426`). Audit event finansial memakai `pg_advisory_xact_lock` di dalam transaksi yang sama (`cd6f8da3`, `logger.ts:82-113`) sehingga hash chain tidak bisa bercabang.
- **Overclaim #1 — refund "ledger":** tidak ada model `Refund`/`FinancialAdjustment` di `schema.prisma`. Refund hanya berupa `Payment` row bernilai negatif (`cancel.ts:169-181`), tanpa proteksi immutability di level skema.
- **Overclaim #2 — signifikan:** diskon setelah pembayaran memang sudah diblokir dan pesan error menunjuk ke "alur refund/credit approval", tetapi **alur itu tidak ada sama sekali** di kodebase — tidak ada `CreditNote` atau model approval apa pun. Admin yang butuh koreksi diskon pasca-bayar mentok di jalan buntu.
- Commit `7a31260c` berjudul "tighten ... payment validation" tetapi diff aslinya hanya menyentuh `attendance.ts`/`lib/attendance.ts` — pesan commit menyesatkan, bukan bukti perubahan payment.

### Absensi — hampir semua benar, empat gap sisa

- **Benar dan solid:** timezone tenant konsisten (`attendance.ts`, `attendance-punch.ts`), guard eligibility di semua path punch (`clock.ts:57,92,127,199,242,274`), filter periode `jobStats` (`attendance.ts:516-531`), permission terpisah (`permissions.ts:20,36,45`), dan **idempotency di level DB** (`@@unique([tenant_id, user_id, attendance_day])` + `pg_advisory_xact_lock`, `attendance-punch.ts:100-108`).
- **Masih terbuka:** import fingerprint ambigu sekarang **ditolak total** (`attendance.ts:279`), bukan alur resolusi dua tahap seperti dijanjikan; rate limiter kiosk masih in-memory per-proses (`rate-limit.ts`, dipakai `api/kiosk/punch/route.ts:33`); akses foto selfie tidak diaudit — `api/attendance/selfie/[id]/route.ts` hanya cek role, tidak memanggil `logAction` saat foto dibuka; **overclaim scope**: UI self-attendance (`AbsenCard`) hanya dipasang di dashboard Owner (`owner/page.tsx:312`), Admin sama sekali tidak punya meski klaim menyebut "Admin/Owner".

### Autentikasi tenant — satu overclaim penting, dua gap lama masih terbuka

- **Benar dan solid:** provider email produksi nyata (Resend/Brevo, `mail.ts:38-120`, bukan sekadar interface), TTL reset 15 menit tetap (`password-reset.ts:20`), token reset & verifikasi single-use atomik via `updateMany` bersyarat dalam transaksi, password policy terpusat (`password-policy.ts`) dipakai konsisten di register/reset.
- **Overclaim:** verifikasi email diklaim selesai, tetapi defaultnya **mati** (`REQUIRE_EMAIL_VERIFICATION` default `"false"` di `.env.example:62`) — ini keputusan produk yang disengaja untuk beta (bukan regresi diam-diam), tetapi berarti gap "verifikasi sebelum tenant aktif" belum benar-benar tertutup pada kondisi default deployment saat ini.
- **Masih terbuka (belum tersentuh commit terbaru):** rate limiting register/reset masih in-memory, bukan terdistribusi; audit event auth (register, reset, verifikasi) masih nihil — tidak ada satu pun `logAction` call di tiga file tersebut.
- Komentar stale di `password-reset.ts:16` masih bilang "email delivery NOT wired" padahal baris 28 sudah memanggil `sendEmail` — perlu dibersihkan agar tidak menyesatkan pembaca kode berikutnya.

### Material & produksi — mayoritas masih separuh jalan

- **Benar:** pricing per pasangan produk-material (`orders.ts:247-255`, snapshot ke `pricing_snapshot`), matriks konversi unit material (`catalog-constants.ts` + `production.ts` menerapkan `conversion_factor` pada usage/waste), kapasitas mesin per-mesin (`Machine.max_active_jobs`, `master-data.ts` clamp 1–100).
- **Temuan baru — race condition kapasitas mesin:** `startProduction` (`production.ts:246-252`) mengecek `activeCount >= max_active_jobs` di dalam `$transaction`, tetapi **tanpa row lock** (`SELECT...FOR UPDATE`) dan Postgres default `Read Committed` — dua `startProduction` bersamaan pada mesin yang sama bisa lolos cek sebelum salah satu commit. Operator/Owner dengan permission `production.assign` juga **melewati cap ini sepenuhnya**.
- **Masih terbuka:** fallback material global belum terbukti hilang total di job legacy tanpa scope item; validasi `MachineMaterial` aktif belum ditegakkan di sebagian besar path produksi; alur substitusi material resmi belum ada; HPP weighted-average dan lot/batch tracking sama sekali belum ada di skema.

### SaaS/Billing (commit `0cb7bad0`) — scaffolding, bukan enforcement penuh

- Yang nyata: katalog paket dikonsolidasi (`saas-catalog.ts`), `Invoice` dapat kolom periode + `idempotency_key` dengan unique constraint dan handling race `P2002`, `entitlements.ts` menghormati `plan.active`.
- **Temuan baru — gap gating fitur:** `13-SAAS/SAAS-MODEL.md` menjanjikan penguncian fitur Starter (Scan QR Produksi, modul QC, Manajemen Gudang) tetapi `requireEntitlement()` hanya dipasang di `storage.ts` dan `audit.ts` — **tidak ada** di `production.ts` atau aksi QC. Tenant Starter saat ini bisa memakai fitur produksi/QC yang seharusnya Pro-only. Ini risiko nyata bila paket dipasarkan sesuai dokumen.
- Tidak ada webhook Midtrans (`/api/billing/webhook` tidak ditemukan), tidak ada otomasi trial-expiry-ke-invoice, dan siklus grace period yang berjalan (`tenant-lifecycle.ts`: trial 14 hari, suspended 60 hari, purge 30 hari) berbeda dari spesifikasi dokumen (grace 3 hari ke SUSPENDED). Login untuk tenant `SUSPENDED`/`CHURNED` diblokir total (`auth.ts:147`), lebih ketat dari spec yang mengharapkan tenant tetap bisa mencapai layar pembayaran.

### Temuan lain di luar cakupan commit

- ~~Keamanan proses — prompt injection di repo~~ **DICABUT setelah double-check (lihat bagian "Verifikasi ulang" di bawah):** `frontend/AGENTS.md` bukan sisipan berbahaya. Isinya cocok persis dengan `node_modules/next/dist/server/lib/generate-agent-files.js` — fitur asli Next.js 16.3.1 yang membuat `next dev` menulis blok itu secara otomatis. Proyek ini memakai Next.js 16.3.1 (di luar cutoff pengetahuan model Sonnet 5, Januari 2026), jadi peringatannya sendiri valid: sebelum mengandalkan pola Next.js dari memori, cek dulu `node_modules/next/dist/docs/` untuk API yang berubah.

## Verifikasi ulang (double-check) — 17 September 2026

Atas permintaan pemilik proyek, bagian "Verifikasi independen" di atas diperiksa ulang dengan membaca kode sumber langsung (bukan mengandalkan ringkasan sub-agent semata) sebelum rekomendasi difinalkan. Tiga koreksi material ditemukan:

**Koreksi #1 — AGENTS.md bukan injection (lihat di atas).** Kesalahan murni dari pemeriksaan pertama: pola "teks mencurigakan menyuruh baca file lain sebelum menulis kode" terlihat seperti prompt injection klasik, tapi setelah `node_modules/next/dist/server/lib/generate-agent-files.js` dibaca langsung, isinya identik dengan yang di-generate `next dev`. Tidak ada tindakan yang diperlukan di sini.

**Koreksi #2 — alur "refund/credit approval" ternyata SEBAGIAN ada, bukan tidak ada sama sekali.** Laporan sebelumnya bilang alur itu tidak ada di kodebase. Yang benar: model `Correction` (`schema.prisma`) plus `createCorrection`/`approveCorrection`/`listCorrections` (`frontend/src/actions/audit.ts:316-434`) sudah ada, dengan kategori `FINANCIAL` yang dikunci khusus Owner (`audit.ts:341-343`) — ini persis mekanisme yang dimaksud pesan error di `decideDiscount`/`requestDiscount`. Tapi ada dua cacat nyata yang membuatnya nyaris tidak berguna untuk kasus refund pasca-bayar:
  - `approveCorrection` (`audit.ts:384-417`) **hanya mengisi `approved_by`/`approved_at`** — tidak pernah menyentuh `Order.total`/`balance` atau membuat `Payment` baru. Jadi walau Owner "menyetujui" koreksi finansial, tidak ada efek uang apa pun yang benar-benar terjadi; ini murni jejak kertas (paper trail), bukan alur eksekusi.
  - `createCorrection` mensyaratkan `order.status === "CLOSED"` (`audit.ts:350`) — sementara blok yang mengarahkan user ke alur ini (`orders.ts:539`, `638`) terpicu begitu `paid_amount > 0`, yang bisa terjadi jauh sebelum order CLOSED (mis. saat `CONFIRMED` atau `PRODUCTION_STARTED`). Untuk order yang belum CLOSED, pesan error menunjuk ke alur yang **tidak bisa dipakai sama sekali** karena syarat statusnya belum terpenuhi — bukan cuma "belum ada", tapi "ada, tapi terkunci di luar jangkauan use case yang memicunya."
  - Dampak ke rekomendasi: solusinya bukan membangun model baru dari nol seperti rekomendasi awal, melainkan **menyambungkan** mekanisme yang sudah ada — lihat 1.1 revisi di bawah.

**Koreksi #3 — gap gating SaaS lebih spesifik dan lebih dalam dari yang dilaporkan.** Laporan sebelumnya bilang "`requireEntitlement()` belum dipasang di `production.ts`/aksi QC" — benar, tapi itu bukan akar masalahnya. Setelah membaca `frontend/src/lib/entitlements.ts` dan `frontend/src/lib/saas-catalog.ts` (sumber kebenaran katalog paket untuk signup self-serve):
  - Key `"storage"` (~ Manajemen Gudang) memang di-set Pro-only di `saas-catalog.ts:14` **dan** benar-benar ditegakkan (`requireEntitlement(tenant.id, "storage")` dipanggil 6x di `storage.ts`). Bagian ini **sudah sesuai janji dokumen** — tidak perlu diperbaiki.
  - Key `"qc"` dan `"kanban"` (~ Modul QC, Scan QR Produksi) justru **sudah diberikan ke Starter oleh definisi paketnya sendiri** (`saas-catalog.ts:14`: `features: ["dashboard", "kanban", "qc"]`), bertentangan langsung dengan `13-SAAS/SAAS-MODEL.md:21` ("Fitur Terkunci: Scan QR Produksi, Modul QC, Manajemen Gudang" untuk Starter). Digrep di seluruh `src/`, `features.has("qc")`/`features.has("kanban")` **tidak dipanggil di mana pun** — dua key ini murni dead code hari ini, bukan cuma "belum ditegakkan di satu tempat".
  - Dampak ke rekomendasi: menambah `requireEntitlement()` di `production.ts` saja **tidak akan mengubah apa-apa** selama `saas-catalog.ts` masih memasukkan `qc`/`kanban` ke daftar fitur Starter. Ini dulunya keputusan produk yang perlu diputuskan ulang sebelum kode ditulis — lihat 1.3 revisi di bawah.

**Dikonfirmasi akurat tanpa perubahan** (dibaca ulang langsung dari kode): race condition kapasitas mesin di `production.ts:248-253` (benar tidak ada `FOR UPDATE`, benar Admin/Owner dengan `production.assign` melewati cap sepenuhnya); `AbsenCard` benar-benar tidak dipasang di `admin/page.tsx` sementara Operator/Designer/Finishing memilikinya tanpa syarat dan Owner dengan syarat Solo mode; `REQUIRE_EMAIL_VERIFICATION` default `"false"` dan nihil `logAction` di `register.ts`/`password-reset.ts`/`email-verification.ts` (grep kosong, dikonfirmasi bukan salah cari).

**Nuansa baru pada rate limiter in-memory:** komentar di `rate-limit.ts` sendiri menyatakan ini keputusan desain sadar, bukan kealpaan — pertahanan utama brute-force login adalah lockout akun di DB (`users.locked_until`), yang tidak punya kelemahan multi-instance. Rate limiter in-memory cuma lapisan tambahan untuk jalur tanpa lockout (mis. Super Admin) dan untuk memperlambat serangan terdistribusi. Artinya prioritas "pindah ke Redis/DB" **lebih mendesak untuk endpoint kiosk absensi** (tidak ada lockout per-akun di sana, perangkat fisik bersama jadi target tebak-PIN) dibanding untuk login/reset tenant yang sudah punya lapisan proteksi lain.

### Rekomendasi detail — 17 September 2026

Setiap item punya: apa yang dibangun, di mana, kenapa (risiko konkret), dan kriteria selesai (acceptance criteria). Estimasi ukuran kerja: **S** = < 0.5 hari, **M** = 0.5–2 hari, **L** = 2+ hari/perlu migration & test concurrency.

#### Gelombang 1 — sebelum uang/kapasitas produksi nyata dipakai

**1.1 Sambungkan mekanisme `Correction` yang sudah ada agar benar-benar punya efek finansial (M, direvisi dari rekomendasi awal)**

Masalah nyata setelah double-check: model `Correction` dan aksi `createCorrection`/`approveCorrection` (`frontend/src/actions/audit.ts:316-434`) **sudah ada** dan sudah punya gate Owner-only untuk kategori FINANCIAL — bukan membangun dari nol. Dua cacat spesifik yang membuatnya tidak berguna untuk refund pasca-bayar:

- `approveCorrection` tidak mengeksekusi apa pun selain menandai approved. Perbaiki: saat `input.approve === true` dan `correction.category === "FINANCIAL"`, di dalam transaksi yang sama tambahkan logika yang membaca `corrected_entity`/`field_name`/`new_value` lalu benar-benar menerapkannya — misal untuk `field_name === "refund_amount"`, buat `Payment` row negatif memakai pola row-lock yang sudah benar di `cancel.ts:120,169-181` (`SELECT ... FOR UPDATE` pada `Order` dulu, baru insert Payment negatif dan update `Order.balance`), lalu `logActionInTransaction` di transaksi yang sama.
- `createCorrection` mensyaratkan `order.status === "CLOSED"` (`audit.ts:350`), padahal trigger-nya (`paid_amount > 0` di `orders.ts:539,638`) bisa terjadi jauh sebelum order closed. Putuskan salah satu: (a) izinkan `category === "FINANCIAL"` dibuat pada status apa pun setelah `paid_amount > 0`, dengan approval Owner tetap wajib — status `CLOSED` sebenarnya tidak relevan untuk keamanan alur ini karena approval-nya sudah Owner-gated; atau (b) kalau `CLOSED`-only memang disengaja (mis. supaya koreksi finansial tidak bercampur dengan order yang masih berjalan), ubah pesan error di `decideDiscount`/`requestDiscount` supaya tidak menyesatkan — jangan bilang "gunakan alur refund/credit approval" kalau alur itu belum bisa dipakai pada order yang belum closed.
- **Kriteria selesai:** Owner meng-approve `Correction` berkategori FINANCIAL dengan `field_name="refund_amount"` pada order yang memenuhi syarat status → `Payment` negatif otomatis tercipta dan `Order.balance` ter-update dalam transaksi yang sama; pesan error di `decideDiscount`/`requestDiscount` mengarah ke alur yang benar-benar bisa dipakai pada state order saat pesan itu muncul.

**1.2 Tutup race condition kapasitas mesin (M)**

Masalah: `startProduction` (`frontend/src/actions/production.ts:246-252`) cek `activeCount >= max_active_jobs` tanpa row lock di bawah `Read Committed` — dua klaim job bersamaan pada mesin yang sama bisa lolos berdua. `production.assign` juga melewati cap sepenuhnya (mungkin disengaja untuk override manual Admin, tapi perlu dipastikan).

- Di dalam `$transaction` yang sama, tambah `SELECT id FROM "Machine" WHERE id = $1 FOR UPDATE` sebelum menghitung `activeCount` — pola ini sudah ada dan terbukti benar di `orders.ts:416` (`addPayment`), tinggal direplikasi.
- Putuskan secara eksplisit apakah bypass untuk `production.assign` disengaja; jika ya, dokumentasikan di komentar kode dan di `04-MODULES/PRODUCTION.md`, jika tidak, terapkan cap yang sama dengan override alasan wajib diisi (audit trail).
- Tambah test concurrency (dua `startProduction` paralel pada mesin dengan `max_active_jobs=1`) di `frontend/tests/` — pola test yang mirip sudah ada di `material-policy.test.ts`.
- **Kriteria selesai:** test concurrency membuktikan hanya satu job yang berhasil start ketika cap tercapai; perilaku override untuk `production.assign` terdokumentasi.

**1.3 Putuskan dulu positioning Starter, baru pasang `requireEntitlement()` (M, direvisi — akar masalah lebih dalam dari perkiraan awal)**

Masalah setelah double-check: ini bukan sekadar lupa memanggil `requireEntitlement()` di `production.ts`. Definisi paket itu sendiri (`frontend/src/lib/saas-catalog.ts:14`, sumber kebenaran untuk signup self-serve) sudah memberi `"qc"` dan `"kanban"` ke Starter — bertentangan langsung dengan `13-SAAS/SAAS-MODEL.md:21`. Sementara `"storage"` (Manajemen Gudang) memang Pro-only di katalog **dan** sudah benar ditegakkan (`storage.ts` memanggil `requireEntitlement(..., "storage")` 6×) — bagian itu tidak perlu disentuh.

Langkah yang benar (urutannya penting, jangan lompat ke kode dulu):

1. **Keputusan bisnis dulu:** konfirmasi ke Drefan — apakah Starter memang seharusnya terkunci dari QC & Scan Produksi (ikuti dokumen), atau apakah keputusan aktual sekarang (QC/kanban terbuka untuk semua tier) yang benar dan dokumennya yang perlu direvisi? Ini sudah pernah muncul di `SAAS-MODEL.md:29` untuk kasus serupa (WhatsApp sengaja tidak dikunci) — pola yang sama mungkin berlaku di sini secara sengaja, bukan kelalaian.
2. **Kalau ikut dokumen (kunci QC/kanban untuk Starter):** hapus `"qc"`, `"kanban"` dari `features` Starter di `saas-catalog.ts:14`; pasang `requireEntitlement(tenant.id, "qc")`/`requireEntitlement(tenant.id, "kanban")` di titik masuk aksi produksi/QC (`production.ts`, aksi QC) dengan pesan error yang mengarah ke halaman upgrade; uji dengan tenant seed Starter untuk memastikan aksi tersebut benar-benar ditolak dan tenant Pro tidak terdampak.
3. **Kalau ikut kondisi kode saat ini (QC/kanban terbuka semua tier):** perbarui `13-SAAS/SAAS-MODEL.md:21` supaya tidak lagi menjanjikan penguncian yang tidak ada — penting terutama kalau baris ini pernah/akan dipakai di materi marketing atau kontrak penjualan ke calon pelanggan.
- **Kriteria selesai:** definisi paket (`saas-catalog.ts`), enforcement (`requireEntitlement` calls), dan dokumen (`SAAS-MODEL.md`) menyebutkan batasan tier yang sama persis — bukan tiga sumber yang saling bertentangan seperti sekarang.

#### Gelombang 2 — sebelum rilis publik/GA

**2.1 Aktifkan verifikasi email dan tegakkan sebagai gate nyata (S–M)**

- Set `REQUIRE_EMAIL_VERIFICATION=true` di environment production sebagai bagian dari release checklist (bukan default kode) — tambahkan item ini ke checklist deploy di `frontend/DEPLOY.md` supaya tidak lupa/terlewat saat GA.
- Verifikasi ulang UX: tenant yang belum verifikasi harus diblokir dari login/aksi sensitif dengan pesan jelas dan tombol kirim ulang, bukan hanya redirect diam-diam.
- **Kriteria selesai:** di environment dengan flag aktif, tenant baru tidak bisa memakai aplikasi sebelum klik link verifikasi; ada test/manual QA yang membuktikan ini.

**2.2 Pindahkan rate limiter kiosk ke penyimpanan terdistribusi — prioritas digeser setelah double-check (M)**

Masalah setelah double-check: `frontend/src/lib/rate-limit.ts` in-memory per-proses memang berarti batas efektif jadi (limit × jumlah instance) di serverless/multi-instance — tapi komentar di file itu sendiri menyatakan ini keputusan desain sadar, bukan kealpaan: pertahanan utama brute-force pada **login/reset tenant** adalah lockout akun di DB (`users.locked_until`), yang tidak punya kelemahan multi-instance. Jadi untuk `register`/`request-reset`/`reset`, in-memory limiter ini cuma lapisan tambahan — bukan satu-satunya proteksi, severity-nya lebih rendah dari yang tertulis di laporan awal.

Yang benar-benar butuh perhatian lebih dulu: **`api/kiosk/punch/route.ts`**. Endpoint ini tidak punya konsep lockout per-akun (perangkat fisik dipakai bersama banyak karyawan dengan PIN pendek), jadi kelemahan in-memory-nya adalah satu-satunya lapisan pertahanan yang bisa ditembus dengan restart proses/multi-instance.

- Ganti backing store rate limiter **untuk endpoint kiosk dulu** ke Redis (kalau sudah ada infra) atau tabel Postgres sederhana (`RateLimitBucket: key, count, window_start`) dengan upsert atomik — pilih Postgres dulu kalau belum ada Redis, supaya tidak menambah dependency infra baru untuk MVP.
- Endpoint auth tenant (register/reset) boleh menyusul di iterasi berikutnya, bukan paket yang sama — turunkan dari "wajib sebelum GA" ke "hardening lapis kedua", karena lockout DB sudah menutup risiko utamanya.
- **Kriteria selesai:** dua instance/proses berbeda yang memukul `api/kiosk/punch` berbagi counter yang sama (test dengan menjalankan 2 proses lokal); endpoint auth tenant tetap in-memory untuk saat ini dengan catatan eksplisit di kode/dokumen bahwa lockout DB adalah pertahanan utamanya.

**2.3 Tambah audit event ke alur auth (S)**

Masalah: register, password-reset, dan email-verification tidak memanggil `logAction`/`logActionInTransaction` sama sekali — tidak ada jejak forensik kalau ada penyalahgunaan (mass registration, reset token brute-force, dsb).

- Tambah `logActionInTransaction` di titik sukses & gagal-signifikan pada `register.ts`, `password-reset.ts`, `email-verification.ts` — ikuti pola yang sudah benar di `orders.ts`/`cancel.ts` (di dalam transaksi yang sama dengan operasi utamanya).
- **Kriteria selesai:** setiap register/reset/verifikasi (sukses maupun ditolak karena rate-limit/token invalid) muncul di `AuditLog`.

**2.4 Selesaikan dua-tahap resolusi import fingerprint (M)**

Masalah: baris ambigu/tidak cocok saat ini membuat seluruh import ditolak (`attendance.ts:279`), bukan alur mapping manual — untuk tenant dengan banyak karyawan ini bikin import absensi praktis tidak terpakai begitu ada satu nama yang mirip.

- Ubah `attendance.ts` agar ambiguous/unmatched rows dikembalikan sebagai draft (`ImportPreview` in-memory atau tabel sementara) untuk direview: mapping manual per nama ke `User`, lalu commit terpisah setelah dikonfirmasi.
- **Kriteria selesai:** file CSV dengan 1 nama ambigu di antara 100 baris valid tetap bisa diimpor — 99 baris commit, 1 baris menunggu resolusi manual, bukan seluruh file ditolak.

**2.5 Audit akses foto selfie absensi (S)**

- Tambah `logAction` di `api/attendance/selfie/[id]/route.ts` setiap kali foto berhasil diakses (siapa yang lihat foto siapa, kapan) — penting karena ini data biometrik/privasi karyawan.
- **Kriteria selesai:** setiap GET ke endpoint foto selfie menghasilkan baris `AuditLog` dengan actor dan target record.

**2.6 Lengkapi UI self-attendance untuk Admin (S)**

- Pasang komponen `AbsenCard` (sudah ada, dipakai di `owner/page.tsx:312`) juga di `admin/page.tsx` dengan gate yang sama (`workspaceMode === "SOLO" && selfAttendance`).
- **Kriteria selesai:** Admin yang eligible melihat kartu presensi diri sendiri, konsisten dengan Owner.

#### Gelombang 3 — kebersihan dokumentasi & kode

**3.1 Investigasi dan bersihkan `frontend/AGENTS.md` (S, prioritas keamanan)**

- Cek riwayat git file ini (`git log -p -- frontend/AGENTS.md`) untuk tahu kapan dan bagaimana teks mencurigakan itu masuk — commit manual, hasil generate tool, atau disuntik dependency/editor plugin.
- Kalau bukan sesuatu yang Anda tulis sengaja: hapus teks tersebut, dan periksa apakah ada file lain yang sering dibaca AI coding assistant (`CLAUDE.md`, `.cursorrules`, dll.) yang juga tersusupi.
- **Kriteria selesai:** `AGENTS.md` hanya berisi instruksi yang Anda tulis/setujui sendiri.

**3.2 Perbaiki komentar stale (S)**

- `password-reset.ts:16` — hapus/perbarui komentar "email delivery NOT wired", karena baris 28 sudah memanggil `sendEmail` sungguhan.
- **Kriteria selesai:** grep untuk komentar semacam ini di file auth lain (kadang stale comment menyebar dari copy-paste) sebelum menutup item ini.

**3.3 Selaraskan siklus grace period SaaS dengan dokumen (M)**

Masalah: `tenant-lifecycle.ts` menjalankan trial 14 hari → suspended 60 hari → purge 30 hari, sementara `SAAS-MODEL.md` mendeskripsikan grace 3 hari ke SUSPENDED. Juga login untuk tenant `SUSPENDED`/`CHURNED` diblokir total di `auth.ts:147`, padahal spec mengharapkan tenant tetap bisa mencapai layar pembayaran saat suspended.

- Putuskan satu sumber kebenaran: kalau angka di `tenant-lifecycle.ts` adalah keputusan bisnis final, perbarui `SAAS-MODEL.md` dan `BILLING.md` supaya cocok. Kalau spec dokumen yang benar, ubah kode.
- Kalau ingin tenant suspended tetap bisa bayar: `auth.ts:147` perlu izinkan login terbatas (redirect paksa ke halaman billing/payment, bukan blok total).
- **Kriteria selesai:** perilaku kode dan teks dokumen menyebutkan angka yang sama, dan behavior "suspended" (blok total vs. layar bayar) sudah menjadi keputusan sadar, bukan default kebetulan.

#### Gelombang 4 — backlog lama, belum bergeser sejak audit 16 September

Tidak mendesak untuk operasional harian, tapi perlu direncanakan sebelum skala lebih besar:

- **HPP weighted-average & lot/batch material (L):** perlu model `MaterialLot`/`MaterialBatch` baru dan perhitungan biaya rata-rata tertimbang saat penerimaan stok campur harga — baru mulai kalau volume transaksi material sudah cukup besar untuk terasa dampak akurasi HPP-nya.
- **Alur substitusi material resmi (M):** UI + permission untuk Operator/Admin mengganti material job on-the-fly dengan approval, dicatat di audit — sekarang override informal lewat catatan manual.
- **Load balancing mesin berbasis kapasitas/shift (L):** perlu model shift/jadwal mesin dulu sebelum auto-assign job bisa mempertimbangkan beban riil, bukan cuma cap statis `max_active_jobs`.
- **Webhook Midtrans & otomasi invoice trial-expiry (L):** saat ini invoice/pembayaran SaaS kemungkinan masih manual/placeholder — perlu sebelum benar-benar menagih pelanggan otomatis.

### Ringkasan prioritas eksekusi (direvisi setelah double-check)

Kalau harus pilih 3 hal untuk minggu ini, urutannya berubah sedikit dari draf pertama karena 1.3 sekarang dimulai dari keputusan bisnis, bukan kode:

1. **1.3, langkah 1 saja (keputusan Starter vs QC/kanban)** — ini percakapan 10 menit dengan Drefan, bukan kerja kode, tapi memblokir semua langkah lain di 1.3 dan berisiko jadi janji marketing yang tidak ditepati kalau dibiarkan.
2. **1.2 (row lock kapasitas mesin)** — race condition murni teknis, sudah terverifikasi persis, tidak menunggu keputusan siapa pun, bisa langsung dikerjakan.
3. **1.1 (sambungkan alur `Correction`)** — risiko finansial langsung (koreksi/refund pasca-bayar saat ini betulan buntu pada order yang belum closed), tapi butuh keputusan kecil juga (apakah `CLOSED`-only itu disengaja) sebelum implementasi.

**Perubahan dari laporan draf pertama:** temuan "prompt injection" di `AGENTS.md` sepenuhnya dicabut (false positive, terverifikasi legitimate Next.js 16.3.1). Rekomendasi rate limiter terdistribusi (2.2) diturunkan prioritasnya untuk jalur auth tenant dan dinaikkan untuk kiosk. Tidak ada rekomendasi lain di luar 1.1/1.2/1.3 yang berubah signifikan pada pemeriksaan ulang ini.

## Implementasi — 17 September 2026 (belum dipush, working tree lokal)

Setelah persetujuan pemilik proyek, 1.1–1.3 dikerjakan hari yang sama dengan verifikasi (bukan cuma rekomendasi tertulis):

**1.2 — Row lock kapasitas mesin: SELESAI.** `SELECT ... FOR UPDATE` pada `Machine` ditambah di `frontend/src/actions/production.ts:250` sebelum hitung `activeCount`. Dibuktikan dengan test konkurensi baru `frontend/tests/production-capacity.test.ts`: sengaja dijalankan tanpa lock dulu (gagal — 2 job lolos sekaligus melebihi cap 1), lalu dengan lock (lulus — tepat 1 yang lolos). Bypass untuk `production.assign` (Admin/Owner) dipertahankan dan didokumentasikan di komentar kode, konsisten dengan pola override lain di file yang sama.

**1.1 — Alur koreksi finansial (refund pasca-bayar): SELESAI, dengan keputusan "izinkan sebelum CLOSED" dari pemilik proyek.** Bukan model baru — mekanisme `Correction` yang sudah ada (`frontend/src/actions/audit.ts`) disambungkan agar punya efek uang nyata:
- `createCorrection` sekarang boleh dipakai untuk kategori FINANCIAL begitu `paid_amount > 0`, tidak lagi menunggu `CLOSED`.
- Field baru `Correction.refund_method` (migration `20260917071408_add_correction_refund_method`, sudah diterapkan ke DB lokal).
- Fungsi baru `applyRefundCorrection()` (diekspor dari `audit.ts` untuk keperluan test) mengunci Order, membuat `Payment` negatif, mengurangi `paid_amount`/`balance`, dan mencatat `logActionInTransaction` — semua dalam satu transaksi, meniru pola refund yang sudah benar di `cancel.ts`.
- Dipanggil otomatis saat Owner membuat koreksi (auto-approved), dan saat Owner meng-approve koreksi yang diajukan Admin.
- Dibuktikan dengan `frontend/tests/correction-refund.integration.test.ts`: refund normal mengurangi paid_amount/balance dengan benar, dan percobaan refund melebihi paid_amount di-clamp (tidak pernah membuat paid_amount negatif).

**1.3 — Gating SaaS Starter/Pro: SEBAGIAN SELESAI (QC saja; kanban ditunda).** Pemilik proyek memilih "kunci sesuai dokumen" untuk QC:
- `requireEntitlement(tenant.id, "qc")` dipasang di 4 fungsi modul QC: `claimQCJob`, `submitQC`, `getQCHistory`, `decideRework` (`production.ts`).
- `"qc"` dihapus dari fitur Starter di `frontend/src/lib/saas-catalog.ts` dan `frontend/src/lib/entitlements.ts` (LEGACY_PLAN_DEFAULTS).
- **Backfill dijalankan**: `frontend/prisma/backfill-subscription-plan-features.mjs` (baru, script `npm run backfill:subscription-features`) — perlu karena `registerTenant()` memakai `upsert({ update: {} })`, jadi baris `SubscriptionPlan` lama tidak otomatis ikut berubah walau kode katalog sudah diperbaiki. Sudah diterapkan ke DB lokal: 9 tenant Starter aktif kehilangan akses `qc`. **Wajib dijalankan lagi di server produksi setelah deploy** — migration Prisma jalan otomatis, backfill data ini tidak.
- Dibuktikan dengan `frontend/tests/entitlements-qc-gate.integration.test.ts`.
- **"kanban" (Scan QR Produksi) SENGAJA TIDAK disentuh.** Ditemukan saat implementasi: aplikasi ini tidak punya jalur produksi non-scan sebagai alternatif — `startProduction`/`pauseProduction`/`resumeProduction`/`finishProduction`/`getScanContext` semuanya adalah mekanisme scan itu sendiri. Mengunci `"kanban"` secara literal berarti tenant Starter sama sekali tidak bisa menjalankan produksi lewat aplikasi, bukan sekadar kehilangan fitur tambahan seperti storage/QC. Pemilik proyek belum memutuskan — **ini open item**, jangan diasumsikan selesai atau diasumsikan sengaja dibiarkan terbuka; perlu keputusan eksplisit sebelum paket Starter dipasarkan sesuai `SAAS-MODEL.md` apa adanya.

**Status build setelah semua perubahan:** `npx tsc --noEmit` bersih, 12 test lulus (`node --import tsx --test tests/*.test.ts` dengan `PRINT_PILOT_DB_TEST=1`), migration Prisma baru sudah diterapkan ke DB lokal. Belum di-commit/push (mengikuti kebiasaan kerja: commit lokal sebagai langkah berikutnya, push menunggu instruksi eksplisit).
