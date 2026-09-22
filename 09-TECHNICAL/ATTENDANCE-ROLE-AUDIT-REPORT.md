# Laporan Audit Mendalam Fitur Absensi per Role

**Tanggal audit:** 15 September 2026  
**Ruang lingkup:** seluruh role tenant, absensi HP pribadi, kiosk, istirahat, rekap Owner/Admin, import fingerprint, keamanan server, dan konsistensi dokumentasi.  
**Metode:** inspeksi komponen UI, server action, helper punch, API kiosk, cron, schema Prisma, permission catalog, dan dokumen workflow/role.

## Kesimpulan eksekutif

Fondasi absensi sudah cukup baik untuk MVP: waktu berasal dari server, selfie dan lokasi dapat diwajibkan, sumber data dibedakan (`IN_APP`, `KIOSK`, `FINGERPRINT_IMPORT`, `MANUAL`), import memiliki guard konflik, dan laporan Owner/Admin bersifat tenant-scoped. Fitur ini belum siap disebut profesional untuk SaaS multi-tenant sebelum policy siapa yang wajib absen dan enforcement server-side dibuat eksplisit.

Risiko tertinggi berada pada empat hal:

1. Tombol **Mulai Istirahat** dapat membuat record absensi sebelum pegawai melakukan absen masuk. Record tersebut berstatus `UNKNOWN` dan dapat mengubah perhitungan kehadiran.
2. `break_max_min` dapat diubah Owner, tetapi jalur HP pribadi, laporan, dan job peringatan masih memakai batas hard-coded 60 menit. Angka yang dilihat Owner dapat berbeda dari angka yang dipakai sistem.
3. Kartu self-attendance hanya tersedia pada sebagian dashboard, sedangkan action server tidak memiliki permission `attendance.self` atau policy `attendance_eligible`. Role gabungan dan Admin sebagai pegawai dapat memperoleh perilaku yang tidak konsisten.
4. KPI Owner menghitung semua user aktif sebagai pembagi `Belum Absen`, termasuk akun yang secara UI tidak diwajibkan melakukan self-attendance.

Prioritas perbaikan yang disarankan: **P0** untuk integritas record dan konsistensi batas istirahat; **P1** untuk policy role, KPI, timezone, dan concurrency; **P2** untuk UX, privacy, dan operasional skala besar.

## Perilaku aktual setiap role

### Owner

- Mode `TEAM_FULL`: menerima ringkasan hadir, terlambat, belum absen, istirahat berlebih, auto-close, laporan detail, dan pengaturan tenant. Tidak ada kartu self-punch di dashboard utama.
- Mode `SOLO`: dapat mengaktifkan kartu self-attendance melalui toggle browser `localStorage` (`pp_owner_selfattendance`). Ini adalah preferensi perangkat, bukan policy tenant dan bukan setting server.
- Dapat menambah catatan append-only pada record. Owner tidak mengubah timestamp absensi yang sudah ada.
- Dapat mengatur jam kerja, workdays, geofence, IP, selfie, jalur kiosk/HP, retensi selfie, PIN kiosk, dan auto-close.
- Risiko: status self-attendance Owner dapat berbeda ketika berpindah perangkat/browser; ringkasan “belum absen” masih menghitung semua user aktif.

### Admin

- Memiliki menu laporan absensi dan import CSV fingerprint melalui guard server `owner/admin`.
- Tidak memiliki kartu self-attendance di dashboard Admin.
- Tidak memiliki permission `attendance.configure`, tetapi action import memakai pengecekan role langsung. Ini membuat definisi “Admin boleh mengelola absensi” berbeda antara katalog permission dan implementasi.
- Bila Admin juga merupakan pegawai yang wajib absen, tidak ada jalur UI yang konsisten untuk self-punch kecuali membuka dashboard role lain yang dimilikinya.

### Designer/Sales

- Memiliki `AbsenCard` pada dashboard Designer untuk absen masuk, pulang, dan satu sesi istirahat.
- Dapat memakai HP pribadi bila setting mengizinkan; bila HP dimatikan, kartu berubah baca-saja dan mengarahkan ke kiosk.
- Tidak memiliki akses laporan pegawai atau pengaturan absensi.
- Jika memiliki role tambahan (misalnya Admin), dashboard yang sedang dibuka menentukan apakah kartu terlihat; ini bukan keputusan policy terpusat.

