# Spesifikasi Alur Pemulihan Kata Sandi (Forgot Password)

Mengingat Print Pilot beroperasi sebagai sistem Multi-Tenant (SaaS) dengan arsitektur peran (*Role-Based Access Control*) yang ketat, kebijakan pemulihan kata sandi dibedakan menjadi dua alur yang sepenuhnya terpisah demi menjaga keamanan data pabrik/tenant.

---

## 1. Alur Lupa Password untuk OWNER (Pemilik Pabrik)
Owner memiliki hak akses absolut terhadap data tenant (keuangan, laporan, manajemen user). Oleh karena itu, pemulihan sandi Owner harus menggunakan mekanisme *Self-Service* yang divalidasi melalui kepemilikan Email.

### **Langkah-langkah (User Journey):**
1. Owner membuka halaman `http://[tenant].printpilot.id/login`.
2. Klik tautan **"Lupa Password?"**.
3. Sistem meminta Owner memasukkan **Alamat Email** yang terdaftar.
4. **Validasi Backend:**
   - Sistem memeriksa apakah email tersebut valid dan memiliki `role = OWNER`.
   - Jika valid, sistem men-generate **Reset Token** rahasia (berbasis JWT, kedaluwarsa dalam 15 menit).
5. Sistem mengirimkan Email berisi tautan unik: `http://[tenant].printpilot.id/reset-password?token=abc...`
6. Owner mengklik tautan di email.
7. Sistem memvalidasi token. Jika valid, Owner diminta memasukkan **Password Baru** dan **Konfirmasi Password**.
8. Password berhasil diubah. Sesi otentikasi aktif lainnya akan dihentikan secara otomatis (opsional).

### **Keamanan Sistem (Security Measures):**
- **No User Enumeration:** Jika email tidak ditemukan, sistem *tetap menampilkan pesan sukses* ("Jika email terdaftar, tautan reset telah dikirim"). Ini untuk mencegah peretas menebak-nebak email yang terdaftar.
- **Short-lived Token:** Token hanya berlaku maksimal 15 menit.
- **Single-use Token:** Token akan otomatis hangus (tidak bisa dipakai dua kali) setelah password berhasil diubah.

---

## 2. Alur Lupa Password untuk PEGAWAI (Admin, Gudang, Operator, dll)
Pegawai (karyawan) **TIDAK DIIZINKAN** melakukan reset password mandiri via email. Hal ini mencegah risiko pengambilalihan akun pegawai oleh pihak eksternal. Reset password pegawai sepenuhnya menjadi wewenang dan tanggung jawab **Owner**.

### **Langkah-langkah (User Journey):**
1. Pegawai lupa password dan gagal login.
2. Pegawai melapor kepada Owner (atau Admin yang diberi wewenang) secara langsung (offline/WhatsApp).
3. Owner login ke dalam sistem Print Pilot.
4. Owner masuk ke menu **Pengaturan > Manajemen Karyawan**.
5. Owner mengklik tombol opsi (titik tiga) pada baris nama pegawai tersebut, lalu memilih **"Reset Password"**.
6. Sistem akan mereset password pegawai menjadi password *default* yang digenerate oleh sistem (misal: `Print Pilot123!`) atau Owner bisa mengetikkan password sementara.
7. **Flag Force Change:** Sistem menandai akun pegawai tersebut dengan status `must_change_password = true` (atau logika sejenisnya di database).
8. Pegawai mencoba login dengan password sementara tersebut.
9. **Intervensi Sistem:** Setelah login berhasil, pegawai **tidak bisa** masuk ke dashboard, melainkan di-redirect paksa ke layar "Ganti Password Anda".
10. Pegawai memasukkan password baru milik mereka sendiri. Selesai.

---

## 3. Kebutuhan Teknis (Implementasi Selanjutnya)
Untuk mendukung fitur ini pada tahapan implementasi Backend, kita akan membutuhkan:
1. **Email Service:** Integrasi layanan pengirim email (misal: Resend, SendGrid, atau SMTP NodeMailer) untuk mengirimkan link ke Owner.
2. **JWT Secret:** Penggunaan `AUTH_SECRET` di environment untuk men-*sign* dan memverifikasi token reset.
3. **Komponen UI:** 
   - Halaman `/forgot-password` (Input email).
   - Halaman `/reset-password` (Input password baru).
   - Modal Konfirmasi "Reset Password Pegawai" di dalam Dashboard Owner.
   - Halaman "Force Change Password" untuk pegawai yang baru di-reset.
