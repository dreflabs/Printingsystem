# Onboarding Tenant Percetakan

Dokumen ini menjelaskan alur (*flow*) ketika sebuah percetakan baru mendaftar untuk menggunakan layanan Print Pilot SaaS di `printpilot.id`.

## Alur Pendaftaran & Setup (Wizard)

Onboarding dirancang agar mandiri (*self-service*) tanpa campur tangan tim sales, dengan target percetakan bisa langsung beroperasi dalam waktu kurang dari 15 menit.

### Langkah 1: Registrasi Dasar (di Landing Page `printpilot.id`)
- **Input:** Nama Lengkap Pemilik, Email, Nomor WhatsApp Aktif, Password.
- **Aksi:** Sistem mengirim OTP 6 digit ke Email/WA.
- **Validasi:** User memasukkan OTP untuk memverifikasi akun.

### Langkah 2: Setup Identitas Toko
Setelah verifikasi sukses, user masuk ke Wizard Setup:
- **Input:** Nama Percetakan (contoh: "Maju Jaya Print").
- **Subdomain:** Sistem otomatis menyarankan `majujayaprint.printpilot.id` (user bisa mengedit jika tersedia).
- **Informasi:** Alamat toko, Logo (opsional).

### Langkah 3: Setup Shift & Tim Awal
- **Role Pertama:** User pendaftar otomatis menjadi **Owner**.
- **Aksi:** Owner dapat mengundang 1-2 staf inti (misal: 1 Admin, 1 Operator) dengan memasukkan email mereka. Sistem mengirim email undangan dengan link set password.

### Langkah 4: Setup Master Data Minimal
Agar sistem tidak kosong melompong, wizard meminta data krusial:
- **Mesin:** Tambahkan minimal 1 mesin cetak utama.
- **Produk:** Pilih dari template (Banner, Brosur, Stiker) atau buat 1 produk custom.

### Langkah 5: Selesai & Go Live
- User diarahkan ke **Owner Dashboard** di subdomain mereka sendiri (misal: `https://majujayaprint.printpilot.id/owner`).
- Akan muncul banner peringatan masa Trial 7 Hari.

---

## Status Onboarding

Di tabel `tenants`, progress ini dicatat menggunakan tabel `onboarding_steps` untuk keperluan tracking analitik (seberapa banyak user drop-off di langkah ke-3, dst).

* `VERIFIED`
* `WIZARD_DONE`
* `FIRST_ORDER` (Tercapai saat Admin mereka membuat order pertama)
* `FIRST_PRODUCTION` (Tercapai saat Operator mereka menyelesaikan job pertama)
