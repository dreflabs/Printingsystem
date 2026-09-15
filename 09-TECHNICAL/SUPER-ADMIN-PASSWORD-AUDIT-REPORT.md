# Laporan Audit Password Super Admin Print Pilot

**Tanggal audit:** 16 September 2026  
**Ruang lingkup:** siklus hidup password Super Admin, bootstrap/reset di Coolify, login platform, lockout, sesi, audit log, multi-account, deployment secret, serta prosedur pemulihan.  
**Metode:** inspeksi kode, schema Prisma, migration, dokumentasi deploy, dan penelusuran output terminal yang diberikan. Tidak ada perubahan kode atau database yang dilakukan dalam audit ini.

## Kesimpulan eksekutif

Fondasi password Super Admin sudah lebih aman daripada password tenant biasa: password disimpan sebagai hash bcrypt 12 rounds, password minimal 12 karakter, login salah dikunci bertahap, login memakai pesan error generik, sesi platform dibatasi 12 jam, dan status akun divalidasi ulang ke database.

Ada empat risiko yang perlu ditutup sebelum sistem dianggap siap untuk akses platform yang sensitif:

1. Reset password melalui `bootstrap-superadmin.mjs` mengubah database langsung tetapi tidak menulis `PlatformAuditLog`.
2. Reset password tidak otomatis mencabut sesi JWT Super Admin yang sudah terbit; sesi lama dapat tetap berlaku sampai batas 12 jam.
3. MFA/OTP platform sengaja dihapus, sehingga akun dengan akses seluruh tenant hanya memakai email dan password.
4. Rate limiter login disimpan di memori proses. Pada multi-instance Coolify atau setelah restart, batas per-instance dapat dilewati; lockout database tetap menjadi lapisan kedua, tetapi belum atomic terhadap percobaan paralel.

**Status:** password dapat dipakai untuk MVP dengan prosedur break-glass yang ketat, tetapi **belum ideal untuk produksi SaaS multi-tenant tanpa MFA dan revokasi sesi saat reset**.

## 1. Peta alur password saat ini

### Pembuatan atau reset melalui Coolify

Script `frontend/prisma/bootstrap-superadmin.mjs`:

1. Membaca `SUPER_ADMIN_EMAIL` dan menormalisasi ke huruf kecil.
2. Mencari akun pada tabel `SuperAdmin`.
3. Tanpa `SUPER_ADMIN_RESET_PASSWORD=true`, akun yang sudah ada tidak disentuh.
4. Dengan flag reset, password wajib diisi, minimal 12 karakter, mengandung huruf dan angka, lalu di-hash dengan bcrypt 12 rounds.
5. Reset mengaktifkan akun, mengosongkan `failed_login_count`, dan menghapus `locked_until`.
6. Untuk akun baru, script membuat role `SUPER_ADMIN` dan akun aktif.

Script tidak menghapus tenant atau data lain. Ini benar dan lebih aman daripada menjalankan `prisma db seed` di produksi. Dokumentasi deploy juga sudah memperingatkan agar `SUPER_ADMIN_PASSWORD` dihapus setelah selesai.

### Login platform

`frontend/src/lib/auth.ts` menerima email dan password melalui `/platform/login`.

- Email Super Admin dicari pada tabel terpisah dari user tenant.
- Akun nonaktif ditolak.
- Akun yang `locked_until` masih berlaku ditolak.
- Password dibandingkan dengan bcrypt.
- Lima kegagalan berturut-turut memulai lockout 15 menit; kegagalan berikutnya memperpanjang durasi sampai maksimum 60 menit.
- Login berhasil mengosongkan counter dan lockout, memperbarui `last_login_at`, dan menulis `LOGIN_SUCCESS`.
- Login gagal dan akun terkunci menulis `LOGIN_FAILED` atau `LOGIN_LOCKED`.

### Sesi platform

Session memakai JWT. `getPlatformActor()` tidak hanya mempercayai JWT: ia membaca ulang akun Super Admin ke database dan menolak akun nonaktif. Sesi platform lebih tua dari 12 jam juga ditolak.

Kontrol ini baik untuk menonaktifkan akun, tetapi reset password tidak mengubah nilai yang menjadi dasar invalidasi sesi. Akibatnya, sesi lama yang dicuri masih dapat bertahan sampai 12 jam setelah password diganti.

### Reset melalui panel

Super Admin yang sudah login dapat mereset password akun lain melalui `platform-admins.ts`. Jalur ini memakai validator yang sama, bcrypt 12 rounds, mengosongkan lockout, dan menulis `SUPER_ADMIN_PASSWORD_RESET`. Menonaktifkan akun juga dibatasi agar tidak menonaktifkan satu-satunya Super Admin aktif.

