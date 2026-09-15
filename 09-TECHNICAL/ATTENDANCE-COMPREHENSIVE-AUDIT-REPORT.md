# Laporan Audit Komprehensif Fitur Absensi Print Pilot

**Tanggal audit:** 16 September 2026  
**Ruang lingkup:** model data, migrasi, role dan permission, absen HP, kiosk, istirahat, auto-close, impor fingerprint, laporan, payroll, notifikasi, keamanan tenant, serta integrasi dengan pekerjaan operasional.  
**Metode:** inspeksi kode server/client dan dokumen workflow, pemeriksaan migrasi Prisma, query read-only ke database lokal, serta penelusuran alur dari tombol UI sampai transaksi database. Tidak ada data atau kode aplikasi yang diubah dalam audit ini.

## Kesimpulan eksekutif

Fondasi fitur absensi sudah memadai untuk operasi MVP. Waktu punch berasal dari server, setiap punch membawa sumber dan metode, tenant memiliki pengaturan jam kerja, geofence/IP/selfie/kiosk, data dibatasi tenant, dan satu record harian per pegawai sudah dilindungi unique constraint. Operator dan Gudang juga sudah digerbangkan dengan check-in sebelum pekerjaan operasional.

Fitur belum layak disebut siap payroll SaaS multi-tenant tanpa beberapa perbaikan. Risiko terpenting bukan pada tampilan tombol, melainkan pada definisi hari kerja dan identitas data: belum ada timezone per tenant, mulai istirahat tidak memanggil guard eligibility, impor fingerprint dapat menerima nama ambigu atau tidak cocok sebagai record tanpa user, dan statistik produksi di laporan absensi dihitung seumur hidup walaupun laporan diberi rentang tanggal. Dengan prioritas perbaikan yang tepat, alur dapat dipakai untuk operasional harian sebelum fitur payroll difinalisasi.

**Penilaian saat ini:** layak untuk MVP operasional dengan pengawasan Owner; **belum siap untuk payroll otomatis lintas timezone atau rekonsiliasi fingerprint tanpa kontrol tambahan**.

## Tahap 1 — Arsitektur dan sumber kebenaran

### Jalur absensi yang tersedia

1. **HP pribadi dalam aplikasi** melalui `clockIn`, `clockOut`, `startBreak`, dan `endBreak`.
2. **Kiosk tenant** melalui cookie token perangkat, pilihan pegawai, PIN bcrypt, lalu fungsi punch yang sama dengan jalur HP.
3. **Impor CSV fingerprint** sebagai cadangan atau rekonsiliasi. Prioritas data yang dimaksud dokumen adalah `IN_APP/KIOSK`, lalu `MANUAL`, kemudian `FINGERPRINT_IMPORT`.
4. **Catatan Owner** bersifat append-only. Timestamp absensi tidak dapat diedit dari UI.

Pemusatan logika pada `frontend/src/lib/attendance-punch.ts` adalah keputusan yang benar karena HP dan kiosk tidak membuat dua aturan bisnis berbeda. Kelemahannya adalah beberapa guard masih berada di wrapper action, sehingga jalur baru harus selalu dipaksa melewati fungsi policy yang sama.

### Data dan invariant utama

`AttendanceRecord` menyimpan `attendance_day`, timestamp masuk/pulang, status keterlambatan, istirahat, sumber, metode per punch, lokasi, IP, device label, flag geofence/IP, dan status auto-close. Constraint:

```text
UNIQUE (tenant_id, user_id, attendance_day)
```

`User.attendance_eligible` memisahkan kewajiban absensi dari role. Ini cocok untuk SaaS: satu akun bisa memiliki lebih dari satu role, sedangkan keputusan apakah ia pegawai yang wajib absen tetap eksplisit.

`TenantAttendanceSetting` sudah memiliki jam kerja, hari kerja, toleransi absen awal, batas istirahat, geofence, IP allowlist, selfie, kiosk, HP pribadi, retensi selfie, dan jam auto-close. Kolom timezone tenant belum ada.

### Migrasi dan keadaan database

Database lokal memuat 39 migrasi dan migration policy integrity sudah diterapkan. Tidak ditemukan record ganda pada pasangan tenant, user, dan hari kerja saat pemeriksaan read-only. Constraint unik harian sudah menjadi kontrol penting terhadap double punch.