### Operator

- Memiliki `AbsenCard` pada dashboard Operator dan tetap dapat mengerjakan job produksi setelah absen.
- Tidak memiliki permission laporan absensi.
- Self-attendance tidak dikaitkan dengan status operator aktif, shift, mesin, atau eligibility; semua itu perlu ditentukan oleh policy staffing, bukan diasumsikan dari role.

### Gudang/Finishing

- Dashboard Finishing memiliki `AbsenCard` untuk self-punch dan istirahat.
- Kartu baca-saja ketika personal device dinonaktifkan, sementara punch harus dilakukan di kiosk.
- Role ini tidak tercantum jelas dalam matriks hak absensi di dokumen role, walaupun UI dan server action mendukungnya.

### Kiosk

- Kiosk diautentikasi dengan token perangkat tenant, lalu pegawai aktif memilih nama dan memasukkan PIN 4–6 digit.
- Validasi tenant, user aktif, PIN bcrypt, rate limit, setting kiosk, selfie, lokasi, jam kerja, dan status punch berjalan di server.
- Semua user aktif tenant yang memiliki PIN dapat dipilih. Tidak ada validasi role atau `attendance_eligible`; kebijakan siapa yang boleh absen lewat kiosk masih implisit.
- Rate limit PIN saat ini in-memory sehingga tidak mencakup beberapa instance/restart aplikasi.

### Super Admin Platform

- Tidak memiliki absensi sebagai user platform sendiri; absensi adalah data tenant.
- Saat melakukan impersonate, `getCurrentUser()` memetakan aktor platform menjadi Owner tenant. Karena action absensi memakai `requireUser()` biasa, Super Admin SUPPORT yang read-only masih dapat menjalankan operasi absensi operasional selama impersonate.
- Ini konsisten dengan catatan kebijakan saat ini (SUPPORT boleh membantu operasi), tetapi berisiko bila absensi dianggap data payroll yang harus hanya berasal dari pegawai. Jejak audit perlu selalu menyimpan identitas Super Admin asli, tenant, alasan, dan jenis aksi.
- **Rekomendasi:** putuskan secara eksplisit apakah SUPPORT boleh melakukan punch/break. Default yang lebih aman untuk payroll adalah blokir self-punch saat `actor.impersonated === true`; bila tetap diizinkan, tampilkan banner dan wajibkan reason code pada audit log.

## Temuan teknis dan dampak

### P0 — Istirahat dapat dimulai sebelum absen masuk

`startBreak()` membuat `AttendanceRecord` baru dengan `check_in_status: "UNKNOWN"` bila belum ada record hari ini (`frontend/src/actions/clock.ts:96-125`). Tidak ada syarat `existing.check_in` dan tidak ada pengecekan checkout. Akibatnya seorang user dapat memiliki baris kehadiran hanya karena menekan “Mulai Istirahat”; KPI hadir, daftar belum absen, laporan payroll, dan auto-close dapat menjadi ambigu.

**Rekomendasi:** tolak mulai istirahat bila belum ada `check_in`; tolak bila sudah `check_out`; gunakan transaksi atomik untuk mencegah dua klik bersamaan. Data lama berstatus `UNKNOWN` perlu ditandai untuk rekonsiliasi sebelum payroll.

### P0 — Batas istirahat tenant tidak konsisten

Owner dapat mengubah `break_max_min` pada `TenantAttendanceSetting` (default 60), tetapi:

- `clock.ts` memakai `BREAK_MAX_MIN = 60` untuk status dan sisa waktu (`frontend/src/actions/clock.ts:29,72,87,147`).
- `AbsenCard` memakai konstanta 60 untuk countdown (`frontend/src/components/dashboard/AbsenCard.tsx:15`).
- `attendance.ts` mengembalikan `breakMaxMin: 60` pada laporan dan memakai threshold tetap 09:15.
- `break-warnings` memakai 45/60 menit dan pesan “1 jam”, tanpa membaca setting tenant.

**Rekomendasi:** baca setting tenant di semua jalur; simpan `warn_at = max(1, break_max_min - 15)` atau jadikan setting terpisah; kirim nilai efektif ke UI, laporan, warning, dan auto-close. Tambahkan regression test untuk tenant dengan batas 45 dan 90 menit.

