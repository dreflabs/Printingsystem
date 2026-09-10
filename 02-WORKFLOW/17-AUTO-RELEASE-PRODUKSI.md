# Auto-Release ke Produksi — Hapus Approval Admin Manual

Sebelumnya order harus ditekan tombol **"Assign ke Produksi"** oleh Admin sebelum
bisa dikerjakan Operator. Tombol itu menggabung 2 hal: (a) cek kelayakan, dan
(b) routing mesin+operator. Revisi ini menghapus keharusan (a) sebagai aksi manual
— cek kelayakan dijalankan sistem, dan order turun ke produksi otomatis.

---

## 1. Completeness Gate

Fungsi murni `checkProductionReadiness()` (`src/lib/production-readiness.ts`).
Dijalankan otomatis setiap kali order berpotensi menjadi `CONFIRMED`:
`addPayment`, `approveDesign`, `decideDiscount`.

### Syarat WAJIB (semua harus lolos)

| # | Syarat | Cek |
|---|--------|-----|
| 1 | DP terpenuhi | `paid_amount ≥ dp_required` |
| 2 | Desain disetujui | ada `DesignJob` berstatus `APPROVED` |
| 3 | File desain final | versi APPROVED punya `file_path`/`file_name` |
| 4 | Diskon tidak menggantung | `discount == 0` atau `discount_approved_by` terisi |
| 5 | Identitas pemesan (order PRINTING) | `customer_id` + nama + kontak (phone/email) |
| 6 | Deadline terisi | `order.deadline != null` |
| 7 | Minimal 1 item | — |
| 8 | Tiap item lengkap | produk/deskripsi, qty > 0, bahan, harga > 0, ukuran (bila `product.unit != PCS`) |

### Hasil

- **`autoRoutable`** = semua syarat lolos **dan** setiap item punya
  `product.default_machine_id`. Hanya kondisi ini yang memicu auto-release.
- **`missing[]`** = daftar alasan siap tampil ke Admin kalau order tertahan.

---

## 2. Auto-Release

`autoReleaseToProduction()` (`src/lib/auto-release.ts`), dipanggil di dalam
transaksi caller tepat setelah order jadi `CONFIRMED`:

1. Idempotent — kalau order sudah punya Production Job, tidak melakukan apa-apa.
2. Jalankan Completeness Gate. Kalau tidak `autoRoutable` → order tetap
   `CONFIRMED`, kembalikan `missing`.
3. Cek semua mesin default ber-status `ACTIVE`. Kalau ada yang MAINTENANCE/INACTIVE
   → tidak auto-release (Admin yang arahkan).
4. Buat 1 `ProductionJob` per item:
   - `machine_id` = `product.default_machine_id`
   - `operator_id` = **null** (operator klaim sendiri)
   - `status` = `PRODUCTION_QUEUED`
5. `order.status` → `PRODUCTION_ASSIGNED` (semantik order-level "masuk pipeline
   produksi" tidak berubah).
6. Audit log: `action = ORDER_AUTO_RELEASED`, `actor = <pemicu>` (Admin yang catat
   pembayaran / approve desain / approve diskon), `trigger`, `job_codes`.

---

## 3. Operator Mengklaim Job

- Operator Dashboard menampilkan **antrian klaim**: job `PRODUCTION_QUEUED` yang
  `operator_id`-nya masih null (diurut prioritas → deadline → waktu buat).
- **SCAN 1** (`startProduction`): kalau job `PRODUCTION_QUEUED` tanpa operator →
  operator yang scan otomatis jadi `operator_id`-nya, status → `PRODUCTION_STARTED`.
- Operator **boleh punya beberapa job aktif sekaligus** — tidak ada batas jumlah
  job `PRODUCTION_STARTED`/`PRODUCTION_PAUSED` per operator (lihat `05-PRODUCTION.md`
  bagian "Multi-job per Operator", termasuk catatan overlap durasi di laporan).
- Job `PRODUCTION_ASSIGNED` (di-pin Admin) tetap hanya bisa dimulai operator yang
  di-pin.

---

## 4. Jalur Manual (Fallback)

Form **"Assign ke Produksi"** (`assignProductionJob`) tetap ada, dipakai saat
auto-release tidak jalan:

- item custom tanpa produk / produk tanpa `default_machine_id`
- mesin default sedang MAINTENANCE/INACTIVE
- Admin perlu meng-override mesin/operator/prioritas (mis. rush)

Job hasil jalur ini berstatus `PRODUCTION_ASSIGNED` dengan operator di-pin.

---

## 5. Perubahan Schema

| Objek | Perubahan |
|-------|-----------|
| `ProductionJob.operator_id` | `NOT NULL` → **nullable** (job antri belum punya operator) |
| `Product.default_machine_id` | kolom baru (FK ke `Machine`, `ON DELETE SET NULL`) |

Migrasi: `prisma/migrations/20260908050000_auto_release_production/`.

---

## 6. Yang BELUM termasuk revisi ini

Batch/Multiple Job, actual qty & material otomatis, penyederhanaan form Operator,
dan pemisahan dashboard "Siap Diambil" — dibahas terpisah, belum diimplementasikan.