Snapshot database lokal menunjukkan:

- 10 tenant memiliki row pengaturan absensi; seluruhnya masih memakai default `09:00`, batas telat `09:15`, pulang `17:00`, hari kerja Senin–Sabtu, dan batas istirahat 60 menit.
- Tenant `duniapercetakan` memiliki satu record absensi; sudah check-in, belum check-out. Ini konsisten dengan sesi kerja yang sedang terbuka, bukan bukti duplikasi.
- Tidak ada PIN kiosk yang terisi pada snapshot lokal, sehingga alur kiosk belum dapat diuji end-to-end sampai Owner membuat PIN.
- Status `attendance_eligible` tidak seragam antar tenant. Di `duniapercetakan`, akun Admin juga eligible; di tenant lain Admin dapat non-eligible. Ini menunjukkan policy per user sudah ada, tetapi UI dan dokumentasi harus menjelaskan konsekuensinya.

## Tahap 2 — Audit role dan permission

### Owner

Owner dapat melihat ringkasan kehadiran, mengatur policy tenant, mengelola kiosk/PIN, mengatur eligibility, melihat laporan dan selfie, memberi catatan, serta mengunci payroll. Self-attendance Owner hanya muncul pada mode `SOLO` dan preferensi browser `localStorage`. Karena policy sebenarnya berada di server pada `attendance_eligible`, preferensi browser tidak boleh menjadi satu-satunya cara menentukan apakah Owner boleh punch.

### Admin

Admin dapat melihat laporan dan impor CSV melalui pengecekan role langsung. Katalog permission memberi Admin `attendance.view` dan `attendance.self`, tetapi tidak `attendance.configure`. Ini membuat istilah “mengelola absensi” tidak konsisten: action impor menganggap Admin boleh, sedangkan permission catalog tidak memiliki permission impor khusus. Admin yang `attendance_eligible=true` tidak memiliki kartu self-attendance pada dashboard Admin utama, sehingga jalur UI tidak konsisten dengan data policy.

### Designer/Sales

Designer memiliki `attendance.self` dan kartu absensi pada dashboard. Ia tidak memiliki akses laporan atau konfigurasi. Ini sudah sesuai pemisahan tugas. Gate absensi tidak digunakan untuk pekerjaan desain; bila bisnis mengharuskan designer check-in sebelum mengambil job, aturan itu perlu ditulis dan ditegakkan terpisah.

### Operator

Operator memiliki `attendance.self`. `startProduction`, claim QC, dan claim finishing memanggil `requireOperationalCheckIn`; operator eligible harus check-in dan belum check-out sebelum mengerjakan pekerjaan. Guard ini sudah lebih kuat daripada laporan lama.

### Gudang/Finishing

Gudang memiliki `attendance.self`, kartu absensi, dan gate untuk stocktake/storage/pekerjaan operasional. Ini konsisten dengan kebijakan bahwa petugas lapangan harus membuka sesi kerja terlebih dahulu.

### Super Admin/Support

Impersonation kini diblokir oleh `requireAttendanceEligible`, sehingga Support tidak membuat punch yang tampak sebagai kehadiran Owner tenant. Ini adalah kontrol yang benar untuk data payroll. Support masih dapat membaca sesuai jalur read-only; jejak audit tetap perlu memuat aktor asli bila ada aksi bantuan lain.

## Tahap 3 — Audit state machine absensi

### Absen masuk

Urutan server saat ini sudah benar secara umum:

1. Validasi tenant, aktor, role permission, akun aktif, dan `attendance_eligible`.
2. Validasi jalur HP aktif atau kiosk aktif.
3. Validasi batas absen paling awal.
4. Evaluasi IP, geofence, selfie, jam telat, dan hari libur.
5. Buat atau perbarui record hari kerja dan simpan selfie di transaksi.
6. Catat audit log dan kirim notifikasi terlambat secara asynchronous.

Unique constraint melindungi pembuatan row ganda. Namun pemeriksaan awal `findFirst` terjadi sebelum transaksi, sehingga dua request bersamaan masih dapat menghasilkan error database generik atau operasi sampingan yang tidak idempoten. Ini harus diperbaiki sebelum jaringan tidak stabil atau kiosk multi-perangkat dipakai luas.

