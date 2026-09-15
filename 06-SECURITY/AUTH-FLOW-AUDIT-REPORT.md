> Status implementasi: Temuan kritis pada laporan historis di bawah telah ditangani sebagian besar melalui checkpoint 24d94c26; bagian penutup memuat gap yang tersisa.

# Laporan Audit Registrasi, Login, dan Forgot Password

Tanggal audit: 14 September 2026  
Ruang lingkup: halaman registrasi, `registerTenant`, NextAuth Credentials, middleware, session/JWT, `requestPasswordReset`, `resetPassword`, force password change, rate limit, tenant isolation, dan dokumentasi keamanan.

## Kesimpulan

Alur login dasar sudah memiliki fondasi yang baik: password di-hash bcrypt cost 12, workspace wajib disebut, pencarian user dibatasi `tenant_id`, cookie dikelola NextAuth, lockout akun tersedia, dan token reset disimpan sebagai hash.

Alur ini belum siap dianggap aman dan profesional untuk produksi. Forgot password saat ini tidak benar-benar mengirim email di production, registrasi belum melakukan verifikasi email/OTP seperti yang dijanjikan dokumen, dan perlindungan brute-force/spam belum lengkap. Ada juga ketidaksesuaian penting antara dokumentasi dan kode.

## Temuan kritis

### Kritis — Forgot password tidak berfungsi di production

`frontend/src/actions/password-reset.ts:18-32` menyatakan provider email belum terpasang. `deliverResetLink()` hanya menulis link ke console saat development dan hanya menulis error saat production. Owner tidak pernah menerima link reset di lingkungan production.

Dampak: akun Owner yang lupa password tidak dapat dipulihkan melalui alur yang tersedia. Ini adalah kegagalan fungsi utama, bukan sekadar kekurangan UX.

Perbaikan: pasang provider email transaksional, gunakan template reset yang aman, fail closed jika provider tidak sehat, dan jangan pernah menulis token mentah ke log production.

### Tinggi — Registrasi publik belum diverifikasi email/OTP

`frontend/src/actions/register.ts:61-75` dan komentar implementasinya menyatakan email belum diverifikasi. Namun `13-SAAS/TENANT-ONBOARDING.md` menjanjikan OTP email/WA sebelum workspace aktif. Saat ini siapa pun dapat membuat tenant dengan email yang bukan miliknya.

Dampak: tenant spam, subdomain squatting, akun Owner tanpa bukti kepemilikan kontak, dan pemulihan akun yang tidak dapat diandalkan.

Perbaikan: buat status `PENDING_VERIFICATION`, simpan OTP/token yang di-hash dengan TTL pendek dan single-use, kirim melalui provider, lalu aktifkan tenant hanya setelah verifikasi.

### Tinggi — Tidak ada rate limit untuk registrasi dan password reset

Login memiliki limiter in-memory per identifier di `frontend/src/lib/auth.ts:57`, tetapi `registerTenant()` dan `requestPasswordReset()` tidak memiliki rate limit. Dokumentasi juga menjanjikan rate limit login per-IP, sedangkan implementasi tidak mengambil IP untuk login credentials.

Dampak: spam pembuatan tenant, spam reset email, pembebanan bcrypt/database, dan credential stuffing terdistribusi.

Perbaikan: gunakan limiter terdistribusi berbasis Redis/edge untuk kombinasi IP, workspace, email, dan device fingerprint ringan. Beri limit berbeda untuk registrasi, request reset, dan submit reset.

## Temuan tinggi

### Tinggi — TTL token reset berbeda dari dokumentasi

`frontend/src/actions/password-reset.ts:16` menetapkan TTL **1 jam**, sementara `06-SECURITY/FORGOT-PASSWORD.md:16` menetapkan **15 menit**. Untuk akun Owner, gunakan TTL paling ketat yang sudah disepakati, yaitu 15 menit.

### Tinggi — Token belum atomic single-use terhadap request bersamaan

`resetPassword()` membaca token valid, kemudian dalam transaksi terpisah memperbarui password dan menandai token. Dua request paralel dapat sama-sama lolos pemeriksaan sebelum salah satunya menulis `used_at`.

Perbaikan: lakukan conditional update `WHERE id = ... AND used_at IS NULL AND expires_at > now()` dan pastikan hanya satu row ter-update sebelum mengganti password, atau gunakan transaksi serializable dengan row lock.

### Tinggi — Password reset tidak memakai kebijakan password yang sama

Registrasi dan force change mewajibkan minimal 8 karakter serta kombinasi huruf dan angka. `resetPassword()` hanya memeriksa panjang minimal 8 karakter (`password-reset.ts:100-103`). Owner dapat mengganti password menjadi password yang lebih lemah daripada aturan registrasi.

Perbaikan: satu fungsi `validatePasswordStrength()` harus dipakai oleh registrasi, reset, force change, dan change password.

### Tinggi — Link reset tidak tenant-specific seperti dokumentasi

Link dibangun dari `APP_URL` global (`password-reset.ts:23`, `:78`) dan bukan subdomain tenant seperti yang dijelaskan dokumen. Fungsionalitas token tetap dapat bekerja jika APP_URL benar, tetapi konfigurasi salah dapat mengarahkan user ke host yang tidak sesuai atau localhost.

Perbaikan: simpan tenant slug pada token/session reset, bangun origin dari allowlist domain resmi, dan tolak host yang tidak dikenal.

