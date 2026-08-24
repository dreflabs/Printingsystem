# SUPER ADMIN

## Deskripsi

Super Admin adalah role **platform**, bukan role tenant — dipakai oleh tim pengelola Print Pilot (bukan oleh percetakan pelanggan). Berbeda dari 5 role tenant (Owner, Admin, Designer Sales, Operator, Gudang), akun Super Admin tersimpan di tabel terpisah (`super_admins`, bukan `users`) dan login di domain utama (`printpilot.id`), bukan di subdomain tenant manapun — supaya tidak ada jalur eskalasi privilege dari sisi tenant ke level platform. Detail fitur & UI dashboard lengkap ada di `13-SAAS/SUPER-ADMIN.md`; dokumen ini fokus ke definisi hak akses per sub-level.

## 3 Sub-Level Super Admin

Tabel `super_admins` punya field `role` dengan 3 nilai (`SUPER_ADMIN` / `SUPPORT` / `FINANCE`) — **bukan satu level akses monolitik**. Setiap staf pengelola SaaS di-assign salah satu dari 3 sub-level ini sesuai tanggung jawabnya, mengikuti prinsip least-privilege yang sama seperti role tenant.

### SUPER_ADMIN (akses penuh)
| Modul | Akses |
|-------|-------|
| Dashboard metrics (MRR, tenant count, system health) | ✅ |
| Suspend / Activate tenant | ✅ |
| Hard-delete tenant (lebih awal dari 90 hari, kasus pelanggaran TOS) | ✅ (wajib konfirmasi eksplisit — ketik ulang nama tenant) |
| Impersonate tenant (mode aktif/edit atau read-only) | ✅ bebas pilih mode |
| Billing: lihat invoice, force-mark-paid | ✅ |
| Broadcast notification ke semua tenant | ✅ |
| Buat/kelola akun Super Admin lain (termasuk assign sub-level) | ✅ |

### SUPPORT (dukungan teknis tenant)
| Modul | Akses |
|-------|-------|
| Dashboard metrics (MRR, tenant count, system health) | ✅ (lihat saja) |
| Suspend / Activate tenant | ❌ — keputusan bisnis/kebijakan, bukan sekadar dukungan teknis |
| Hard-delete tenant | ❌ |
| Impersonate tenant | ✅ **hanya mode read-only** — tidak boleh pilih mode aktif/edit sama sekali |
| Billing: lihat invoice, force-mark-paid | ❌ |
| Broadcast notification | ✅ (untuk info teknis/maintenance) |
| Buat/kelola akun Super Admin lain | ❌ |

### FINANCE (billing & langganan)
| Modul | Akses |
|-------|-------|
| Dashboard metrics (MRR, tenant count) | ✅ |
| System health | ❌ (tidak relevan ke tanggung jawabnya) |
| Suspend / Activate tenant | ❌ |
| Hard-delete tenant | ❌ |
| Impersonate tenant | ❌ — tidak butuh masuk ke data operasional tenant untuk urus billing |
| Billing: lihat invoice, force-mark-paid | ✅ |
| Tenant Management (list, status langganan) | 📖 read-only — untuk konteks siapa yang menunggak, tidak bisa aksi ke tenant |
| Broadcast notification | ❌ |
| Buat/kelola akun Super Admin lain | ❌ |

## Yang Berlaku untuk Semua Sub-Level

- **Semua aksi tercatat** di `tenant_audit_logs` dengan `actor_type = SUPER_ADMIN` dan sub-level pelakunya — tidak ada pengecualian, termasuk staf SUPPORT yang cuma impersonate read-only.
- **Transparansi wajib ke tenant** — begitu sesi impersonate dimulai (SUPER_ADMIN atau SUPPORT), sistem kirim notifikasi ke Owner tenant (email + banner dashboard) berisi nama staf, waktu akses, dan alasan singkat. Ini berlaku sama untuk kedua sub-level yang boleh impersonate.
- **MFA wajib** untuk login akun `super_admins` — mengingat akun ini punya jangkauan akses ke *seluruh* tenant sekaligus, jauh lebih sensitif dari akun Owner tenant manapun yang cuma bisa akses data tenant sendiri. Rekomendasi: TOTP (Google Authenticator/Authy), bukan cuma username+password.
- **Tidak bisa login ke subdomain tenant langsung** dengan kredensial `super_admins` — akses ke data tenant *hanya* lewat mekanisme impersonate yang tercatat, tidak ada jalur pintas.

## Yang TIDAK Boleh Dilakukan Super Admin (semua sub-level)

- Mengubah data operasional tenant secara langsung di database tanpa lewat mekanisme impersonate tercatat (tidak ada "backdoor" edit).
- Melihat kredensial/password asli user tenant mana pun (password di-hash, tidak bisa di-reverse oleh siapa pun termasuk Super Admin).
- Menghapus `tenant_audit_logs` miliknya sendiri — beda dari Owner tenant yang punya panel khusus hapus audit log dengan 2-langkah konfirmasi, tidak ada mekanisme setara untuk Super Admin menghapus jejak aksinya sendiri.