### P1 — Tidak ada policy eksplisit `attendance.self`

Katalog permission hanya memiliki `attendance.view` dan `attendance.configure`. Action self-punch (`getMyAttendanceToday`, `clockIn`, `clockOut`, `startBreak`, `endBreak`) hanya memanggil `requireUser()`. Visibility kartu ditentukan oleh route dashboard, sedangkan kiosk hanya memeriksa user aktif dan PIN.

**Dampak:** role gabungan, Admin yang juga bekerja sebagai kasir, Owner yang ikut produksi, atau role baru di masa depan tidak mendapat perilaku yang dapat diprediksi.

**Rekomendasi:** tambahkan policy tenant/user `attendance_eligible` atau permission `attendance.self`. Evaluasi di server, bukan hanya tombol UI. Default yang aman: Designer, Operator, Gudang wajib; Admin/Owner opsional sesuai policy tenant; user non-pegawai atau akun layanan dikecualikan. Kiosk dan HP harus memakai policy yang sama.

### P1 — KPI “Belum Absen” dapat salah

`getOwnerDashboard()` menghitung `activeUsers` dari semua user aktif lalu mengurangkan user yang punya record (`frontend/src/actions/queries.ts:500-501,532-568`). Karena UI self-attendance tidak tersedia untuk Admin dan Owner mode tim, angka “Belum Absen” dapat memasukkan akun yang memang tidak diwajibkan absen.

**Rekomendasi:** hitung denominator dari daftar attendance-eligible pada tanggal tersebut; tampilkan numerator, denominator, dan pengecualian hari libur/role. Gunakan data yang sama untuk dashboard Owner, laporan, dan notifikasi.

### P1 — Hari kerja dan timezone belum menjadi policy tenant

Banyak helper memakai `new Date()` dan `setHours(0,0,0,0)` dari timezone proses. Schema setting tidak memiliki timezone tenant. Pada SaaS dengan tenant di zona waktu berbeda, batas hari, late-after, workdays, auto-close, dan tanggal laporan dapat bergeser.

**Rekomendasi:** tambahkan `timezone` IANA per tenant, misalnya `Asia/Jakarta`, dan gunakan utilitas date terpusat untuk seluruh punch, cron, laporan, dan import. Simpan timestamp UTC, tetapi hitung hari kerja berdasarkan timezone tenant.

### P1 — Race condition dan duplikasi record harian

`todayRecord()` melakukan `findFirst` lalu transaksi membuat/memperbarui record. Schema `AttendanceRecord` hanya memiliki index, bukan unique constraint `(tenant_id, user_id, date)`. Dua request paralel dari double-click, dua tab, atau HP dan kiosk dapat lolos pemeriksaan awal.

**Rekomendasi:** normalisasi kolom `attendance_day` (tanggal tenant) dan unique constraint `(tenant_id, user_id, attendance_day)`; gunakan upsert/serialisasi transaksi dan idempotency key per punch. Audit record duplikat yang sudah ada.

### P1 — Guard server self-attendance belum eksplisit

`requireUser()` memvalidasi sesi, tetapi tidak memvalidasi `active` pada lookup sesi tenant (`frontend/src/lib/actor.ts:149-169`). Action clock juga tidak memeriksa role/policy. Sesi lama yang masih valid berpotensi tetap melakukan punch setelah user dinonaktifkan, tergantung jalur autentikasi dan invalidasi token.

**Rekomendasi:** `requireUser()` atau guard attendance membaca ulang `active`, tenant, dan `attendance_eligible` sebelum setiap punch; tolak user nonaktif. Tetap pertahankan check tenant pada setiap query record.

Untuk mode impersonate, guard yang sama harus membedakan aktor Owner tenant dari identitas Super Admin platform agar tindakan bantuan tidak terlihat sebagai punch pegawai biasa.

### P1 — Rekap laporan memakai aturan hard-coded

`getAttendanceReport()` mengembalikan threshold 09:15 dan `breakMaxMin` 60, bukan setting tenant aktif. Import juga menghitung terlambat dengan konstanta 09:15 (`frontend/src/actions/attendance.ts`).