## Temuan menengah

### Dokumentasi onboarding belum sesuai implementasi

`13-SAAS/TENANT-ONBOARDING.md` masih menyebut OTP, verifikasi email, undangan staf lewat email, dan trial 7 hari. Implementasi registrasi membuat tenant langsung berstatus `TRIAL`, tidak memverifikasi email, dan trial yang dipakai kode adalah 14 hari. Dokumen harus diperbarui atau fitur harus dilengkapi.

### Reset token belum dibatalkan saat perubahan status/role Owner

Token reset yang sudah diterbitkan tetap valid sampai kedaluwarsa walaupun role Owner diubah atau akun dinonaktifkan. Login memang tetap diblokir jika user nonaktif, tetapi token sebaiknya dicabut pada perubahan sensitif.

### Audit event auth belum lengkap

Login platform dicatat ke platform audit, tetapi request reset, reset berhasil/gagal, dan verifikasi registrasi belum memiliki jejak audit yang setara. Tambahkan actor anonim/IP ter-hash, tenant, hasil, dan correlation ID tanpa menyimpan token mentah.

### Logout semua device bergantung pada pemeriksaan actor

`password_changed_at` sudah dinaikkan dan `getCurrentUser()` memvalidasi timestamp token terhadap database. Ini bekerja untuk Server Actions yang memanggil actor, tetapi route yang hanya membaca JWT atau endpoint lama perlu diaudit agar tidak melewati pemeriksaan tersebut.

## Pemeriksaan per alur

### Registrasi

- Validasi format email, password, nama, dan slug sudah ada.
- Bcrypt cost 12 sudah sesuai.
- Tenant dan Owner dibuat dalam satu transaksi.
- Unique tenant slug menjadi perlindungan terakhir terhadap duplikasi.
- Belum ada verifikasi kepemilikan email/WA, rate limit, CAPTCHA/risk check, atau pembersihan reserved subdomain.

### Login

- Workspace wajib dan query user dibatasi tenant.
- Pesan UI generik sehingga enumeration dasar cukup baik.
- Lockout database tersedia setelah 5 kegagalan dengan durasi bertahap.
- Limiter hanya in-memory dan per identifier, bukan per-IP seperti dokumentasi.
- Email Super Admin diproses sebelum login tenant; email yang sama pada dua konteks dapat menghasilkan perilaku login yang membingungkan.

### Forgot password dan reset

- Email/workspace divalidasi dan respons sukses menyamarkan user enumeration.
- Raw token tidak disimpan di database; hanya SHA-256 yang disimpan.
- Token lama untuk user yang sama dibatalkan saat request baru.
- Provider produksi belum ada, TTL tidak sinkron, belum ada rate limit, password policy berbeda, dan single-use belum atomic.

## Urutan perbaikan yang disarankan

1. Pasang provider email production dan hentikan logging token mentah.
2. Terapkan OTP/token verifikasi registrasi sebelum tenant aktif.
3. Satukan validasi password dan ubah TTL reset menjadi 15 menit.
4. Buat reset token benar-benar atomic single-use dan cabut token pada perubahan akun sensitif.
5. Tambahkan rate limit terdistribusi untuk login per-IP, registrasi, forgot password, dan reset password.
6. Sinkronkan `FORGOT-PASSWORD.md`, `TENANT-ONBOARDING.md`, `SAAS-MODEL.md`, dan acceptance criteria dengan kode aktual.
7. Tambahkan test matrix untuk tenant sama/berbeda, owner/pegawai, token kedaluwarsa, token dipakai dua kali, reset paralel, akun nonaktif, dan Support impersonation.

## Validasi

- Pemeriksaan statis terhadap auth, middleware, register, password reset, session, dan dokumentasi keamanan telah dilakukan.
- Server development sebelumnya dapat dijalankan pada `127.0.0.1:3000`; smoke request pada sesi audit ini tidak dilakukan karena proses server sudah berhenti.
- Temuan di atas berasal dari perilaku kode dan perbandingan langsung dengan dokumen, bukan asumsi UI.

## Implementasi tahap lanjutan — 16 September 2026

Perbaikan berikut telah diterapkan:

- `User.email_verified_at` dan `EmailVerificationToken` ditambahkan. Migrasi membackfill akun lama sebagai verified agar tidak memutus akses tenant existing.
- Registrasi produksi membutuhkan provider email dan mengirim token verifikasi hashed, single-use, TTL 24 jam. Login tenant menolak Owner baru yang belum verified.
- Route `/verify-email` mengonsumsi token secara atomic dan tersedia alur kirim ulang dengan rate limit.
- `password-reset` tetap memakai TTL 15 menit, kebijakan password terpusat, dan conditional update atomic.

Hal yang masih perlu diselesaikan pada tahap berikutnya: rate limit terdistribusi berbasis Redis/edge, audit event auth anonim, health check provider email, serta sinkronisasi dokumen onboarding/trial dengan konfigurasi bisnis final.

## Kebijakan beta/trial

Atas keputusan produk, verifikasi email dibuat **opt-in** selama fase uji coba. Registrasi langsung dapat dipakai ketika `REQUIRE_EMAIL_VERIFICATION` tidak bernilai `true`. Saat product release, set `REQUIRE_EMAIL_VERIFICATION=true` bersama konfigurasi provider email untuk mengaktifkan gate verifikasi.
