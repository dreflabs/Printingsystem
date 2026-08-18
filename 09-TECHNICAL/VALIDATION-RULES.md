# Validation Rules

- Quantities > 0.
- Prices >= 0.
- Required IDs must exist.
- Production requires approved design and valid Job ID.
- Material OUT requires Job ID.
- Waste requires quantity and reason.
- QC PASS required before finishing/storage.
- Storage requires valid Job ID + valid Location ID.
- READY_FOR_PICKUP requires successful storage confirmation.
- Pickup/release requires payment condition and authorization.
- Final Audit required before close.
- RED audit blocks close — order is moved to `ON_HOLD` for Owner investigation instead of CLOSED (see `09-TECHNICAL/STATUS-MACHINE.md`). YELLOW requires Supervisor/Owner approval before CLOSED. Only GREEN closes automatically.
- CLOSED records cannot be silently edited.
- READY_FOR_PICKUP notification can trigger only after storage confirmation.
- Duplicate notification events are prevented unless authorized resend.

---

## Format Field Spesifik

### Nomor Telepon (Indonesia)
- Format yang diterima: `08xxxxxxxxxx` (10–13 digit, awalan `08`) atau `+62xxxxxxxxxx` (awalan `+62` diikuti nomor tanpa `0` di depan).
- Regex acuan: `^(?:\+62|62|0)8[1-9][0-9]{6,10}$`
- Disimpan di database dalam bentuk ternormalisasi `+62xxxxxxxxxx` agar konsisten dipakai oleh provider WhatsApp.
- Berlaku untuk `customers.phone` dan field telepon lain yang mungkin ditambahkan (mis. kontak darurat pegawai).

### Email
- Format standar RFC 5322 disederhanakan: `^[^\s@]+@[^\s@]+\.[^\s@]+$`, divalidasi juga via HTML5 `type="email"` di form.
- Wajib huruf kecil saat disimpan (`toLowerCase()`) untuk menghindari duplikasi karena perbedaan kapitalisasi.
- Bersifat opsional di `customers` dan `users` (users: dipakai untuk notifikasi sistem, bukan login).

### Harga / Nominal (Rupiah)
- Semua nominal uang (`orders.total`, `orders.subtotal`, `order_items.unit_price`, `payments.amount`, `materials.standard_cost`, dll) disimpan sebagai **integer, tanpa desimal** — satuan Rupiah penuh (bukan sen).
- Alasan: Rupiah secara praktik tidak memakai pecahan di bawah 1 rupiah dalam transaksi percetakan sehari-hari; integer menghindari masalah pembulatan floating-point dan mempermudah agregasi laporan keuangan.
- Tipe kolom database: `decimal` atau `bigint` (bukan `float`/`double`) — hindari floating point untuk nilai uang meski disimpan sebagai bilangan bulat, agar operasi agregasi (SUM) tetap presisi.
- Nilai negatif tidak diperbolehkan kecuali untuk field refund/adjustment yang secara eksplisit didefinisikan sebagai pengurang (mis. `dp_refund_amount`).

---

## Required Field Minimal per Entitas Utama

**Order** (`orders`)
- `customer_id`, `created_by`, minimal 1 `order_item`, `deadline`
- Status awal wajib `DRAFT`; `total`/`subtotal` dihitung sistem dari `order_items`, tidak diinput manual

**Customer** (`customers`)
- `name`, `phone` (format valid sesuai aturan di atas)
- `email` opsional; `customer_code` auto-generate sistem

**Payment** (`payments`)
- `order_id`, `amount` (> 0), `method` (CASH/TRANSFER/QRIS), `received_by`
- `reference` wajib jika `method = TRANSFER`

**Production Job** (`production_jobs`)
- `order_id`, `machine_id`, `operator_id`, `planned_qty` (> 0)
- `job_code` auto-generate sistem; `actual_qty` wajib diisi saat SCAN 2 (selesai produksi), tidak boleh 0
- `waste_reason` wajib jika `waste_qty > 0`
