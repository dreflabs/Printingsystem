# Model Bisnis SaaS & Multi-Tenancy Print Pilot

**Platform Domain:** `printpilot.id`

Dokumen ini mendefinisikan model bisnis Software as a Service (SaaS) untuk Print Pilot, yang memungkinkan banyak percetakan (Tenants) menggunakan satu instansi aplikasi yang sama dengan data yang terisolasi sepenuhnya.

## 1. Konsep Dasar

- **Tenant:** Satu entitas bisnis percetakan. Setiap tenant memiliki satu akun berlangganan.
- **Isolasi Data:** Data percetakan A tidak boleh bisa diakses oleh percetakan B dalam keadaan apapun.
- **Subdomain:** Setiap tenant akan mendapatkan akses melalui subdomain khusus, contoh: `namatoko.printpilot.id`.

## 2. Pricing Tiers (Paket Berlangganan)

Print Pilot menawarkan **3 paket self-serve** bulanan (Starter, Pro, Business) plus **Enterprise** yang dikontrak lewat Sales. Paket self-serve dapat didaftar dan diganti sendiri oleh Owner; Enterprise tidak muncul di form registrasi maupun halaman harga self-serve.

### 🟢 Starter (Rp 199.000 / bulan)
Ditujukan untuk *copy center* atau percetakan kecil yang baru mulai berdigitalisasi.
- **Limit:** Maksimal 3 User, Maksimal 200 Order/bulan.
- **Fitur Termasuk:** Order Management, POS Retail, Kanban Produksi & Dashboard per Peran, Laporan Operasional Harian, Nota Online & Riwayat Pelanggan, Database Pelanggan (termasuk harga makloon), Notifikasi WhatsApp Pelanggan, Peringatan Deadline/Stok/Job Macet.
- **Fitur Terkunci:** QC & Rework, QR Tracking produksi, Manajemen Gudang/Storage, Absensi & Payroll, Inventory Material, Purchase Order, Smart Layout, Laporan Keuangan, Audit Trail.

### 🔵 Pro (Rp 399.000 / bulan)
Ditujukan untuk percetakan menengah yang membutuhkan *workflow* ketat dan sistem anti-fraud.
- **Limit:** Maksimal 5 User, Unlimited Order.
- **Fitur Termasuk:** Semua Starter + QC & Rework, QR Code Tracking, Manajemen Gudang & Pickup/Counter, Inventory Material + Waste & Costing, Absensi & Payroll, Smart Layout Calculator, Laporan Keuangan Lengkap, Audit Trail & Anti-Fraud, Notifikasi WhatsApp Pelanggan.
- **Fitur Terkunci:** Purchase Order & Supplier, Integrasi API, kuota user di atas 5.
- **Roadmap:** Notifikasi WhatsApp Unlimited via API (kunci `whatsapp_unlimited` sudah ada di katalog, kuota API belum ditegakkan).

### 🟣 Business (Rp 799.000 / bulan)
Ditujukan untuk percetakan dengan tim lebih besar, grosir, atau usaha yang mengintegrasikan sistem lain.
- **Limit:** Maksimal 10 User, Unlimited Order.
- **Fitur Termasuk:** Semua fitur Pro + Purchase Order & Supplier, kuota user lebih besar, dukungan prioritas (WA).
- **Roadmap:** Integrasi API (belum ada endpoint publik/API key), kuota WhatsApp lebih besar.

### 👑 Enterprise (Harga Custom, mulai Rp 1.500.000+)
Ditujukan untuk *franchise* atau pabrik cetak multi-cabang. Tidak self-serve — selalu melalui tim Sales.
- **Limit:** Unlimited User, Unlimited Order, Multi-Cabang.
- **Fitur Termasuk:** Semua fitur Business + Dedicated Account Manager (SLA).
- **Roadmap (belum ada di kode):** Custom Domain (contoh: `sistem.namatoko.com`), Laporan Konsolidasi Multi-Cabang, akses API pihak ketiga. Lihat `06-SECURITY/MULTI-TENANT-ISOLATION.md` bagian "Isolasi Sesi di Custom Domain" untuk aturan keamanan saat fitur ini dibangun.

> **Gating fitur:** Starter, Pro, Business, dan Enterprise boleh punya role yang sama, tetapi modul yang tidak ada di entitlement paket ditolak di server. Daftar kunci entitlement ada di `09-TECHNICAL/ENTITLEMENT-GATING.md`; harga dan fitur per paket adalah satu sumber di `frontend/src/lib/saas-catalog.ts`.

## 2b. Siklus Berlangganan & Add-on

Wizard pendaftaran menawarkan pilihan berikut sebelum workspace dibuat:

- **Durasi:** Bulanan, 3 bulan, 6 bulan, atau 12 bulan.
  - Bulanan, 3, dan 6 bulan ditagih penuh (tanpa diskon).
  - **12 bulan: bayar 10 bulan, gratis 2 bulan** (setara diskon ~17%). Tujuan: memperbaiki cash flow platform dan menekan risiko churn akibat `Grace Period` yang pendek (3 hari) pada siklus bulanan.