### Istirahat

`endBreak` sudah memerlukan eligibility, check-in, dan memastikan belum checkout. Batas istirahat dibaca dari setting tenant, bukan konstanta UI. Cron peringatan juga memakai batas tenant.

**Temuan terbuka:** `startBreak` belum memanggil `requireAttendanceEligible`. Ia memang menolak bila tidak ada check-in dan tidak lagi membuat record kosong, tetapi action server tetap tidak memiliki policy guard yang sama dengan `endBreak`, `clockIn`, dan `clockOut`. Endpoint action seharusnya tidak bergantung pada asumsi bahwa tombol hanya terlihat pada UI pegawai.

### Absen pulang

`clockOut` menolak akun yang belum check-in, sesi yang sudah checkout, dan sesi dengan istirahat terbuka. Status `EARLY`/`ON_TIME`, lokasi, IP, dan selfie checkout dicatat.

Flag lokasi/IP saat ini diagregasikan ke `geo_flag` dan `ip_flag`. Laporan belum dapat membedakan apakah flag terjadi saat masuk, pulang, atau keduanya karena belum ada kolom flag per punch.

### Auto-close dan purge

Job `attendance-autoclose` menutup sesi yang lupa checkout, menutup istirahat yang menggantung, dan menghapus selfie melewati retensi. Job idempoten secara praktis karena hanya menargetkan record yang masih terbuka. Namun penentuan “hari sebelumnya” dan jam `work_end` tetap memakai timezone proses server, bukan timezone tenant.

## Tahap 4 — Kiosk, lokasi, IP, selfie, dan keamanan

Kiosk menggunakan token acak panjang; hanya hash SHA-256 yang disimpan. Cookie `HttpOnly`, `SameSite=Lax`, `Secure` mengikuti protokol proxy, dan perangkat dapat dicabut. PIN disimpan bcrypt dan dibatasi 4–6 digit.

Kiosk hanya menampilkan user aktif yang `attendance_eligible=true`, dan punch memakai fungsi server yang sama. Rate limit PIN salah adalah 5 kali per device dan user selama 15 menit; aktivasi token dibatasi 10 kali per IP selama 15 menit.

Risiko yang masih ada:

- Rate limiter berada di memori proses. Pada deployment multi-instance atau setelah restart, batas dapat terlewati. Lockout berbasis akun belum menjadi kontrol database yang kuat untuk kiosk.
- `clientIpFromHeaders` mempercayai `x-forwarded-for` pertama. Ini aman hanya jika reverse proxy membersihkan header dan aplikasi tidak dapat diakses langsung. Kontrak deployment harus menyatakan proxy tepercaya, atau aplikasi harus mengambil IP dari mekanisme proxy yang tervalidasi.
- Endpoint selfie tenant-scoped dan no-store, tetapi akses pembacaan selfie belum menghasilkan audit event khusus. Untuk data biometrik/privasi, Owner/Admin yang membuka selfie sebaiknya tercatat.
- `setEmployeePin` dapat menetapkan PIN untuk user aktif/nonaktif dan eligible/non-eligible tanpa validasi policy. Kiosk memang tidak menampilkan non-eligible, tetapi data yang tidak konsisten masih dapat terbentuk.

## Tahap 5 — Impor fingerprint, laporan, dan payroll

### Impor fingerprint

Kelebihan:

- Preview dan pemetaan kolom tersedia.
- Data in-app/kiosk dipertahankan; impor mengisi celah dan menandai konflik.
- Tenant scope dan audit log import sudah ada.

Risiko:

1. Pencocokan memakai nama atau username ternormalisasi. Jika dua user mempunyai nama yang sama, `Map` terakhir menang tanpa layar resolusi identitas.
2. Nama yang tidak cocok tetap dapat dibuat sebagai record dengan `user_id=null`. Karena kolom user nullable, beberapa “pegawai hantu” dapat masuk laporan dan tidak ikut payroll user mana pun.
3. Permission import memakai `isAdmin(role)` langsung, bukan permission khusus yang sama dengan katalog. Ini perlu keputusan bisnis dan policy eksplisit.
4. Import mencari existing record berdasarkan `date`, sedangkan invariant baru menggunakan `attendance_day`. Keduanya dapat berbeda di dekat pergantian hari atau saat timezone server berbeda.
5. Parser, periode import, filter laporan, dan tampilan tanggal menggunakan waktu lokal proses Node. Tanpa timezone tenant, tanggal fingerprint dapat bergeser.

