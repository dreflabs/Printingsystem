# Audit Alur Registrasi Print Pilot

Tanggal audit: 21 September 2026
Status: audit statis (kode + dokumen), tanpa menjalankan aplikasi atau database.
Cakupan: landing page → wizard registrasi 6 langkah → `registerTenant()` → invoice pertama → pembatasan akses tenant `UNPAID`.
Lampiran visual: canvas `print-pilot-registration-audit.canvas.tsx` (laporan interaktif dengan tabel yang sama).

---

## 1. Kesimpulan eksekutif

Alur registrasi sudah kuat di sisi data: seluruh pembuatan tenant berjalan dalam **satu transaksi atomik**, validasi server serius (email, kebijakan password, format subdomain, consent), voucher divalidasi ulang dan dipakai sekali, serta pembatasan akses `UNPAID` ditegakkan di **server** (`requireTenant`) dan bukan hanya di UI.

Yang belum aman adalah sisi **penyalahgunaan pendaftaran** dan **ketahanan alur**:

- Tidak ada CAPTCHA/honeypot dan rate limit di-key per `email+subdomain`, sehingga mudah dilewati → pendaftaran massal dan penyquatan subdomain.
- Tidak ada daftar subdomain terlarang (`www`, `api`, `app`, `platform`, `support`, `mail`, `kiosk`, …).
- Kode voucher dapat dienumerasi karena pesan error spesifik dan rate limit di-key per kode.
- Dua jalan buntu: email verifikasi gagal kirim (workspace sudah jadi, UI menampilkan error) dan race subdomain (P2002 jatuh ke pesan generik).
- Observabilitas minim: kegagalan invoice hanya masuk console, email gagal hanya masuk log, tidak ada notifikasi internal saat ada pendaftar baru.

Total temuan: **19** — 4 tinggi, 10 sedang, 5 rendah.

---

## 2. Peta alur registrasi saat ini

| Tahap | Yang terjadi | Lokasi |
|---|---|---|
| 1. Masuk wizard | Landing page mengirim `?plan=starter\|pro\|business`; wizard 6 langkah: Akun Owner, Profil Percetakan, Pilih Paket, Durasi & Kapasitas, Layanan & Ringkasan, Selesai | `src/app/(auth)/register/page.tsx` |
| 2. Validasi klien | Nama, email (hanya non-kosong), password ≥12 karakter + huruf/angka, konfirmasi cocok; profil: nama toko, subdomain ≥3, centang S&K | `register/page.tsx:161-162` |
| 3. Validasi server | Rate limit, format email, kebijakan password, format subdomain, consent, ketersediaan subdomain, validasi voucher, guard provider email | `src/actions/register.ts:113-141` |
| 4. Transaksi tenant | Role global, upsert `SubscriptionPlan`, Tenant `UNPAID`, `TenantSubscription` (termin/layanan/voucher), owner + semua `extra_roles`, material starter, setelan absensi, `WIZARD_DONE`, audit log | `register.ts:171-314` |
| 5. Invoice pertama | Di luar transaksi: `createInvoiceForSubscription` jatuh tempo 3 hari, voucher sekali pakai; kegagalan hanya di-log | `register.ts:319-329` |
| 6. Email | Beta: email selamat datang berisi nomor invoice + jatuh tempo (best-effort). Release: token verifikasi 24 jam | `register.ts:331-378` |
| 7. Setelah daftar | Auto sign-in lalu diarahkan ke halaman tagihan; middleware membatasi tenant `UNPAID` ke billing/invoice/bantuan sampai bukti bayar disetujui | `register/page.tsx:210-219`, `src/middleware.ts:144` |

---

## 3. Temuan

### 3.1 Tinggi

**H1 — Tidak ada proteksi bot dan rate limit mudah dilewati.**
Rate limit signup di-key `signup:${email}:${slug}` (`register.ts:113`) sehingga penyerang cukup memvariasikan email atau subdomain untuk mencoba tanpa batas; limiter juga in-memory (`lib/rate-limit.ts`). Dampak: pembuatan tenant massal, penyquatan subdomain, pembengkakan DB.
*Rekomendasi:* rate limit per IP + honeypot/CAPTCHA (Turnstile) + batas jumlah tenant per IP per hari.

**H2 — Tidak ada daftar subdomain terlarang.**
Validasi hanya `^[a-z0-9]{3,30}$` (`register.ts:122`). Nama seperti `www`, `api`, `app`, `platform`, `mail`, `support`, `status`, `cdn`, `docs`, `kiosk`, `print`, `halo` dapat didaftarkan siapa pun. Dampak: tabrakan dengan infrastruktur/marketing dan risiko phishing (`support.printpilot.id`).
*Rekomendasi:* blokir daftar reserved di validasi server dan klien.

