# User Story: Super Admin (SaaS Platform)

Super Admin adalah pemilik tunggal dan pengelola utama dari sistem SaaS Print Pilot secara keseluruhan. Mereka bertanggung jawab untuk mengelola tenant, tagihan, dan memantau operasi sistem.

## 1. Manajemen Tenant & Otorisasi
- **Sebagai** Super Admin, **saya ingin** melihat metrik dashboard (MRR, jumlah tenant, kesehatan sistem), **sehingga** saya bisa memantau pertumbuhan dan performa bisnis SaaS.
- **Sebagai** Super Admin, **saya ingin** dapat melakukan *suspend* / mengaktifkan kembali tenant, **sehingga** saya bisa memblokir akses tenant yang melanggar aturan.
- **Sebagai** Super Admin, **saya ingin** dapat menghapus permanen (hard-delete) tenant lebih awal dari masa tenggang 90 hari, **sehingga** data tenant yang melanggar ketentuan fatal bisa segera dibersihkan.
- **Sebagai** Super Admin, **saya ingin** dapat melakukan *impersonate* (masuk ke akun tenant) baik dalam mode aktif maupun read-only, **sehingga** saya bisa membantu memecahkan masalah operasional yang rumit dari dalam akun mereka.
- **Sebagai** Super Admin, **saya ingin** mengirimkan notifikasi *broadcast* ke seluruh tenant, **sehingga** saya dapat memberikan pengumuman sistem secara massal.

## 2. Manajemen Billing & Keuangan
- **Sebagai** Super Admin, **saya ingin** melihat daftar tagihan/invoice dari seluruh tenant, **sehingga** saya bisa melacak siapa yang belum melakukan pembayaran.
- **Sebagai** Super Admin, **saya ingin** bisa melakukan *force-mark-paid* pada invoice tertentu, **sehingga** saya bisa memperbarui status tagihan jika tenant membayar secara manual di luar sistem.
- **Sebagai** Super Admin, **saya ingin** melihat metrik MRR dan jumlah pendapatan bulanan, **sehingga** saya bisa memproyeksikan keuntungan.

## 3. Keamanan & Log Audit
- **Sebagai** Super Admin, **saya ingin** semua aktivitas baik level platform maupun yang tenant-scoped dicatat secara permanen di `platform_audit_logs`, **sehingga** setiap perubahan atau akses yang saya lakukan dapat ditelusuri.
- **Sebagai** Super Admin, **saya ingin** sistem otomatis mengirim email/notifikasi ke Owner tenant saat saya melakukan *impersonate* ke akun mereka, **sehingga** privasi tenant tetap terjaga dan transparan.
