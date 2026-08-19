# STATUS MACHINE — Alur Status Order

## Apa Itu Status Machine?

Status machine adalah **peta urutan status** yang menunjukkan:
- Status apa saja yang bisa dimiliki sebuah order/job
- Status apa yang bisa berpindah ke status apa (tidak boleh loncat sembarangan)
- Siapa yang berhak mengubah ke status tertentu

---

## Status Utama Order

```
DRAFT
  └─ Designer buat order baru

DESIGNING
  └─ Designer sedang buat/upload desain

WAITING_APPROVAL
  └─ Desain sudah ada, menunggu persetujuan konsumen (untuk tipe WA)

APPROVED
  └─ Desain sudah disetujui konsumen

WAITING_PAYMENT
  └─ Menunggu DP 50% dari konsumen

CONFIRMED
  └─ DP sudah masuk, order dikonfirmasi Admin Sales

PRODUCTION_ASSIGNED
  └─ Supervisor assign job ke operator & mesin

PRODUCTION_STARTED
  └─ Operator scan QR → mulai produksi (SCAN 1)

PRODUCTION_COMPLETE
  └─ Operator scan QR → selesai produksi, input qty & waste (SCAN 2)

QC_PENDING
  └─ Menunggu inspeksi QC

QC_PASSED
  └─ QC lulus → bisa lanjut ke finishing

QC_FAILED
  └─ QC gagal → sistem generate **Child Job** baru (sufiks -R1) untuk mencegah tumpang tindih waktu. Masuk rework workflow.

QC_REWORK_PENDING
  └─ Menunggu penjelasan operator + approval Owner untuk Child Job tersebut

REWORK_APPROVED
  └─ Owner setujui rework → Child Job diubah statusnya ke PRODUCTION_STARTED

FINISHING_STARTED
  └─ Finishing Staff scan QR → mulai finishing (SCAN 4)

FINISHING_COMPLETE
  └─ Finishing selesai, label dicetak (SCAN 5)

STORAGE_PENDING
  └─ Menunggu proses simpan ke gudang

STORED
  └─ Barang tersimpan di gudang LT3 (SCAN 6 + SCAN 7)

READY_FOR_PICKUP
  └─ Barang siap diambil konsumen → WA notifikasi dikirim

IN_TRANSIT
  └─ Barang sedang dipindah dari LT3 ke Counter LT1

PICKED_UP
  └─ Barang sudah diserahkan ke konsumen (SCAN 10)

FINAL_AUDIT_PENDING
  └─ Menunggu proses final audit oleh Admin Sales

FINAL_AUDIT_COMPLETE
  └─ Audit selesai dengan hasil GREEN, YELLOW (butuh approval Supervisor/Owner), atau RED
     (RED = order TIDAK bisa lanjut ke CLOSED — order dikembalikan ke ON_HOLD untuk
     investigasi Owner, lihat cabang RED di diagram alur)

CLOSED
  └─ Order sepenuhnya selesai. Tidak bisa diedit langsung.

ON_HOLD
  └─ Order dibekukan oleh Owner (untuk investigasi atau sengketa)

CANCELLED
  └─ Order dibatalkan (dengan kebijakan DP hangus jika produksi sudah berjalan)

INCIDENT
  └─ Barang tidak ditemukan di lokasi storage yang tercatat

// ── STATUS KHUSUS RETAIL (order_type = RETAIL) ──

NEW_RETAIL_ORDER
  └─ Kasir/Admin Sales membuat pesanan Direct Sales (barang jadi)

RETAIL_PAYMENT_COMPLETED
  └─ Pembayaran dikonfirmasi lunas, stok barang dipotong otomatis

CLOSED
  └─ (sama dengan PRINTING) Transaksi selesai. Tidak bisa diedit langsung.

CANCELLED
  └─ (sama dengan PRINTING) Hanya berlaku sebelum RETAIL_PAYMENT_COMPLETED
```

---

## Diagram Alur Utama

```
DRAFT → DESIGNING → WAITING_APPROVAL* → APPROVED
                  ↘ (walk-in/makloon langsung) ↗
APPROVED → WAITING_PAYMENT → CONFIRMED
CONFIRMED → PRODUCTION_ASSIGNED → PRODUCTION_STARTED → PRODUCTION_COMPLETE
PRODUCTION_COMPLETE → QC_PENDING → QC_PASSED → FINISHING_STARTED → FINISHING_COMPLETE
                               ↘ QC_FAILED (Auto-generate Child Job -R1) → QC_REWORK_PENDING → REWORK_APPROVED → PRODUCTION_STARTED (untuk Child Job)
FINISHING_COMPLETE → STORAGE_PENDING → STORED → READY_FOR_PICKUP
READY_FOR_PICKUP → IN_TRANSIT → PICKED_UP
PICKED_UP → FINAL_AUDIT_PENDING → FINAL_AUDIT_COMPLETE → CLOSED
                                 ↘ (hasil RED) → ON_HOLD (investigasi Owner)

*WAITING_APPROVAL hanya untuk tipe konsumen WhatsApp
```