**Rekomendasi:** hitung status import memakai setting tenant untuk periode tanggal terkait; bila setting berubah, simpan snapshot policy pada record/import agar hasil historis tidak berubah diam-diam.

### P2 — Flag IP checkout tidak disimpan

`performClockOut()` mengevaluasi geofence, tetapi hanya menggabungkan `geo_flag`; `ip_flag` tidak diperbarui dari IP saat pulang. Record dapat menunjukkan IP masuk aman walaupun pulang dari jaringan yang tidak diizinkan.

**Rekomendasi:** simpan `check_out_ip_flag` terpisah atau gunakan aggregate `ip_flag = rec.ip_flag || !ipAllowed(...)` dengan audit detail per punch.

### P2 — Owner notification hanya primary Owner

Notifikasi terlambat dan break berlebih mencari user dengan `role.name = "owner"`. Extra role Owner atau delegasi kebijakan tidak ikut menerima notifikasi.

**Rekomendasi:** gunakan semua user aktif yang memiliki role efektif Owner dan nomor HP, lalu deduplikasi penerima.

### P2 — Privasi selfie dan lokasi perlu governance operasional

Selfie disimpan langsung sebagai `Bytes` di database dan dilihat dari laporan Admin/Owner. Retensi sudah dapat diatur, tetapi belum ada bukti pada UI bahwa pegawai menyetujui tujuan, siapa yang dapat melihat, dan kapan data akan dihapus. Kiosk mengandalkan PIN plus selfie; PIN tetap dapat dititipkan.

**Rekomendasi:** tampilkan notice singkat sebelum kamera pertama kali dipakai, batasi endpoint selfie dengan permission dan tenant check, log akses selfie, tampilkan tanggal purge, dan sediakan prosedur sengketa. Pertimbangkan object storage terenkripsi ketika volume SaaS meningkat.

### P2 — Rate limit kiosk belum terdistribusi

Rate limit PIN memakai memori proses. Pada multi-instance, percobaan dapat berpindah instance; restart juga menghapus state.

**Rekomendasi:** Redis/managed rate limiter dengan key tenant+device+user, lockout progresif, dan audit event percobaan gagal.

### P2 — Dokumentasi role belum menuliskan hak absensi

Dokumen Owner/Admin/Designer/Operator/Gudang belum memiliki matriks hak self-punch, kiosk, laporan, dan pengaturan yang sama dengan implementasi. Dokumen workflow menyebut kartu hanya pada Designer/Operator/Finishing, tetapi tidak menjelaskan Admin yang merangkap pegawai atau policy Owner SOLO.

**Rekomendasi:** tambahkan satu sumber kebenaran policy absensi dan referensikan dari seluruh dokumen role, bantuan aplikasi, dan permission catalog.

## Policy bisnis yang disarankan

Gunakan tiga konsep terpisah:

- **Role:** tanggung jawab bisnis, misalnya Operator atau Designer.
- **Attendance eligibility:** apakah user wajib melakukan absensi pada tenant tertentu.
- **Attendance channel:** HP pribadi, kiosk, atau keduanya.

Dengan begitu satu tenant kecil dapat menjadikan Owner sekaligus Operator, sedangkan tenant besar dapat mengecualikan Owner/Admin dari daftar pegawai tanpa membuat role baru. User multi-role cukup memiliki satu kebijakan eligibility dan satu aturan sumber waktu.

Default policy yang disarankan:

- Owner: `optional`, dapat diaktifkan bila ikut bekerja operasional.
- Admin: `optional`, aktif bila Admin juga dijadwalkan sebagai pegawai/kasir.
- Designer/Sales: `required`.
- Operator: `required`.
- Gudang/Finishing: `required`.
- Akun nonaktif, akun layanan, dan user tanpa assignment kerja: `excluded`.

Server harus menegakkan policy yang sama pada HP, kiosk, break, laporan, KPI, payroll, dan notifikasi. UI hanya merefleksikan keputusan server.

## Alur profesional yang disarankan

