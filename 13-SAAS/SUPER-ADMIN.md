# Super Admin Dashboard (printpilot.id)

> Dokumen ini fokus ke **fitur & UI** panel Super Admin. Untuk definisi hak akses per sub-level (SUPER_ADMIN/SUPPORT/FINANCE) dan batasan keamanan, lihat `03-ROLES/SUPER-ADMIN.md`.

Aplikasi Print Pilot akan memiliki dua sisi yang terpisah secara logika dan domain:
1. Sisi Tenant (`namatoko.printpilot.id`) — Digunakan oleh pelanggan.
2. Sisi Super Admin (`printpilot.id/superadmin` atau `admin.printpilot.id`) — Digunakan oleh kita (pembuat/pengelola SaaS).

## 1. Akses Super Admin
- Super Admin login di domain utama, wajib MFA (lihat `03-ROLES/SUPER-ADMIN.md`).
- Akun mereka tersimpan di tabel khusus `super_admins` yang terpisah dari tabel `users` milik tenant. Tujuannya untuk mencegah eskalasi *privilege* jika ada celah keamanan di sisi tenant.
- Setiap akun punya sub-level (`SUPER_ADMIN` / `SUPPORT` / `FINANCE`) yang membatasi fitur mana saja di bawah ini yang bisa diakses — lihat `03-ROLES/SUPER-ADMIN.md` untuk matriks lengkapnya. Fitur-fitur di bawah ini ditulis dari sudut pandang sub-level `SUPER_ADMIN` (akses penuh); sub-level lain punya batasan.

## 2. Fitur Utama Super Admin Panel

### A. Dashboard Utama (Metrics & Analytics)
- **MRR (Monthly Recurring Revenue):** Total estimasi pendapatan per bulan dari seluruh langganan aktif.
- **Tenant Count:** Jumlah tenant aktif, masa trial, suspended, dan churned.
- **System Health:** Status resource server dan API pihak ketiga (WA Provider, Midtrans).

### B. Tenant Management (Daftar Pelanggan)
- Tabel semua percetakan terdaftar (Subdomain, Nama Toko, Owner, Status, Paket Langganan).
- **Aksi pada Tenant:**
  - **Suspend:** Mengunci paksa akun tenant (misal: penipuan atau melanggar TOS).
  - **Activate:** Membuka kembali akun yang tersuspend.
  - **Delete:** Menghapus data tenant (hard delete) untuk bersih-bersih setelah churn 90 hari.

**Penghapusan permanen (hard delete) tidak boleh langsung/manual sepihak.** Sesuai `SAAS-MODEL.md` Section 3, sistem menjalankan urutan wajib berikut sebelum tombol Delete benar-benar menghapus data:
1. Reminder otomatis ke Owner tenant (Email + WA) pada **H-30, H-7, H-1** sejak status `SUSPENDED` menuju batas 90 hari.
2. Tombol **"Ekspor Semua Data"** tersedia untuk Owner tenant sejak `SUSPENDED` hingga sesaat sebelum eksekusi hard delete — mengunduh order, data pelanggan, dan laporan keuangan dalam CSV/PDF.
3. Super Admin hanya bisa mengeksekusi Delete manual lebih awal (sebelum 90 hari) dengan konfirmasi eksplisit (mis. mengetik ulang nama tenant), untuk kasus pelanggaran TOS — bukan alur churn normal.

### C. Fitur "Impersonate" (Login Sebagai...)
- Seringkali tenant melapor, *"Mas, order nomor ORD-123 kok error pas mau dicetak?"*
- Super Admin butuh fitur untuk masuk ke akun mereka tanpa meminta password.
- **Mekanisme Impersonation:**
  1. Super Admin klik "Login as Maju Jaya Print".
  2. Sistem men-generate token session sementara.
  3. Super Admin masuk ke dashboard tenant sebagai role "Owner" (Read-only mode disarankan, kecuali butuh debugging aktif).
  4. Semua aksi saat mode impersonate dicatat di `tenant_audit_logs` dengan keterangan `actor_type = SUPER_ADMIN`.
  5. **Transparansi ke tenant (wajib):** begitu sesi impersonate dimulai, sistem mengirim notifikasi ke Owner tenant (Email + banner di dashboard tenant saat mereka login berikutnya) berisi: nama Super Admin, waktu akses, dan alasan singkat (diisi Super Admin sebelum masuk, mis. "Membantu debug order ORD-123"). Ini menjaga kepercayaan tenant terhadap klaim isolasi & keamanan data di `06-SECURITY/`.

### D. Billing Management
- Rekapitulasi semua invoice (Lunas / Belum Lunas).
- Menangani keluhan pembayaran (contoh: transfer sudah masuk tapi webhook Midtrans gagal). Super Admin bisa klik tombol "Force Mark as Paid" untuk menghidupkan tagihan secara manual.

### E. Broadcast System Notifications
- Mengirim pesan massal yang akan muncul sebagai *banner* di dalam dashboard semua tenant.
- Contoh: *"Maintenance server Sabtu, 22 Agustus pkl 02:00 WIB"* atau *"Fitur baru: Laporan Ekspor Excel telah rilis!"*
