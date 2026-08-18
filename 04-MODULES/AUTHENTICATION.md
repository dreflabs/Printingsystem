# AUTHENTICATION

Tidak ada file `02-WORKFLOW` tunggal yang sepadan untuk modul ini — spesifikasi berikut adalah sumber kebenaran untuk Authentication. Rujukan silang: kebijakan lockout login ada di `03-ROLES/USER-MANAGEMENT.md`, dan stack teknis di `09-TECHNICAL/TECH-STACK.md`.

## Jenis Session

Menggunakan **server session via NextAuth v5 (Auth.js)**, bukan JWT stateless murni:
- Session token disimpan sebagai HTTP-only cookie, `Secure`, `SameSite=Strict` (lihat `06-SECURITY/DATA-PROTECTION.md`)
- NextAuth v5 default memakai JWT untuk isi cookie session, tapi validasi role/permission tetap dicek server-side di setiap API route (bukan hanya percaya klaim di token) — konsisten dengan aturan "server-side authorization wajib" di `09-TECHNICAL/TECH-STACK.md`
- Tidak ada data sensitif disimpan di localStorage/sessionStorage

## Durasi Session

- Session expiry: **8 jam** (satu shift kerja), sesuai `06-SECURITY/DATA-PROTECTION.md`
- Logout otomatis di semua device jika password diubah

## Hashing Password

- Algoritma: **bcrypt (minimum cost factor 12)** atau **Argon2id**, sesuai `06-SECURITY/DATA-PROTECTION.md`
- Tidak ada penyimpanan password plaintext atau reversible-encrypted di database maupun log

## Alur Aktivasi Akun Baru

1. Owner membuat user baru lewat panel User Management (lihat `03-ROLES/USER-MANAGEMENT.md`)
2. Sistem generate password sementara acak
3. Owner memberikan password sementara ke pegawai secara langsung (offline, bukan email/WA)
4. Field `must_change_password = true` di-set untuk user baru
5. Saat login pertama kali, sistem memaksa ganti password sebelum bisa mengakses fitur lain
6. Setelah ganti password berhasil, `must_change_password` di-reset ke `false`

## Lockout Login

Kebijakan lockout sudah didefinisikan di `03-ROLES/USER-MANAGEMENT.md` — bagian "Keamanan Login":
- 5x gagal login berturut-turut → akun terkunci otomatis 15 menit
- Setelah 3x terkunci berturut-turut dalam sehari → butuh unlock manual oleh Owner
- Field terkait: `failed_login_count`, `locked_until` di tabel `users`

## Owner 2FA

Fitur opsional, khusus untuk akun dengan role `owner` (tidak berlaku untuk role lain):

- Metode: **TOTP** (Time-based One-Time Password) via aplikasi authenticator (Google Authenticator, Authy, dsb.) — tidak memakai SMS OTP karena bergantung pada provider eksternal yang tidak reliable
- Aktivasi: Owner mengaktifkan sendiri dari halaman profil/keamanan akun — sistem generate QR code + secret key untuk di-scan aplikasi authenticator
- Setelah aktif, login Owner memerlukan dua langkah: (1) username + password, lalu (2) kode TOTP 6-digit dari aplikasi authenticator
- Recovery codes: sistem generate 8–10 kode backup satu-kali-pakai saat aktivasi, untuk kondisi Owner kehilangan akses ke aplikasi authenticator
- Menonaktifkan 2FA memerlukan re-autentikasi password (dan kode TOTP aktif, jika masih tersedia)
- Field tambahan di tabel `users`: `totp_secret` (terenkripsi), `totp_enabled` (boolean), `totp_recovery_codes` (hashed, array)
- Setiap login dengan 2FA (berhasil maupun gagal) tercatat di `audit_logs`