### Pemulihan darurat

Jika semua akun terkunci atau hanya ada satu akun, pemulihan dilakukan melalui terminal aplikasi dengan `npm run bootstrap:superadmin`. Jalur ini memang diperlukan, tetapi harus diperlakukan sebagai break-glass operation: akses Coolify/VPS, perubahan database, dan penghapusan secret harus tercatat secara operasional.

## 2. Kontrol yang sudah baik

- Password tidak disimpan plaintext; hanya `password_hash` yang disimpan.
- Bcrypt memakai 12 rounds pada bootstrap dan panel.
- Password contoh yang diketahui bocor diblokir pada production.
- Akun baru dan reset wajib melewati validasi panjang dan karakter.
- Kesalahan login ditampilkan generik sebagai “Email atau kata sandi salah.”
- Ada lockout berbasis database (`failed_login_count`, `locked_until`).
- Ada rate limit tambahan 10 percobaan per identifier dalam 15 menit.
- Login sukses mengosongkan counter dan lockout.
- Sesi platform dibatasi 12 jam dan status akun diperiksa ulang ke database.
- Aktivasi/nonaktif akun dan reset melalui panel memiliki audit event platform.
- Bootstrap tidak menghapus data tenant; seed produksi secara eksplisit dilarang.
- Coolify deployment guide meminta `SUPER_ADMIN_PASSWORD` dihapus setelah bootstrap.

## 3. Temuan audit

### P1 — Reset password tidak mencabut sesi platform lama

`SuperAdmin` tidak memiliki `password_changed_at` atau `session_version`. JWT hanya membawa `platformLoginAt`, lalu `getPlatformActor()` memeriksa umur sesi dan status aktif. Reset password melalui bootstrap maupun panel tidak membuat sesi lama menjadi tidak valid.

**Dampak:** jika cookie sesi pernah dicuri, pemegangnya masih dapat memakai panel sampai 12 jam walaupun password sudah diganti.

**Perbaikan:** tambahkan `password_changed_at` atau `session_version` pada `SuperAdmin`; masukkan nilainya ke JWT; pada setiap `getPlatformActor()` tolak token lama. Reset password harus menaikkan versi atau memperbarui timestamp.

### P1 — Tidak ada MFA untuk Super Admin

Dokumentasi menyatakan MFA/OTP dihapus pada 8 September 2026. Saat ini akses seluruh tenant hanya dilindungi email dan password.

**Dampak:** phishing atau kebocoran password langsung membuka panel platform.

**Perbaikan:** aktifkan WebAuthn/passkey atau TOTP dengan recovery code. Minimal, batasi panel melalui VPN/IP allowlist dan wajibkan re-authentication untuk tindakan berisiko seperti purge tenant, reset Super Admin, dan billing.

### P1 — Bootstrap reset tidak menulis audit platform

`bootstrap-superadmin.mjs` langsung memanggil `prisma.superAdmin.update/create`. Ia tidak memakai `logPlatform()`, sehingga reset darurat tidak menghasilkan event `SUPER_ADMIN_PASSWORD_RESET` atau identitas operator di `PlatformAuditLog`.

**Dampak:** audit panel tidak dapat membuktikan siapa yang melakukan reset dan kapan, kecuali log Coolify disimpan terpisah.

**Perbaikan:** buat tabel/event break-glass yang menerima actor deployment atau `SYSTEM_BREAK_GLASS`, timestamp, email target, IP/terminal identity bila tersedia, alasan, dan hash referensi incident. Jangan pernah menyimpan password.

### P1 — Secret password dapat tertinggal di konfigurasi Coolify

Jika password dimasukkan sebagai Environment Variable resource, nilainya dapat tetap tersimpan di konfigurasi deployment atau terlihat oleh anggota yang memiliki akses Coolify. Dokumentasi sudah meminta penghapusan, tetapi tidak ada guard yang memastikan secret benar-benar dihapus.

**Perbaikan:** gunakan input interaktif hanya di Terminal, jangan commit ke `.env`, hapus variable setelah bootstrap, redeploy/restart bila diperlukan, dan batasi akses Coolify ke operator tepercaya.

### P2 — Rate limit login masih in-memory dan hanya per identifier

`rateLimit()` menyimpan state di memori Node. Multi-instance atau restart dapat mengosongkan counter. Kunci juga tidak menggabungkan IP/device. Lockout database menjadi lapisan kedua, tetapi update counter belum diserialisasi dengan transaksi atau conditional update.