### Laporan absensi

Laporan sudah menampilkan sumber, status, lokasi, flag, selfie, break, dan ringkasan per pegawai. Akan tetapi query `jobStats` mengelompokkan seluruh `ProductionJob` berdasarkan operator tanpa filter periode laporan. Jika pengguna memilih satu bulan, jumlah job/output/waste dapat tetap mencakup seluruh histori operator. Ini membuat laporan absensi dan kinerja tidak konsisten dengan rentang tanggal yang dipilih.

`getAttendanceReport` juga memfilter `date`, bukan `attendance_day`, sehingga semantik “hari kerja tenant” belum menjadi sumber kebenaran tunggal.

### Payroll

Payroll hanya dapat dibuat/finalisasi oleh Owner dan menyimpan snapshot angka. Perhitungan menggunakan `attendanceRecord.date` dan rentang `new Date(year, month, ...)`, dengan helper bernama `monthRangeUTC` yang sebenarnya membuat Date lokal. Ini adalah risiko yang sama: periode payroll dapat bergeser pada deployment dengan timezone berbeda atau tenant yang berbeda timezone.

Payroll belum memiliki workflow koreksi absensi, persetujuan koreksi, cut-off perubahan, atau rekonsiliasi record `user_id=null`. Sebelum payroll difinalisasi, semua record ambigu harus diblokir atau diselesaikan.

## Temuan prioritas

### P0 — Tidak ada temuan baru

Tidak ditemukan jalur yang saat ini memungkinkan record “istirahat tanpa check-in” dibuat oleh implementasi normal. Temuan P0 pada laporan lama sudah tertutup oleh validasi `existing.check_in`, `check_out`, dan unique harian. Tetap perlu regression test agar tidak terbuka kembali.

### P1 — Perlu ditutup sebelum payroll atau deployment multi-tenant

1. **Timezone tenant belum dimodelkan.** Semua start-of-day, late calculation, workday, import, report, payroll, auto-close, dan notifikasi memakai timezone server. Dampak: tanggal kerja, keterlambatan, hari libur, dan periode gaji dapat salah.
2. **`startBreak` melewati guard eligibility.** Action masih dapat dipanggil langsung oleh user yang tidak memenuhi policy, meskipun harus memiliki check-in yang sudah ada. Dampak: enforcement tidak konsisten antar action.
3. **Impor tidak memaksa resolusi identitas.** Nama ambigu atau unmatched dapat masuk sebagai `user_id=null`; payroll dan KPI dapat salah. Dampak finansial dan audit tinggi.
4. **Laporan kinerja tidak mengikuti rentang tanggal.** `jobStats` tidak membatasi `created_at`/`finished_at` sesuai periode absensi. Dampak: output/waste terlihat lebih besar atau tidak relevan.
5. **Pemisahan permission import/report/settings belum konsisten.** Role check langsung dapat memberi Admin kemampuan yang tidak tercermin di permission catalog, sementara `getAttendanceSettings` tidak memiliki guard read server-side yang eksplisit. Dampak: policy sulit diaudit dan konfigurasi sensitif dapat terbaca dari action.
6. **Punch belum idempoten secara penuh.** Race antara HP dan kiosk atau dua tab dapat menghasilkan error, selfie ganda, atau audit event ganda walaupun row utama tetap satu. Dampak meningkat saat jaringan lambat.

### P2 — Perlu ditutup sebelum skala dan audit eksternal

