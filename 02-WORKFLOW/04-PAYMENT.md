# Payment Workflow

## Flow Umum

```
ORDER DIBUAT
  → Payment Request dibuat
  → Konsumen bayar DP
  → Admin konfirmasi DP
  → Status: PARTIAL (jika DP)
  → Produksi bisa dimulai (jika DP sudah memenuhi syarat)
  → Pelunasan saat pickup atau sebelumnya
  → Status: PAID
```

---

## Aturan DP (Uang Muka)

### Konsumen Datang Langsung (Walk-in)
- DP minimum: **50% dari total order**
- Tidak ada pengecualian tanpa persetujuan Owner
- Admin TIDAK BISA override tanpa Owner
- Jika konsumen tidak mau DP 50%: order tidak bisa diproses ke produksi

### Konsumen Remote (Online / Makloon)
- DP minimum default: **50% dari total order**
- Namun terdapat tombol **"Setujui Pengecualian DP"** yang hanya bisa diakses oleh:
  - Admin (dengan batas minimal DP 30%)
  - Owner (bisa approve berapapun termasuk 0% jika ada alasan kuat)
- Setiap pengecualian DP wajib disertai alasan dan tercatat di audit log
- Konsumen remote yang belum bayar DP tidak bisa masuk antrian produksi

### Override / Pengecualian Khusus
- Tombol "Override DP" hanya tampil untuk role: `admin`, `owner`
- Tidak ada override diam-diam — semua exception tercatat di `audit_logs`
- Format log: `actor_id | action=DP_OVERRIDE | order_id | original_dp_pct | approved_dp_pct | reason | timestamp`

---

## Konfirmasi Payment

- Admin yang menerima pembayaran wajib mencatat:
  - Jumlah yang diterima
  - Metode pembayaran (cash, transfer bank, QRIS)
  - Nomor referensi (jika transfer)
  - Timestamp penerimaan
- Designer/Operator/Gudang TIDAK DAPAT mengkonfirmasi payment

---

## Kondisi Pelunasan

- Barang dapat diserahkan ke konsumen jika:
  - Sisa tagihan = 0 (LUNAS), ATAU
  - Ada persetujuan Owner untuk penyerahan dengan sisa tagihan (dan ini tercatat)

---

## Pencatatan

Simpan di tabel `payments`:
- `order_id`
- `amount`
- `method` (CASH / TRANSFER / QRIS)
- `reference` (nomor referensi transfer)
- `status` (PENDING / CONFIRMED / REJECTED)
- `received_by` (user_id Admin)
- `paid_at`
- `notes`

Simpan di tabel `orders`:
- `dp_required`: jumlah DP minimum (computed: total × 0.5)
- `dp_override_pct`: jika ada pengecualian
- `dp_override_by`: user_id yang setujui
- `dp_override_reason`
- `paid_amount`: total yang sudah masuk
- `balance`: sisa tagihan

---

## Aturan Tambahan

- Designer TIDAK BISA menandai order sebagai lunas
- Designer TIDAK BISA melihat nominal total pembayaran yang diterima bisnis
- Designer hanya melihat status: "DP Terpenuhi / Belum Terpenuhi"
