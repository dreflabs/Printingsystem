# Integrasi Billing & Payment Gateway (Midtrans)

Sistem berlangganan bulanan SaaS Print Pilot akan diotomasi menggunakan **Midtrans**.

## 0. Dua Metode Pembayaran (dapat diatur Super Admin)

> **Status 2026-09-21:** integrasi payment gateway **dipending**. Yang aktif dan dipakai saat ini **hanya transfer bank manual** (mengikuti alur BIMA). Toggle gateway di panel sengaja dikunci nonaktif sampai Snap + webhook selesai dibangun dan diuji — `GATEWAY_INTEGRATION_PENDING = true` di `frontend/src/lib/payment-settings.ts`.

Metode pembayaran dikonfigurasi di panel Super Admin `/platform/payments` dan disimpan sebagai `PlatformSetting` (`payment.methods`):

1. **Payment Gateway** — toggle on/off + pilih provider (Midtrans). **Dipending**: toggle tidak bisa dinyalakan (`canEnableGateway()` selalu false) dan `updatePaymentSettings` menolak percobaan mengaktifkannya.
2. **Transfer Bank Manual** — toggle on/off + daftar `BankAccount` (nama bank, nomor rekening, pemilik, label, catatan, urutan tampil, aktif) + instruksi pembayaran bebas.

Alur manual: Owner membuka halaman invoice (`/owner/billing/invoice/<id>`), menyalin nomor rekening, mengunggah bukti transfer (JPG/PNG/PDF, maks 5 MB) melalui `createPaymentProofUploadUrl` → `submitPaymentProof`, lalu Super Admin memverifikasi di `/platform/payments`. Persetujuan menandai invoice `PAID` (`payment_method = MANUAL_TRANSFER`) dalam satu transaksi dan tercatat di `PlatformAuditLog` (`PAYMENT_PROOF_APPROVED` / `PAYMENT_PROOF_REJECTED`).

Minimal satu metode harus aktif. Bukti pembayaran disajikan lewat `/api/payment-proof/<id>` yang hanya bisa diakses Super Admin atau anggota tenant pemilik invoice.

## 1. Flow Siklus Tagihan (Subscription Cycle)

> **Tanpa free trial (2026-09-21).** Invoice pertama diterbitkan otomatis saat pendaftaran dengan jatuh tempo 3 hari; tenant berstatus `UNPAID` sampai dibayar. Hari jatuh tempo = `H-0` di Section 2 (Perpanjangan Otomatis). Selama beta, invoice masih manual/transfer bank (lihat bagian 0). Setelah gateway production aktif, alur tetap sama — hanya metode pembayarannya bertambah.

1. **Daftar & Pilih Paket:** Owner memilih paket self-serve (Starter/Pro/Business) di wizard. Enterprise dikontrak manual lewat Sales. Pilihan wizard (durasi `term_months`, kursi add-on `Tenant.addon_users`, layanan `service_keys`) menjadi baris invoice pertama.
   - Sejak Fase 2, invoice sudah **multi-baris** (`InvoiceLine`): baris paket (dengan termin), kursi add-on, layanan, dan baris `DISCOUNT` bila voucher dipakai.
   - Invoice bertermin >1 bulan menutup seluruh termin lewat `period_end`, sehingga generator bulanan tidak menerbitkan invoice baru selama periode masih tercakup.
   - **Voucher** (`Voucher` + `VoucherRedemption`) dipakai sekali per invoice dan dikonsumsi di dalam transaksi pembuatan invoice.
2. **Checkout (Midtrans SNAP):** 
   - Sistem melakukan request ke API Midtrans.
   - Owner memilih metode pembayaran (QRIS, VA Bank, e-Wallet).
3. **Pembayaran Sukses:**
   - Midtrans mengirim *Webhook* (HTTP POST) ke `/api/billing/webhook`.
   - Sistem validasi signature webhook.
   - Status tagihan menjadi `PAID`.
   - Tanggal berlangganan (`current_period_end`) ditambahkan 1 bulan kalender.
4. **Invoice Otomatis:** Sistem *generate* PDF Invoice (Tanda Terima) dan mengirimkannya via Email ke Owner.

## 2. Perpanjangan Otomatis (Auto-Renewal Reminder)

Karena pembayaran di Indonesia mayoritas menggunakan metode transfer/VA yang bukan *auto-debit* (berbeda dengan kartu kredit via Stripe), sistem mengandalkan pengingat tagihan:

- **H-7 Jatuh Tempo:** Kirim notifikasi WA + Email bahwa tagihan bulan depan akan terbit.
- **H-0 (Hari Jatuh Tempo):** Kirim invoice baru (status PENDING) beserta link pembayaran Midtrans.
- **H+3 (Grace Period Berakhir):** Jika belum dibayar, ubah status tenant menjadi `SUSPENDED`.

## 3. Upgrade & Downgrade Paket

- **Upgrade (mis. Starter → Pro, Pro → Business):** 
  - Tagihan akan diprorata (*prorated*). 
  - Sisa hari di paket lama akan dikonversi menjadi kredit diskon untuk tagihan paket baru.
  - Akses fitur langsung terbuka sesaat setelah sukses bayar.
- **Downgrade (mis. Business → Pro, Pro → Starter):**
  - Hanya efektif di siklus bulan berikutnya. Tidak ada *refund* selisih dana di bulan berjalan.
  - Sistem harus memvalidasi apakah tenant masih memenuhi batas paket tujuan. Contoh: turun ke Starter (max 3 user) ditolak jika tenant masih punya lebih dari 3 user aktif.
  - **Validasi tambahan — job aktif di modul yang akan terkunci:** downgrade **ditolak** jika masih ada job produksi yang berstatus aktif (belum `PICKED_UP`/`CLOSED`) di modul yang hanya tersedia di paket atas (Scan QR Produksi, QC, Gudang). Alasan: menutup akses saat job sedang berjalan di titik scan tertentu akan memutus alur kerja fisik di lantai produksi.
  - **Data lama tetap bisa dibaca:** begitu downgrade berhasil, data historis dari modul yang terkunci (riwayat QC, riwayat gudang, dsb.) tetap bisa **dibaca (read-only)**, hanya fitur input/aksi barunya yang dinonaktifkan. Ini mencegah tenant merasa kehilangan data saat downgrade.

## 4. Keamanan Webhook Midtrans

Endpoint `/api/billing/webhook` harus terbuka untuk publik (tidak di-protect session), namun keamanannya dijaga melalui verifikasi SHA512 hash dari:
`order_id + status_code + gross_amount + server_key`
Hanya request yang memiliki hash valid yang dapat mengubah status langganan tenant di database.

## 5. Idempotency Webhook

Midtrans dapat mengirim event yang sama lebih dari sekali (retry jaringan, duplikasi di sisi mereka). Sistem **wajib** menganggap webhook bersifat idempotent:
- Simpan `order_id` beserta status pemrosesannya di tabel `billing_webhook_events` (unique constraint pada `order_id`).
- Sebelum mengeksekusi perubahan (menambah `current_period_end`, mengubah status jadi `PAID`), cek apakah `order_id` tersebut sudah pernah diproses sukses sebelumnya. Jika sudah, langsung balas `200 OK` tanpa mengulangi efek samping (mencegah `current_period_end` bertambah dua kali dari satu pembayaran).