1. Rate limit kiosk perlu storage terdistribusi atau kontrol DB.
2. Validasi trusted proxy perlu didokumentasikan dan diuji; header IP tidak boleh dapat dipalsukan dari jalur publik.
3. Akses gambar selfie perlu audit event, pembatasan alasan akses, dan kebijakan retensi/backup yang jelas.
4. Tambahkan `check_in_geo_flag`, `check_out_geo_flag`, `check_in_ip_flag`, dan `check_out_ip_flag`, atau struktur punch terpisah, agar sengketa mudah diperiksa.
5. Notifikasi terlambat dan break hanya mencari primary role `owner`; gunakan penerima owner aktif yang efektif termasuk multi-role sesuai policy tenant.
6. Admin yang `attendance_eligible=true` belum mendapat jalur UI self-attendance pada dashboard Admin. Card/quick action harus mengikuti eligibility server, bukan hanya jenis route.
7. Dokumentasi [ATTENDANCE-ROLE-AUDIT-REPORT.md](./ATTENDANCE-ROLE-AUDIT-REPORT.md) memuat temuan lama yang sebagian sudah tertutup. Laporan lama perlu diberi label archived atau diperbarui agar tidak menjadi sumber keputusan yang keliru.

## Rekomendasi implementasi bertahap

### Tahap 0 — sebelum dipakai untuk payroll

1. Tambahkan `timezone` pada `TenantAttendanceSetting`, default `Asia/Jakarta`, validasi IANA timezone, lalu buat helper tunggal `tenantNow`, `tenantDay`, `tenantStart/end`, `tenantMinutesOfDay`, dan `tenantWeekday`. Migrasikan seluruh action, cron, laporan, dashboard, import, dan payroll ke helper ini.
2. Panggil `requireAttendanceEligible` di awal `startBreak` dan validasi `personal_device_enabled` setelah policy. Hapus fallback create record yang sudah tidak mungkin tercapai.
3. Ubah impor menjadi dua tahap: preview harus menampilkan kandidat user; nama ambigu atau tidak cocok wajib dipilih/ditolak sebelum commit. Jangan buat record payroll dengan `user_id=null`.
4. Gunakan `attendance_day` sebagai filter dan key utama laporan/import/payroll. Simpan timestamp punch sebagai UTC, tampilkan berdasarkan timezone tenant.
5. Filter `jobStats` berdasarkan period start/end; tetapkan apakah periode memakai `created_at`, `started_at`, atau `finished_at`, lalu dokumentasikan satu pilihan.
6. Definisikan permission `attendance.import`, `attendance.report`, `attendance.settings.read`, dan `attendance.pin.manage`, lalu ganti role check langsung dengan `can()`.
7. Jadikan punch conditional dan idempoten: update hanya jika field target masih null, gunakan transaksi dengan kondisi status, dan kembalikan hasil record yang sudah ada untuk double-click yang sama. Tambahkan idempotency key per percobaan.
8. Sebelum finalisasi payroll, tolak periode yang memiliki unmatched record, conflict yang belum direview, atau record di luar timezone/period boundary.

### Tahap 1 — hardening produksi

1. Pindahkan rate limit kiosk ke Redis/PostgreSQL atomic counter atau layanan edge.
2. Tetapkan trusted proxy dan validasi header IP pada deployment. Tambahkan test request langsung versus melalui proxy.
3. Audit setiap view selfie, tampilkan alasan akses, dan pastikan backup database mematuhi retensi selfie.
4. Tambahkan halaman “Absensi Saya” yang tersedia untuk semua user eligible, termasuk Admin/Owner yang ditetapkan sebagai pegawai. Kartu dashboard tetap ringkas; detail dapat dibuka dari sidebar.
5. Pisahkan policy “wajib absen” dan “gate pekerjaan” secara eksplisit untuk Designer, Operator, Gudang, dan role gabungan.

### Tahap 2 — kesiapan HR/payroll

1. Tambahkan kalender hari libur, shift, cuti, izin, dan penyesuaian jam kerja per pegawai.
2. Tambahkan permintaan koreksi absensi oleh pegawai, persetujuan Owner, alasan wajib, dan audit trail; jangan mengubah record mentah.
3. Tambahkan cut-off payroll, approval dua langkah bila dibutuhkan, dan snapshot policy yang dipakai saat generate.
4. Sediakan metrik monitoring: punch ditolak per alasan, konflik import, unmatched, auto-close, selfie purge, kegagalan notifikasi, dan latency kiosk.

## Skenario uji penerimaan

Sebelum menyatakan fitur selesai, jalankan dan simpan bukti untuk skenario berikut:

