# WhatsApp Notification Module

## Tujuan

Mengirimkan notifikasi otomatis kepada konsumen ketika pesanan fisik sudah selesai,
tersimpan di lokasi yang valid, dan benar-benar siap diambil atau dikirim.

---

## Trigger yang Benar

Notifikasi HANYA boleh dikirim setelah urutan ini selesai:

```
QC PASS
  → FINISHING COMPLETE
  → JOB QR SCANNED (oleh finishing staff)
  → STORAGE LOCATION QR SCANNED (oleh warehouse)
  → STORAGE CONFIRMED (status: READY_FOR_PICKUP)
  → SISTEM mengirim notifikasi otomatis
```

Notifikasi TIDAK boleh dipicu hanya karena produksi atau finishing selesai.

---

## Cara Pengiriman

- Sistem mengambil `phone` konsumen dari database secara internal
- Nomor HP **tidak pernah ditampilkan** ke antarmuka user manapun dalam proses ini
- Notifikasi dikirim oleh sistem, bukan oleh staff secara manual

---

## Provider WhatsApp

- Provider akan ditentukan saat implementasi (Fonnte / Wablas / WhatsApp Business API)
- Sistem wajib menggunakan **abstraction layer** (service/interface) sehingga provider bisa diganti tanpa mengubah core workflow
- Konfigurasi provider: API key disimpan di environment variable, tidak di kode

---

## Template Pesan

### Siap Diambil (Lunas)
```
Halo Kak [nama konsumen] 👋

Pesanan Anda dengan nomor [order_code] sudah selesai dan siap diambil.

🖨️ Pesanan: [deskripsi produk]
📦 Jumlah: [quantity] pcs
✅ Status: SIAP DIAMBIL

Silakan datang ke percetakan untuk pengambilan pesanan.

Terima kasih 🙏
```

### Siap Diambil (Ada Sisa Tagihan)
```
Halo Kak [nama konsumen] 👋

Pesanan [order_code] sudah selesai dan tersimpan di percetakan.

🖨️ Pesanan: [deskripsi produk]
💳 Status pembayaran: MENUNGGU PELUNASAN

Pesanan dapat diambil setelah pelunasan sesuai ketentuan percetakan.
```

---

## Penanganan Kegagalan (Failure Handling)

### Jika WhatsApp Gagal Terkirim:

1. **Status order TIDAK BERUBAH** — order tetap READY_FOR_PICKUP
2. **Sistem mencatat kegagalan** di tabel `notification_events` dengan status FAILED + error message dari provider
3. **Notifikasi otomatis ke Admin Sales** muncul di dashboard (badge/alert merah)
4. **Email fallback** dikirim ke email Admin Sales dengan informasi:
   - Nama konsumen
   - Order code
   - Nomor HP konsumen (hanya untuk Admin, bukan untuk role lain)
   - Pesan yang gagal dikirim
   - Tombol "Kirim Ulang" di dashboard Admin
5. Admin dapat melakukan pengiriman ulang secara manual melalui tombol di sistem
6. Jika email Admin juga gagal: notifikasi dalam aplikasi (in-app alert) tetap tampil

### Retry Otomatis
- Sistem melakukan retry otomatis maksimal 3 kali dengan jeda 5 menit
- Jika setelah 3 retry masih gagal: sistem berhenti retry dan menunggu aksi manual Admin

---

## Aturan Duplikasi

- Event yang sama (READY_FOR_PICKUP untuk order X) tidak boleh mengirim duplikat pesan
- Resend hanya bisa dilakukan oleh Admin Sales atau Owner melalui tombol eksplisit di dashboard
- Setiap resend dicatat di `notification_events` dengan flag `is_resend: true`

---

## Privacy

Tidak boleh dikirim ke konsumen:
- Biaya produksi internal
- Nama pegawai
- Temuan audit internal
- Catatan bisnis sensitif
- Lokasi penyimpanan internal (RAK-3A-01 dll)

---

## Pencatatan

Simpan di `notification_events`:
- `order_id`
- `customer_id`
- `event_type` (READY_FOR_PICKUP / dll)
- `channel` (WHATSAPP / EMAIL_FALLBACK)
- `recipient` (phone atau email — tersimpan tapi tidak ditampilkan ke role biasa)
- `template_code`
- `status` (PENDING / SENT / FAILED / RETRY)
- `provider_message_id`
- `error_message`
- `sent_at`
- `is_resend`
- `resent_by` (user_id jika resend manual)
- `retry_count`
- `created_at`