### Alur RETAIL (order_type = RETAIL)

```
NEW_RETAIL_ORDER → RETAIL_PAYMENT_COMPLETED → CLOSED

*Tidak ada Design, Production, QC, Finishing, Storage, atau Final Audit
*customer_id opsional (boleh null untuk pelanggan guest/walk-in)
*Pengurangan stok retail_products terjadi otomatis saat RETAIL_PAYMENT_COMPLETED
```

---

## Status Khusus (Bisa Terjadi di Berbagai Titik)

| Status | Kapan | Siapa yang Bisa Set |
|--------|-------|---------------------|
| ON_HOLD | Kapan saja, untuk investigasi | Owner saja |
| CANCELLED | Sebelum produksi dimulai (DP dikembalikan) atau setelah produksi (DP hangus) | Owner / Admin Sales |
| INCIDENT | Saat barang tidak ditemukan di storage | Warehouse (report) |

---

## Aturan Perpindahan Status

- Status **tidak bisa loncat** (contoh: tidak bisa dari CONFIRMED langsung ke PICKED_UP)
- Setiap perpindahan status dicatat di `audit_logs` secara real-time
- Perpindahan status yang tidak valid di-blokir oleh sistem di server
- Setelah CLOSED: tidak ada perpindahan status — hanya correction/adjustment yang tercatat sebagai record baru

---

## Siapa yang Bisa Ubah Status

| Transisi | Role yang Berhak |
|----------|-----------------|
| DRAFT → DESIGNING | Designer Sales |
| DESIGNING → WAITING_APPROVAL | Designer Sales |
| WAITING_APPROVAL → APPROVED | Admin Sales |
| Walk-in/Makloon → APPROVED | Designer Sales |
| APPROVED → WAITING_PAYMENT | Sistem otomatis |
| WAITING_PAYMENT → CONFIRMED | Admin Sales |
| CONFIRMED → PRODUCTION_ASSIGNED | Supervisor |
| PRODUCTION_ASSIGNED → PRODUCTION_STARTED | Operator (via scan) |
| PRODUCTION_STARTED → PRODUCTION_COMPLETE | Operator (via scan) |
| PRODUCTION_COMPLETE → QC_PENDING | Sistem otomatis |
| QC_PENDING → QC_PASSED / QC_FAILED | QC Inspector |
| QC_FAILED → QC_REWORK_PENDING | Sistem otomatis |
| QC_REWORK_PENDING → REWORK_APPROVED | Owner / Supervisor |
| QC_PASSED → FINISHING_STARTED | Finishing Staff (via scan) |
| FINISHING_STARTED → FINISHING_COMPLETE | Finishing Staff (via scan) |
| FINISHING_COMPLETE → STORAGE_PENDING | Finishing Staff (via scan, serah terima ke Warehouse) / Sistem otomatis |
| STORAGE_PENDING → STORED | Warehouse Staff (via scan Job QR + Location QR) |
| STORED → READY_FOR_PICKUP | Sistem otomatis |
| READY_FOR_PICKUP → IN_TRANSIT | Warehouse (via scan) |
| IN_TRANSIT → PICKED_UP | Admin Sales (via scan) |
| PICKED_UP → FINAL_AUDIT_PENDING | Sistem otomatis |
| FINAL_AUDIT_PENDING → FINAL_AUDIT_COMPLETE | Admin Sales (submit hasil GREEN/YELLOW/RED) |
| FINAL_AUDIT_COMPLETE → CLOSED | Sistem otomatis jika GREEN; Supervisor / Owner approve jika YELLOW |
| FINAL_AUDIT_COMPLETE → ON_HOLD | Sistem otomatis jika hasil RED (blokir CLOSED, wajib investigasi Owner) |
| Kapan saja → ON_HOLD | Owner |
| Sebelum produksi → CANCELLED | Admin Sales / Owner |
| Setelah produksi → CANCELLED | Owner saja |

---

## Siapa yang Bisa Ubah Status (RETAIL)

| Transisi | Role yang Berhak |
|----------|-----------------|
| Buat → NEW_RETAIL_ORDER | Admin Sales, Owner |
| NEW_RETAIL_ORDER → RETAIL_PAYMENT_COMPLETED | Admin Sales (konfirmasi pembayaran) |
| RETAIL_PAYMENT_COMPLETED → CLOSED | Sistem otomatis (setelah barang diserahkan) |
| NEW_RETAIL_ORDER → CANCELLED | Admin Sales, Owner (hanya sebelum pembayaran) |