**Perbaikan:** gunakan Redis/PostgreSQL atomic counter per email+IP; pertahankan lockout database sebagai kontrol akun; uji percobaan paralel.

### P2 — Aturan password dapat drift dan belum memeriksa password bocor

Validator TypeScript dan bootstrap `.mjs` menggandakan daftar aturan. Keduanya dapat tidak sinkron pada perubahan berikutnya. Validasi hanya memeriksa minimal 12 karakter, huruf, angka, dan empat password contoh.

Bcrypt juga memiliki batas efektif sekitar 72 byte. Tidak ada batas panjang atau normalisasi yang terdokumentasi, sehingga dua password sangat panjang dapat diperlakukan sama setelah bagian yang terpotong.

**Perbaikan:** satu sumber aturan, batas panjang byte yang jelas atau pre-hash SHA-256 sebelum bcrypt, password denylist yang lebih luas, pemeriksaan breached-password lokal/terkontrol, dan pencegahan reuse password terakhir.

### P2 — Audit log bersifat best-effort

`logPlatform()` sengaja tidak melempar jika penulisan audit gagal. Ini mencegah login gagal hanya karena logger bermasalah, tetapi tindakan sensitif seperti reset, deactivate, purge, dan billing dapat terjadi tanpa jejak audit yang pasti.

**Perbaikan:** gunakan outbox/event queue atau transaksi untuk aksi yang membutuhkan bukti wajib; login biasa boleh best-effort, tetapi reset dan perubahan hak harus memiliki jalur retry dan alert.

### P2 — Satu akun dapat menjadi single point of failure

Sistem mencegah menonaktifkan satu-satunya Super Admin aktif, tetapi tidak memaksa adanya akun cadangan. Jika satu akun terkunci dan akses Coolify hilang, pemulihan bergantung pada akses database/server.

**Perbaikan:** buat minimal dua Super Admin terpisah, gunakan email berbeda, simpan recovery code, dan uji rotasi akses secara berkala.

## 4. Analisis percobaan reset di Coolify

Berdasarkan output yang diberikan:

1. Container sudah berada di `/app` dan file bootstrap ada.
2. Percobaan pertama memakai `read -s`; `/bin/sh` Coolify menolak opsi `-s`.
3. `export SUPER_ADMIN_PASSWORD` kemudian mengekspor variabel kosong.
4. Script berhenti pada validasi `SUPER_ADMIN_PASSWORD wajib diisi`.
5. Perintah `printf` berikutnya hanya mencetak teks password ke terminal; tidak mereset database.
6. Tanda kutip/backslash yang salah menyebabkan beberapa perintah tergabung dan masuk prompt lanjutan.

**Kesimpulan insiden:** dari output yang diberikan tidak ada bukti password Super Admin berhasil diubah. Password yang sempat dicetak harus dianggap kompromi dan tidak boleh dipakai lagi. `stty -echo` hanya mengubah tampilan terminal; ia tidak memengaruhi database atau password aplikasi.

## 5. Panduan pemulihan Coolify yang berurutan

### A. Persiapan

1. Buka **Coolify → Project → Resource aplikasi → Terminal**. Gunakan container aplikasi, bukan resource PostgreSQL.
2. Jalankan `pwd`; hasil harus `/app` atau direktori yang berisi `prisma/bootstrap-superadmin.mjs`.
3. Jangan menaruh password di command, `printf`, chat, Git, atau Environment Variable permanen.
4. Buat password baru unik minimal 20 karakter menggunakan password manager. Semua password yang pernah tampil di terminal/chat dianggap tidak aman.

### B. Masukkan password tanpa menuliskannya ke history

Jalankan satu baris berikut:

```sh
printf 'Password baru: '; stty -echo; read SUPER_ADMIN_PASSWORD; stty echo; printf '\n'; export SUPER_ADMIN_PASSWORD
```

Saat prompt muncul, ketik password baru lalu tekan Enter. Karakter tidak terlihat. Jangan menambahkan password ke dalam baris command.

Verifikasi hanya statusnya:

```sh
[ -n "$SUPER_ADMIN_PASSWORD" ] && echo "Password terisi" || echo "Password kosong"
```

### C. Reset akun

```sh
SUPER_ADMIN_EMAIL="admin@printpilot.id" SUPER_ADMIN_RESET_PASSWORD=true npm run bootstrap:superadmin
```

Output yang benar harus menyatakan password direset, kunci dibuka, dan akun diaktifkan. Jika output mengatakan password kosong, jangan lanjut login; ulangi tahap B.

