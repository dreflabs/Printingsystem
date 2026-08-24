# Integrasi Billing & Payment Gateway (Midtrans)

Sistem berlangganan bulanan SaaS Print Pilot akan diotomasi menggunakan **Midtrans**.

## 1. Flow Siklus Tagihan (Subscription Cycle)

> **Trial (7 Hari) dianggap bagian dari siklus tagihan ini, bukan alur terpisah.** Hari ke-7 trial = `H-0` di Section 2 (Perpanjangan Otomatis). Tenant baru tetap dapat invoice pertama + `Grace Period` 3 hari sebelum `SUSPENDED`, sama seperti pelanggan reguler yang telat bayar.

1. **Trial Berakhir / Beli Paket:** Owner tenant masuk ke halaman `/billing` dan memilih paket (Starter/Pro).
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

- **Upgrade (Starter → Pro):** 
  - Tagihan akan diprorata (*prorated*). 
  - Sisa hari di paket Starter akan dikonversi menjadi kredit diskon untuk tagihan paket Pro yang baru.
  - Akses fitur langsung terbuka sesaat setelah sukses bayar.
- **Downgrade (Pro → Starter):**
  - Hanya efektif di siklus bulan berikutnya. Tidak ada *refund* selisih dana di bulan berjalan.
  - Sistem harus memvalidasi apakah tenant masih memenuhi batas Starter (max 5 user). Jika user mereka ada 8, sistem menolak downgrade sampai mereka menonaktifkan 3 user.
  - **Validasi tambahan — job aktif di modul yang akan terkunci:** downgrade **ditolak** jika masih ada job produksi yang berstatus aktif (belum `PICKED_UP`/`CLOSED`) di modul yang hanya tersedia di Pro (Scan QR Produksi, QC, Gudang). Alasan: menutup akses saat job sedang berjalan di titik scan tertentu akan memutus alur kerja fisik di lantai produksi.
  - **Data lama tetap bisa dibaca:** begitu downgrade berhasil, data historis dari modul yang terkunci (riwayat QC, riwayat gudang, dsb.) tetap bisa **dibaca (read-only)**, hanya fitur input/aksi barunya yang dinonaktifkan. Ini mencegah tenant merasa kehilangan data saat downgrade.

## 4. Keamanan Webhook Midtrans

Endpoint `/api/billing/webhook` harus terbuka untuk publik (tidak di-protect session), namun keamanannya dijaga melalui verifikasi SHA512 hash dari:
`order_id + status_code + gross_amount + server_key`
Hanya request yang memiliki hash valid yang dapat mengubah status langganan tenant di database.

## 5. Idempotency Webhook

Midtrans dapat mengirim event yang sama lebih dari sekali (retry jaringan, duplikasi di sisi mereka). Sistem **wajib** menganggap webhook bersifat idempotent:
- Simpan `order_id` beserta status pemrosesannya di tabel `billing_webhook_events` (unique constraint pada `order_id`).
- Sebelum mengeksekusi perubahan (menambah `current_period_end`, mengubah status jadi `PAID`), cek apakah `order_id` tersebut sudah pernah diproses sukses sebelumnya. Jika sudah, langsung balas `200 OK` tanpa mengulangi efek samping (mencegah `current_period_end` bertambah dua kali dari satu pembayaran).