1. Owner memilih timezone, workdays, jam kerja, batas istirahat, channel, dan daftar attendance-eligible.
2. User eligible melakukan absen masuk melalui HP/kiosk; server menilai waktu, geofence, IP, selfie, hari kerja, dan idempotency.
3. Tombol istirahat hanya aktif setelah check-in dan sebelum check-out; satu sesi istirahat per hari sesuai policy.
4. Absen pulang hanya setelah istirahat selesai; server menyimpan status pulang cepat/tepat waktu dan flag per punch.
5. Cron mengirim warning berdasarkan `break_max_min` tenant, melakukan auto-close dengan timezone tenant, dan menghapus selfie sesuai retensi.
6. Owner melihat KPI berdasarkan denominator eligible; Admin melihat laporan sesuai permission; koreksi tetap append-only dan tidak mengubah timestamp asli.
7. Import fingerprint mengisi celah atau membuat konflik untuk ditinjau, tanpa menimpa data in-app/kiosk yang lebih dipercaya.

## Rencana perbaikan berurutan

### P0 — sebelum dipakai untuk payroll

- Blokir break sebelum check-in dan setelah checkout.
- Satukan `break_max_min` di server, UI, laporan, warning, dan auto-close.
- Audit dan tandai record `UNKNOWN` yang dibuat oleh break tanpa check-in.

### P1 — sebelum onboarding banyak tenant

- Tambah policy `attendance_eligible` dan permission `attendance.self`.
- Scope KPI/laporan/notifikasi ke eligible user.
- Tambah timezone tenant dan utilitas tanggal terpusat.
- Tambah unique constraint/idempotency untuk satu record per user per hari.
- Validasi `active` serta tenant secara eksplisit pada setiap self-punch.
- Selaraskan `attendance.view`/`attendance.configure` dengan action import, report, dan settings.

### P2 — peningkatan profesional

- Pindahkan kartu besar menjadi quick action header/sidebar dengan modal detail, sesuai laporan penempatan. Sidebar quick action sudah diterapkan untuk Designer, Operator, dan Gudang/Finishing; versi ringkas di header masih menjadi pekerjaan berikutnya.
- Tambah audit akses selfie, consent notice, dan kebijakan retensi yang terlihat.
- Gunakan rate limiter terdistribusi untuk kiosk.
- Tambah shift per user, kalender libur, dan eskalasi notifikasi yang dapat dikonfigurasi.
- Dokumentasikan matriks role/policy dan skenario Admin/Owner yang merangkap pegawai.

## Skenario penerimaan yang wajib diuji

- User eligible mencoba mulai istirahat sebelum check-in: harus ditolak dan tidak membuat record.
- Dua tab menekan Absen Masuk bersamaan: tepat satu record dibuat.
- HP dan kiosk menekan Absen Masuk pada waktu hampir sama: satu berhasil, satu mendapat pesan idempoten.
- Tenant mengatur istirahat 45 menit dan 90 menit: countdown, warning, status, laporan, dan auto-close mengikuti setting masing-masing.
- Admin tanpa eligibility: tidak muncul di denominator “Belum Absen” dan kiosk menolak PIN bila policy mensyaratkan.
- Admin dengan eligibility: memperoleh kartu/quick action dan masuk denominator.
- Owner SOLO berpindah browser: policy server tetap konsisten, tanpa bergantung `localStorage`.
- User dinonaktifkan setelah login: punch berikutnya ditolak.
- Tenant timezone bukan timezone server: late, tanggal, workday, cron, dan laporan tetap benar.
- Import fingerprint bentrok dengan in-app: nilai in-app dipertahankan dan konflik terlihat Owner.
- Selfie lama melewati retensi: tidak dapat diakses lagi setelah job purge.

## Status audit

Audit ini menjadi dasar implementasi tahap integritas/policy pada 15 September
2026: `attendance_eligible`, `attendance_day`, guard self-punch, validasi break,
batas tenant, KPI eligible, filter kiosk, dan quick action **Absensi Saya** pada
sidebar dashboard Designer, Operator, serta Gudang/Finishing sudah diterapkan.
Timezone tenant, quick action ringkas di header, privacy consent, dan rate limiter
terdistribusi masih menjadi tahap berikutnya. Laporan penempatan UI sebelumnya
tetap berlaku dan dapat dibaca di
[ATTENDANCE-PLACEMENT-AUDIT-REPORT.md](ATTENDANCE-PLACEMENT-AUDIT-REPORT.md).