**H3 — Kode voucher dapat dienumerasi.**
`validateSignupVoucher` membedakan pesan "tidak ditemukan", "tidak aktif", "kedaluwarsa", dan "kuota habis" (`lib/voucher.ts:66-72`), sementara rate limit di-key per kode (`register.ts:402`) sehingga mencoba ribuan kode berbeda tidak dibatasi.
*Rekomendasi:* samakan pesan menjadi satu ("Kode tidak valid atau tidak berlaku") dan key rate limit per IP.

**H4 — Jalan buntu saat email verifikasi gagal terkirim.**
Tenant + user sudah ter-commit di transaksi, tetapi action mengembalikan `fail("Workspace berhasil dibuat, tetapi email verifikasi belum dapat dikirim…")` (`register.ts:340`). Pengguna mengulang pendaftaran lalu tertahan "Subdomain sudah dipakai" (`register.ts:141`).
*Rekomendasi:* kembalikan sukses dengan status "menunggu verifikasi" + tombol kirim ulang, atau arahkan langsung ke halaman verifikasi.

### 3.2 Sedang

**M1 — Race subdomain tanpa penanganan P2002.** `findUnique` lalu `create` (`register.ts:140-141, 171`) dengan catch generik (`register.ts:382`). Dua pendaftar bersamaan mendapat pesan "Gagal membuat workspace" alih-alih "subdomain sudah dipakai".
*Rekomendasi:* tangkap P2002 pada `Tenant.slug` dan kembalikan error field subdomain.

**M2 — Format email tidak divalidasi di klien.** `step1Valid` hanya mengecek non-kosong (`register/page.tsx:161`); kesalahan baru muncul saat submit di langkah 5.
*Rekomendasi:* validasi regex email di langkah 1 dengan umpan balik langsung.

**M3 — Subdomain kustom tertimpa.** Mengubah nama toko selalu menulis ulang `subdomain` hasil `autoGenerateSubdomain` (`register/page.tsx:427`), menghapus pilihan manual pengguna.
*Rekomendasi:* hentikan auto-isi setelah pengguna menyunting subdomain (flag `subdomainTouched`).

**M4 — Tidak ada cek ketersediaan subdomain langsung.** Tidak ada action pengecekan; verifikasi hanya saat submit (`register.ts:140`).
*Rekomendasi:* action `checkSubdomainAvailability` dengan debounce di langkah 2.

**M5 — Nomor WhatsApp tanpa validasi format.** Hanya `trim` (`register.ts:110`), padahal dipakai untuk notifikasi WA pelanggan dan operasional.
*Rekomendasi:* normalisasi + validasi format Indonesia (08…/+62…).

**M6 — Tidak ada notifikasi internal saat ada pendaftar baru atau bukti bayar menunggu.** Verifikasi invoice bergantung pada pengecekan manual panel; tidak ada kode notifikasi internal (hanya `TenantAuditLog`).
*Rekomendasi:* email/WA internal ke tim billing pada setiap signup dan setiap bukti bayar masuk.

**M7 — Kegagalan invoice pertama hanya di-log.** (`register.ts:319-326`) Tenant tetap `UNPAID` tanpa invoice dan tanpa mekanisme coba ulang; halaman tagihan hanya menampilkan "Belum ada invoice" + kontak manual.
*Rekomendasi:* audit log kegagalan + job retry atau aksi "terbitkan invoice" di detail tenant.

**M8 — Tracking onboarding tidak lengkap.** Hanya `WIZARD_DONE` yang dicatat (`register.ts:273-275`); `VERIFIED`, `FIRST_ORDER`, dan `FIRST_PRODUCTION` tidak pernah ditulis, padahal `13-SAAS/TENANT-ONBOARDING.md` menjanjikan analitik drop-off.
*Rekomendasi:* catat `VERIFIED` saat verifikasi email dan `FIRST_ORDER`/`FIRST_PRODUCTION` saat order/job pertama selesai.

**M9 — Owner otomatis memegang semua role.** `register.ts:248-261` memberi seluruh role operasional sebagai `extra_roles`, termasuk pada `workspace_mode = TEAM_FULL`, dan tidak ada pencabutan otomatis.
*Rekomendasi:* opsi "mulai sebagai Owner saja" atau tawaran pencabutan role saat pegawai pertama ditambahkan.

**M10 — Tidak ada draf wizard.** State hanya di komponen (`register/page.tsx`); menutup tab atau refresh menghapus semua isian.
*Rekomendasi:* simpan draf ke `localStorage` tanpa password, atau sediakan resume lewat tautan.

