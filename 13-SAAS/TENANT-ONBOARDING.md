# Onboarding Tenant Percetakan

Dokumen ini menjelaskan alur (*flow*) ketika sebuah percetakan baru mendaftar untuk menggunakan layanan Print Pilot SaaS di `printpilot.id`.

## Alur Pendaftaran & Setup (Wizard)

Onboarding dirancang agar mandiri (*self-service*) dengan target percetakan bisa langsung beroperasi dalam waktu kurang dari 15 menit. Wizard pendaftaran terdiri dari **6 langkah** (diimplementasikan di `frontend/src/app/(auth)/register/page.tsx`).

### Langkah 1: Akun Owner
- **Input:** Nama Lengkap Pemilik, Email, Nomor WhatsApp (opsional), Password.
- Password wajib minimal 12 karakter dan mengandung huruf + angka.
- **Beta:** Registrasi langsung dapat digunakan tanpa verifikasi email wajib (`REQUIRE_EMAIL_VERIFICATION=false`).
- **Release:** Jika provider email sudah siap, sistem mengirim tautan verifikasi sekali pakai dan login baru memerlukan email terverifikasi.

### Langkah 2: Profil Percetakan
- **Input:** Nama Percetakan (contoh: "Maju Jaya Print"), subdomain, alamat/kota (opsional), dan ukuran tim.
- **Subdomain:** Sistem otomatis menyarankan `majujayaprint.printpilot.id` (user bisa mengedit).
- Persetujuan Syarat & Ketentuan + Kebijakan Privasi wajib dicentang.
- Ukuran tim ditanyakan dua tingkat: **"Saya sendiri"** atau **"Dengan tim"** (lalu "Tim kecil 2–5" atau "Tim per divisi 6+"). Jawaban menentukan:
  - `Tenant.workspace_mode` — tampilan navigasi & beranda untuk akun Owner (bukan izin; izin tetap berbasis role).
  - Default dua kebijakan alur kerja: pada **Tim per divisi**, order tidak auto-release (perlu rilis Admin) dan serah terima wajib konfirmasi counter. Pada mode lain keduanya longgar.
  - Saran paket minimum di langkah berikutnya: bila kuota user paket lebih kecil dari perkiraan jumlah orang, wizard menyarankan paket lebih besar atau menambah kursi add-on.
- **Bisa diubah kapan saja** di **Pengaturan Toko → Tampilan Workspace**, dengan opsi menyinkronkan kedua kebijakan alur kerja. Nudge di dashboard Owner juga menyarankan perpindahan mode saat jumlah pegawai aktif berubah (SOLO ↔ Tim kecil ↔ Tim per divisi).

### Langkah 3: Pilih Paket
- Tiga paket self-serve (Starter/Pro/Business) ditampilkan dengan harga, kuota, dan fitur utama; bisa diganti tanpa kehilangan isian sebelumnya.
- **Validasi silang dengan ukuran tim:** paket yang kuota usernya lebih kecil dari perkiraan jumlah orang diberi peringatan, dan paket pertama yang cukup ditandai "Cukup untuk tim Anda". Perkiraan memakai batas bawah rentang (solo 1, tim kecil 2, tim per divisi 6).
- Enterprise tidak muncul — kontraknya lewat Sales.

### Langkah 4: Durasi & Kapasitas
- **Durasi:** Bulanan, 3, 6, atau 12 bulan (12 bulan bayar 10).
- **Kursi user tambahan:** Rp80.000/user/bulan di luar kuota paket, tersimpan di `Tenant.addon_users`.

### Langkah 5: Layanan & Ringkasan
- **Layanan tambahan:** Instalasi & Training Online / Onsite. Harga list ditampilkan dicoret dan gratis selama masa promo.
- **Ringkasan Pesanan:** rincian per baris, total tagihan pertama, dan catatan bahwa invoice pertama terbit otomatis dengan jatuh tempo 3 hari serta pembayaran dikonfirmasi manual oleh tim.
- Menekan **Buat Workspace** memanggil `registerTenant()` (satu transaksi): Tenant (`UNPAID`), TenantSubscription (`term_months`, `service_keys`), user Owner dengan SEMUA role operasional sebagai `extra_roles`, seed material starter, pengaturan absensi default, `OnboardingStep.WIZARD_DONE`, dan `TenantAuditLog` berisi rincian pilihan langganan. Invoice pertama diterbitkan setelah transaksi ini.

### Langkah 6: Selesai & Go Live
- User diarahkan ke **Owner Dashboard** di subdomain mereka sendiri (misal: `https://majujayaprint.printpilot.id/owner`).
- Muncul banner **belum dibayar** (status `UNPAID`) yang mengarahkan ke halaman tagihan; akses penuh terbuka setelah pembayaran diverifikasi.
- Tenant yang sebelumnya berstatus `TRIAL` dikonversi ke `ACTIVE` (lihat `prisma/backfill-trial-to-active.mjs`).
- Penyiapan lanjutan (undang staf, tambah mesin, buat produk) dilakukan lewat checklist di dalam dashboard, bukan di wizard pendaftaran.

---

## Status Onboarding

Di tabel `tenants`, progress ini dicatat menggunakan tabel `onboarding_steps` untuk keperluan tracking analitik (seberapa banyak user drop-off di langkah ke-3, dst).

* `VERIFIED`
* `WIZARD_DONE`
* `FIRST_ORDER` (Tercapai saat Admin mereka membuat order pertama)
* `FIRST_PRODUCTION` (Tercapai saat Operator mereka menyelesaikan job pertama)
