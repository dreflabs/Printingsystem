# SUPER ADMIN

## Deskripsi

Super Admin adalah role **platform**, bukan role tenant — dipakai oleh tim pengelola Print Pilot (bukan oleh percetakan pelanggan). Berbeda dari 5 role tenant (Owner, Admin, Designer Sales, Operator, Gudang), akun Super Admin tersimpan di tabel terpisah (`super_admins`, bukan `users`) dan login di domain utama (`printpilot.id`), bukan di subdomain tenant manapun — supaya tidak ada jalur eskalasi privilege dari sisi tenant ke level platform. Detail fitur & UI dashboard lengkap ada di `13-SAAS/SUPER-ADMIN.md`.

## Level Akses: Tunggal (Akses Penuh)

Hanya terdapat **1 level Super Admin** tanpa pembagian sub-level. Setiap akun Super Admin memiliki akses penuh ke seluruh fitur pengelola SaaS:

| Modul | Akses |
|-------|-------|
| Dashboard metrics (MRR, tenant count, system health) | ✅ |
| Suspend / Activate tenant | ✅ |
| Hard-delete tenant (lebih awal dari 90 hari, kasus pelanggaran TOS) | ✅ (wajib konfirmasi eksplisit — ketik ulang nama tenant) |
| Impersonate tenant (mode aktif/edit atau read-only) | ✅ bebas pilih mode |
| Billing: lihat invoice, force-mark-paid | ✅ |
| Broadcast notification ke semua tenant | ✅ |
| Buat/kelola akun Super Admin lain | ✅ |

## Aturan Keamanan & Log Audit

- **Semua aksi tercatat.** Aksi tenant-scoped di `tenant_audit_logs` (`actor_type = SUPER_ADMIN`). Aksi tingkat-platform (login sukses/gagal, kunci akun, kelola akun Super Admin, MFA, plus salinan aksi tenant) di `platform_audit_logs` — tahan-hapus: nama pelaku & label target di-snapshot supaya tetap terbaca setelah tenant di-purge / akun dihapus. Terlihat di panel **Aktivitas**.
- **Transparansi wajib ke tenant** — begitu sesi impersonate dimulai, sistem kirim notifikasi ke Owner tenant (email + banner dashboard) berisi nama staf, waktu akses, dan alasan singkat.
- **Login akun `super_admins`** — email + password satu langkah, terpisah dari tabel `users` tenant. Tidak ada MFA/OTP (dihapus 2026-09-08 atas keputusan pemilik — panel diakses dari jaringan terkontrol). Proteksi yang tersisa: percobaan gagal berturut-turut mengunci akun sementara (5× → kunci bertahap maks 60 menit), rate-limit 10/15 menit per identifier, sesi panel dibatasi 12 jam (`PLATFORM_SESSION_MAX_AGE_MS`). Pemulihan: SUPER_ADMIN lain reset password, atau `bootstrap:superadmin` di server.
- **Tidak bisa login ke subdomain tenant langsung** dengan kredensial `super_admins` — akses ke data tenant *hanya* lewat mekanisme impersonate yang tercatat, tidak ada jalur pintas.

## Yang TIDAK Boleh Dilakukan Super Admin

- Mengubah data operasional tenant secara langsung di database tanpa lewat mekanisme impersonate tercatat (tidak ada "backdoor" edit).
- Melihat kredensial/password asli user tenant mana pun (password di-hash, tidak bisa di-reverse oleh siapa pun termasuk Super Admin).
- Menghapus `tenant_audit_logs` miliknya sendiri — beda dari Owner tenant yang punya panel khusus hapus audit log dengan 2-langkah konfirmasi, tidak ada mekanisme setara untuk Super Admin menghapus jejak aksinya sendiri.