### 3.3 Rendah

**L1 — Email selamat datang/invoice gagal terkirim tanpa terlihat pengguna** bila provider email belum dikonfigurasi di produksi (`register.ts:345-377`, `lib/mail.ts`). *Rekomendasi:* peringatan di panel platform dan kirim ulang otomatis saat konfigurasi siap.

**L2 — Versi S&K tidak dicatat.** Hanya `terms_accepted_at` (`register.ts:239`). *Rekomendasi:* simpan versi/ID dokumen untuk kebutuhan hukum.

**L3 — Error field-level tampil di langkah terakhir.** Satu banner `error` di atas semua langkah; pengguna harus menavigasi balik untuk memperbaiki subdomain/email/voucher. *Rekomendasi:* petakan error ke langkah terkait.

**L4 — Tidak ada test alur registrasi.** `tests/` mencakup entitlement, material, produksi, isolasi tenant, voucher, invoice, dan payment settings — belum ada `registerTenant`. *Rekomendasi:* test integrasi registrasi + test unit validasi input.

**L5 — Username owner tidak diperlihatkan sebelum submit** (`register.ts:144`; baru tampil di langkah 6). *Rekomendasi:* tampilkan di langkah ringkasan.

---

## 4. Urutan perbaikan yang disarankan

| Prioritas | Fokus | Perkiraan |
|---|---|---|
| P0 | Tutup celah penyalahgunaan: reserved subdomain, rate limit per IP, CAPTCHA/honeypot, pesan voucher disamakan | 1-2 hari |
| P1 | Perbaiki jalan buntu: email verifikasi gagal, race subdomain (P2002), kegagalan invoice + retry/alert | 2-3 hari |
| P2 | UX wizard: validasi email & WhatsApp, subdomain tidak tertimpa, cek ketersediaan live, error melompat ke langkah benar | 2-3 hari |
| P3 | Notifikasi internal + tracking onboarding lengkap (`VERIFIED`/`FIRST_ORDER`/`FIRST_PRODUCTION`) | 1-2 hari |
| P4 | Draf wizard, versi S&K, test registrasi, keputusan role Owner pada mode tim | 3-5 hari |

---

## 5. Yang sudah baik dan perlu dipertahankan

- Transaksi pendaftaran atomik: tenant, subscription, owner, role, material starter, setelan absensi, dan audit log dibuat sekali jalan.
- Validasi server lengkap untuk input kritis: email, kebijakan password (min 12 karakter + huruf/angka + batas 72 byte bcrypt), format subdomain, consent wajib.
- Voucher divalidasi ulang di server dan dipakai sekali; nilai invoice dihitung dari baris katalog, bukan dari input klien.
- Guard provider email: pendaftaran ditolak bila verifikasi diwajibkan tetapi provider belum dikonfigurasi.
- Token verifikasi disimpan sebagai hash, sekali pakai, kedaluwarsa 24 jam, dikonsumsi dalam transaksi.
- Setelah daftar, tenant langsung dibatasi ke halaman tagihan (middleware + `requireTenant`) sampai pembayaran diverifikasi.
- Rate limit dasar tersedia untuk signup, resend verifikasi, dan pratinjau voucher.

---

## 6. Keputusan produk yang menunggu

1. Apakah verifikasi email diwajibkan saat rilis? Bila ya, perbaiki H4 lebih dulu.
2. Apakah Owner tetap otomatis memegang semua role pada mode "Tim per divisi" (M9)?
3. Berapa batas wajar pendaftaran per IP per hari, dan apakah CAPTCHA dipasang sejak awal (H1)?
4. Apakah email selamat datang wajib berhasil sebelum workspace dianggap selesai (L1)?

---

## 7. Lampiran: berkas yang diperiksa

- `frontend/src/actions/register.ts`
- `frontend/src/app/(auth)/register/page.tsx`
- `frontend/src/actions/email-verification.ts`
- `frontend/src/app/(auth)/verify-email/page.tsx`
- `frontend/src/lib/voucher.ts`, `frontend/src/lib/billing.ts`
- `frontend/src/lib/password-policy.ts`, `frontend/src/lib/rate-limit.ts`
- `frontend/src/lib/tenant.ts`, `frontend/src/middleware.ts`
- `frontend/src/lib/mail.ts`, `frontend/src/lib/auth.ts`
- `13-SAAS/TENANT-ONBOARDING.md`, `13-SAAS/BILLING.md`, `13-SAAS/SAAS-MODEL.md`
- `frontend/tests/*` (untuk menilai cakupan pengujian)

> Dokumen ini adalah snapshot audit statis pada tanggal di atas. Temuan dapat berubah setelah perbaikan dilakukan.
