# Model Bisnis SaaS & Multi-Tenancy Print Pilot

**Platform Domain:** `printpilot.id`

Dokumen ini mendefinisikan model bisnis Software as a Service (SaaS) untuk Print Pilot, yang memungkinkan banyak percetakan (Tenants) menggunakan satu instansi aplikasi yang sama dengan data yang terisolasi sepenuhnya.

## 1. Konsep Dasar

- **Tenant:** Satu entitas bisnis percetakan. Setiap tenant memiliki satu akun berlangganan.
- **Isolasi Data:** Data percetakan A tidak boleh bisa diakses oleh percetakan B dalam keadaan apapun.
- **Subdomain:** Setiap tenant akan mendapatkan akses melalui subdomain khusus, contoh: `namatoko.printpilot.id`.

## 2. Pricing Tiers (Paket Berlangganan)

Print Pilot menawarkan 3 tingkatan (tier) berlangganan bulanan:

### 🟢 Starter (Rp 299.000 / bulan)
Ditujukan untuk *copy center* atau percetakan kecil yang baru mulai berdigitalisasi.
- **Limit:** Maksimal 5 User, Maksimal 200 Order/bulan.
- **Fitur Termasuk:** Order Management dasar, POS Retail, Role dasar (Admin, Operator), Notifikasi WhatsApp Otomatis (kuota template dasar, terbatas).
- **Fitur Terkunci:** Scan QR Produksi, Modul QC, Manajemen Gudang.

### 🔵 Pro (Rp 599.000 / bulan)
Ditujukan untuk percetakan menengah ke atas yang membutuhkan *workflow* ketat dan sistem anti-fraud.
- **Limit:** Maksimal 15 User, Unlimited Order.
- **Fitur Termasuk:** Semua fitur Starter + QR Code Tracking 100%, Modul QC & Rework, Manajemen Gudang (Slot), Material Inventory & Deductions, Notifikasi WhatsApp Unlimited via API terintegrasi (bukan lagi kuota terbatas), Audit Trail Lengkap.
- **Akses Role:** Semua 5 role terbuka.

> **Catatan:** Notifikasi WhatsApp sengaja tidak dikunci total di Starter — ini fitur inti yang dijual di landing page (`MARKETING-PAGE.md`), jadi semua paket tetap mendapatkannya. Diferensiasi upsell ke Pro dipindah ke **kuota & integrasi API**, bukan ada/tidaknya fitur.

### 👑 Enterprise (Harga Custom, mulai Rp 1.500.000+)
Ditujukan untuk *franchise* atau pabrik cetak multi-cabang.
- **Limit:** Unlimited User, Unlimited Order, Multi-Cabang.
- **Fitur Termasuk:** Semua fitur Pro + Laporan Konsolidasi Multi-Cabang, Dedicated Account Manager (SLA), akses API pihak ketiga.
- **Custom Domain:** Opsi untuk menggunakan domain sendiri (contoh: `sistem.namatoko.com`). Lihat `06-SECURITY/MULTI-TENANT-ISOLATION.md` bagian "Isolasi Sesi di Custom Domain" untuk aturan keamanannya.

## 2b. Siklus Berlangganan (Bulanan / Tahunan)

- **Bulanan:** Harga normal sesuai tabel di atas, ditagih tiap 30 hari.
- **Tahunan (Opsional, diskon):** Bayar 10 bulan, gratis 2 bulan (setara diskon ~17%). Tersedia untuk paket Starter & Pro. Tujuan: memperbaiki cash flow platform dan menekan risiko churn akibat `Grace Period` yang pendek (3 hari) pada siklus bulanan.
- Enterprise selalu memakai kontrak custom (bukan siklus otomatis Midtrans), diatur manual oleh tim Sales.

## 3. Trial & Churn Policy

- **Free Trial:** 14 Hari gratis pada paket yang dipilih saat mendaftar (Starter atau Pro — Enterprise selalu via Sales, tidak self-serve), tidak butuh kartu kredit.
- **Akhir Trial = Jatuh Tempo Pertama:** Hari terakhir trial diperlakukan sebagai `H-0` pada siklus billing (lihat `BILLING.md` Section 2) — tenant baru tetap mendapat invoice + link pembayaran dan `Grace Period` 3 hari yang sama seperti pelanggan reguler, bukan langsung `SUSPENDED` tanpa peringatan.
- **Grace Period:** 3 Hari setelah jatuh tempo pembayaran (termasuk jatuh tempo pertama pasca-trial). Sistem tetap bisa diakses namun muncul peringatan.
- **Suspension:** Jika tidak dibayar setelah masa tenggang, akun menjadi status `SUSPENDED`. Semua user tidak bisa login ke dalam subdomain tenant tersebut, kecuali untuk layar pembayaran.
- **Data Retention & Penghapusan Bertahap:** Jika akun tidak dibayar selama 90 hari sejak `SUSPENDED`, status menjadi `CHURNED` dan data dijadwalkan untuk dihapus permanen (hard delete). Sebelum itu, sistem **wajib**:
  - Mengirim reminder bertahap ke Owner via Email + WA pada **H-30, H-7, dan H-1** sebelum penghapusan permanen.
  - Menyediakan tombol **"Ekspor Semua Data"** (order, pelanggan, laporan keuangan dalam CSV/PDF) yang aktif sejak status `SUSPENDED` hingga sesaat sebelum `CHURNED` dieksekusi hard delete.
  - Detail teknis lihat `SUPER-ADMIN.md` Section B.