1. User non-eligible memanggil action clock, break, dan kiosk: semuanya ditolak.
2. User eligible check-in dua kali dari dua tab: satu record, satu hasil idempoten, tidak ada selfie ganda.
3. HP dan kiosk punch bersamaan: hasil akhir satu check-in dan audit yang dapat ditelusuri.
4. Start break tanpa check-in, setelah checkout, dan dua klik bersamaan: semua ditolak dengan pesan yang tepat.
5. Break normal, break lewat batas, cron warning, dan auto-close lintas tengah malam.
6. Geofence OFF/FLAG/ENFORCE dengan GPS hilang dan accuracy besar.
7. IP OFF/FLAG/ENFORCE melalui proxy tepercaya dan request langsung.
8. Selfie wajib, selfie invalid, selfie lebih besar dari batas, retensi dan purge.
9. Kiosk token valid, token dicabut, PIN salah lima kali, restart/multi-instance limiter.
10. Admin eligible di dashboard Admin dan Admin non-eligible; keduanya harus mengikuti policy yang sama.
11. Import nama unik, username, nama duplikat, nama tidak cocok, baris ganda, dan import ulang.
12. Konflik fingerprint dengan IN_APP/KIOSK: data utama tidak tertimpa dan konflik wajib direview.
13. Tenant timezone Asia/Jakarta dan timezone lain pada pergantian tanggal, late threshold, workday, auto-close, report, dan payroll.
14. Laporan satu hari/satu bulan: job count, output, waste, dan attendance hanya berasal dari periode yang dipilih.
15. Finalisasi payroll dengan unmatched/conflict: sistem menolak sampai rekonsiliasi selesai.
16. Operator/Gudang eligible tanpa check-in mencoba claim/start/stocktake/storage; semua gate menolak, sedangkan jalur takeover Owner/Admin tercatat sebagai override.

## Status akhir audit

Fitur absensi **sudah memiliki fondasi keamanan dan alur kerja yang baik untuk MVP**, dan beberapa temuan kritis dari laporan lama sudah diperbaiki. Untuk penggunaan harian, Owner dapat mengaktifkan eligibility per pegawai, memilih HP/kiosk, dan mengawasi laporan.

Status yang direkomendasikan adalah **Conditional Go**:

- boleh dipakai untuk absensi operasional dengan review Owner;
- jangan menjadikan hasilnya sumber payroll final lintas tenant sebelum timezone, identitas import, report period, dan atomic punch diperbaiki;
- setelah Tahap 0 dan seluruh skenario uji lulus, lakukan audit ulang singkat lalu baru dorong ke deployment produksi.

### Referensi implementasi utama

- [18-ABSENSI-IN-APP.md](../02-WORKFLOW/18-ABSENSI-IN-APP.md)
- [clock.ts](../frontend/src/actions/clock.ts)
- [attendance-policy.ts](../frontend/src/lib/attendance-policy.ts)
- [attendance-punch.ts](../frontend/src/lib/attendance-punch.ts)
- [attendance.ts](../frontend/src/actions/attendance.ts)
- [attendance-settings.ts](../frontend/src/actions/attendance-settings.ts)
- [kiosk punch route](../frontend/src/app/api/kiosk/punch/route.ts)
- [schema Prisma absensi](../frontend/prisma/schema.prisma)
- [permissions.ts](../frontend/src/lib/permissions.ts)
- [payroll.ts](../frontend/src/actions/payroll.ts)

## Implementasi tahap lanjutan — 16 September 2026

- Timezone tenant ditambahkan pada `TenantAttendanceSetting` dengan default `Asia/Jakarta`; tanggal kerja, batas terlambat, dan jam pulang memakai timezone tenant.
- Clock-in dan clock-out sekarang memakai advisory lock per tenant/user/hari di dalam transaksi sehingga klik ganda atau dua request bersamaan tidak dapat membuat/mengubah punch yang saling bertabrakan.
- Impor dan payroll tetap memerlukan penyelarasan timezone penuh untuk timestamp fingerprint, cut-off periode payroll, serta uji integrasi database production.

Tambahan tahap import fingerprint: parsing tanggal/jam sekarang mengubah waktu lokal perangkat ke instant berdasarkan timezone tenant sebelum menghitung keterlambatan dan menyimpan `attendance_day`. Ini mencegah import dari server UTC menggeser hari kerja tenant. Rekonsiliasi nama tetap menolak nama tidak cocok/ganda dan tidak menimpa punch IN_APP/KIOSK yang lebih dipercaya.