### D. Bersihkan secret dan verifikasi aplikasi

```sh
unset SUPER_ADMIN_PASSWORD
```

Jika `SUPER_ADMIN_PASSWORD` pernah dibuat di **Coolify Environment Variables**, hapus variable tersebut dari resource dan lakukan redeploy/restart sesuai alur Coolify. Kemudian buka `/platform/login` dalam private window dan login dengan password baru.

### E. Pemeriksaan pasca-reset

- Pastikan login berhasil.
- Pastikan login dengan password lama ditolak.
- Pastikan halaman `/platform` dapat dibuka.
- Periksa **Platform → Activity** untuk event login.
- Catat waktu reset di change log internal karena bootstrap saat ini belum menulis audit event aplikasi.
- Jangan mengirim password atau screenshot password kepada siapa pun.

## 6. Rencana perbaikan teknis

### Prioritas 0 — segera

1. Rotasi password yang pernah terlihat.
2. Hapus `SUPER_ADMIN_PASSWORD` dari Coolify environment setelah reset.
3. Pastikan minimal dua Super Admin aktif dengan email berbeda.
4. Batasi akses Coolify dan database hanya ke operator tepercaya.

### Prioritas 1 — sebelum produksi penuh

1. Tambahkan revokasi sesi berbasis `password_changed_at`/`session_version`.
2. Aktifkan WebAuthn/passkey atau TOTP dan recovery code.
3. Tambahkan audit wajib untuk bootstrap/break-glass reset.
4. Ganti limiter memori dengan limiter terdistribusi.
5. Serialisasi counter lockout agar percobaan paralel tidak kehilangan update.

### Prioritas 2 — hardening berkelanjutan

1. Satukan validator bootstrap dan panel.
2. Tetapkan batas panjang berbasis byte dan kebijakan password reuse/breach.
3. Jadikan reset, deactivate, dan purge memakai audit outbox yang dapat dipantau.
4. Tambahkan alert untuk login gagal berulang, lockout, reset, perubahan akun, dan login dari IP baru.
5. Uji pemulihan dua kali setahun dan simpan runbook break-glass offline.

## Status akhir

Implementasi password Super Admin **tidak menunjukkan kebocoran plaintext di database** dan percobaan Coolify yang gagal tidak mengubah password. Namun akses platform masih single-factor dan reset password belum memutus sesi lama atau menghasilkan audit aplikasi untuk jalur bootstrap.

Gunakan status **Conditional Go**: reset password dapat dilakukan melalui runbook di atas, tetapi jadwalkan revokasi sesi, MFA, dan audit break-glass sebelum panel dipakai untuk operasi SaaS penting atau akses produksi yang luas.

### Referensi implementasi

- [bootstrap-superadmin.mjs](../frontend/prisma/bootstrap-superadmin.mjs)
- [auth.ts](../frontend/src/lib/auth.ts)
- [platform.ts](../frontend/src/lib/platform.ts)
- [platform-admins.ts](../frontend/src/actions/platform-admins.ts)
- [platform-audit.ts](../frontend/src/lib/platform-audit.ts)
- [super-admin-password.ts](../frontend/src/lib/super-admin-password.ts)
- [DEPLOY.md](../frontend/DEPLOY.md)

## Post-fix verification — 16 September 2026

Perbaikan yang diterapkan setelah audit:

- `SuperAdmin.password_changed_at` ditambahkan melalui migration `20260916030000_superadmin_session_revocation`.
- Login membawa timestamp perubahan password ke JWT; `getPlatformActor()` menolak token yang lebih lama dari timestamp database.
- Reset melalui panel dan bootstrap menaikkan timestamp sehingga sesi platform lama langsung tidak berlaku.
- Bootstrap create/reset sekarang menulis audit event platform dalam transaksi yang sama dengan perubahan akun.
- Validator password menolak password di atas 72 byte agar tidak ambigu dengan batas bcrypt.
- Aktivasi kembali akun juga mencabut sesi lama dengan menaikkan timestamp password.
- Reset menolak password yang sama dengan password saat ini, dan limiter in-memory memakai kombinasi identifier + IP.
- `npx prisma validate`, `npx prisma generate`, `npx tsc --noEmit`, ESLint file terkait, dan migration deploy lokal berhasil.

MFA tetap tidak diaktifkan sesuai keputusan pemilik; login tetap email + password satu langkah. Rate limiter terdistribusi, password history/breach service, dan MFA berada di backlog hardening karena memerlukan keputusan/infrastruktur tambahan.
