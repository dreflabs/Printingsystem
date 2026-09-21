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
- **Input:** Nama Percetakan (contoh: "Maju Jaya Print"), subdomain, alamat/kota (opsional), dan ukuran tim (solo / kecil / per divisi).
- **Subdomain:** Sistem otomatis menyarankan `majujayaprint.printpilot.id` (user bisa mengedit).
- Persetujuan Syarat & Ketentuan + Kebijakan Privasi wajib dicentang.
- Ukuran tim menentukan `Tenant.workspace_mode` (tampilan navigasi/beranda, bukan izin).

### Langkah 3: Pilih Paket
- Tiga paket self-serve (Starter/Pro/Business) ditampilkan dengan harga, kuota, dan fitur utama; bisa diganti tanpa kehilangan isian sebelumnya.
- Enterprise tidak muncul — kontraknya lewat Sales.

### Langkah 4: Durasi & Kapasitas
- **Durasi:** Bulanan, 3, 6, atau 12 bulan (12 bulan bayar 10).
- **Kursi user tambahan:** Rp80.000/user/bulan di luar kuota paket, tersimpan di `Tenant.addon_users`.

### Langkah 5: Layanan & Ringkasan
- **Layanan tambahan:** Instalasi & Training Online / Onsite. Harga list ditampilkan dicoret dan gratis selama masa promo.
- **Ringkasan Pesanan:** rincian per baris, total tagihan pertama, dan catatan bahwa invoice pertama terbit otomatis dengan jatuh tempo 3 hari serta pembayaran dikonfirmasi manual oleh tim.
- Menekan **Buat Workspace** memanggil `registerTenant()` (satu transaksi): Tenant (TRIAL), TenantSubscription (`term_months`, `service_keys`), user Owner dengan SEMUA role operasional sebagai `extra_roles`, seed material starter, pengaturan absensi default, `OnboardingStep.WIZARD_DONE`, dan `TenantAuditLog` berisi rincian pilihan langganan.

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