- **Add-on kursi user:** Rp80.000 per user per bulan di luar kuota paket. Harga sengaja disetara dengan selisih Business − Pro (Rp400 rb untuk 5 kursi = Rp80 rb/kursi) supaya menambah kursi tidak lebih murah daripada naik paket.
  - Harga kursi, batas maksimum kursi, diskon termin, harga layanan, dan jatuh tempo invoice kini **dapat diubah Super Admin** di `/platform/pricing` (tersimpan sebagai `PlatformSetting` key `billing.pricing`), tanpa deploy. Nilai default di kode (`DEFAULT_PRICING_CONFIG`) dipakai sebagai fallback.
- **Harga paket:** sumber kebenaran untuk penagihan adalah baris `SubscriptionPlan` di database (diatur di `/platform/plans`). Invoice memakai harga baris ini, bukan konstanta katalog.
- **Layanan tambahan (jasa):** Instalasi & Training Online (harga list Rp1.500.000) dan Onsite (Rp3.500.000). Keduanya **gratis selama masa promo** Print Pilot; harga list ditampilkan dicoret sebagai pembanding nilai.
- **Voucher:** kode diskon (persen atau nominal) dengan kuota pemakaian dan masa berlaku, dibuat lewat panel Super Admin (`/platform/vouchers`). Voucher dipakai **sekali** pada invoice berikutnya, baik dari wizard pendaftaran maupun halaman Paket & Tagihan.
- **Pembayaran:** saat ini **transfer bank manual** (rekening + upload bukti bayar, diverifikasi Super Admin) — mengikuti alur BIMA. Integrasi payment gateway (Midtrans) **dipending** dan toggle-nya dikunci di `/platform/payments` sampai Snap + webhook siap. Lihat `BILLING.md` bagian 0.
- Enterprise selalu memakai kontrak custom (bukan siklus otomatis Midtrans), diatur manual oleh tim Sales.

Sumber kebenaran harga/termin/layanan ada di `frontend/src/lib/saas-catalog.ts` (`SUBSCRIPTION_TERMS`, `ADDON_SEAT_PRICE_MONTHLY`, `SERVICE_OPTIONS`). Kursi add-on disimpan di `Tenant.addon_users`; termin dan layanan disimpan di `TenantSubscription.term_months` dan `TenantSubscription.service_keys`.

## 3. Tanpa Free Trial: Pembayaran di Muka & Churn Policy

> **Keputusan 2026-09-21:** seluruh fitur free trial dihapus. Tidak ada masa uji coba gratis; tenant baru harus membayar invoice pertama sebelum aplikasi terbuka penuh.

- **Status awal `UNPAID`:** saat mendaftar, tenant langsung dibuat dan **invoice pertama diterbitkan otomatis** dengan rincian paket + termin + kursi add-on + layanan, jatuh tempo **3 hari** (`PAYMENT_DUE_DAYS`). Status tenant `UNPAID`.
- **Akses selama `UNPAID`:** user tetap bisa login, tetapi hanya halaman Paket & Tagihan + invoice + Bantuan. Sisa aplikasi dialihkan ke `/owner/billing` oleh middleware.
- **Aktivasi:** begitu bukti transfer disetujui Super Admin (atau invoice ditandai lunas dari panel platform), status tenant otomatis menjadi `ACTIVE`, periode langganan diisi sesuai termin, dan akses penuh terbuka.
- **Grace Period:** 7 hari setelah jatuh tempo invoice (`UNPAID_GRACE_DAYS`). Banner peringatan tampil sejak hari pertama.
- **Suspension:** jika tetap tidak dibayar setelah tenggang, job lifecycle harian mengubah status menjadi `SUSPENDED`. Semua user tidak bisa login.
- **Data Retention & Penghapusan Bertahap:** jika akun `SUSPENDED` tidak tersentuh selama 60 hari, status menjadi `CHURNED` dan data dijadwalkan untuk dihapus permanen (hard delete) 30 hari kemudian. Sebelum itu, sistem **wajib**:
  - Mengirim reminder bertahap ke Owner via Email + WA pada **H-30, H-7, dan H-1** sebelum penghapusan permanen.
  - Menyediakan tombol **"Ekspor Semua Data"** (order, pelanggan, laporan keuangan dalam CSV/PDF) yang aktif sejak status `SUSPENDED` hingga sesaat sebelum `CHURNED` dieksekusi hard delete.
  - Detail teknis lihat `SUPER-ADMIN.md` Section B.

Catatan data lama: tenant yang sebelumnya berstatus `TRIAL` dikonversi menjadi `ACTIVE` lewat `prisma/backfill-trial-to-active.mjs`. Kolom `Tenant.trial_ends_at` sudah **dihapus** dari skema (migrasi `drop_trial_ends_at`).
