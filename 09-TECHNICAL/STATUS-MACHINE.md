# STATUS MACHINE — Alur Status Order

> Dokumen ini menggambarkan **implementasi sebenarnya** di server actions
> (`src/actions/*`). Sumber tunggal daftar status: `frontend/src/lib/order-status.ts`.

## Prinsip: status order itu "kasar"

`Order.status` hanya menandai **fase besar** pesanan. Detail sub-langkah TIDAK
disimpan di `Order.status`, tapi di record anak:

| Sub-proses | Di mana state-nya |
|---|---|
| Pengerjaan & approval desain | `DesignJob.status` + `DesignVersion.approval_status` (PENDING/DESIGNING/WAITING_APPROVAL/APPROVED/REJECTED) |
| Produksi per item, jeda, rework | `ProductionJob.status` (PRODUCTION_QUEUED/ASSIGNED/STARTED/PAUSED/COMPLETE/QC_PASSED/FINISHING_STARTED/FINISHING_COMPLETE/STORED/IN_TRANSIT/PICKED_UP · FAILED_REWORK · SUPERSEDED = job rework yang sudah digantikan) |
| Hasil QC | `QcRecord` (PASS/FAIL + kategori + rework_decision) |
| Finishing per job | `FinishingJob.status` |
| Penyimpanan & insiden rak | `StorageItem.status` (STORED/INCIDENT/IN_TRANSIT/RELEASED) |
| Serah terima | `PickupRecord` (dibuat saat SCAN 10) |

Konsekuensinya, `Order.status` **melewati** beberapa nama yang mungkin diharapkan
dari alur naratif (mis. tidak ada `APPROVED` atau `PICKED_UP` di level order —
itu ada di record anak).

---

## Status Order (yang benar-benar dipakai)

### PRINTING (`order_type = "PRINTING"`)

| Status | Kapan di-set | Oleh |
|---|---|---|
| `DRAFT` | `createPrintingOrder` — order + item + DesignJob kosong (PENDING) | Admin / Designer |
| `DESIGNING` | Upload versi desain pertama (non-makloon) | Designer (`uploadDesignVersion`) |
| `WAITING_PAYMENT` | `approveDesign` saat `paid_amount < dp_required`; makloon: langsung dari upload | Designer / Admin / sistem |
| `CONFIRMED` | `approveDesign` saat DP sudah terpenuhi · `addPayment` saat DP tercapai · `decideDiscount` (approve) saat DP baru tercapai | Admin / sistem |
| `PRODUCTION_ASSIGNED` | **Auto-release** (`autoReleaseToProduction`, Completeness Gate lolos) **atau** `assignProductionJob` manual (item tanpa mesin default / mesin MAINTENANCE / override). Job dibuat 1 per item — `PRODUCTION_QUEUED` (auto, belum ada operator) atau `PRODUCTION_ASSIGNED` (manual, operator di-pin). | sistem / Admin |
| `PRODUCTION_STARTED` | SCAN 1 — operator klaim/mulai job pertama | Operator (`startProduction`) |
| `QC_PENDING` | SCAN 2 — **semua** job order sudah `PRODUCTION_COMPLETE` (`advanceOrderWhenAllJobs`) | sistem |
| `QC_PASSED` | SCAN 3 PASS — semua job `QC_PASSED` | Gudang (`submitQC`) |
| `QC_REWORK_PENDING` | SCAN 3 FAIL — job jadi `FAILED_REWORK` | Gudang |
| `PRODUCTION_ASSIGNED` (lagi) | `decideRework` APPROVED/REJECTED → child/reprint job dibuat, job lama → `SUPERSEDED` (keluar dari antrian rework & tak lagi menahan kemajuan order), order balik ke pipeline | Owner |
| `ON_HOLD` | `decideRework` HOLD | Owner |
| `FINISHING_STARTED` | SCAN 4 — semua job `FINISHING_STARTED` | Gudang |
| `FINISHING_COMPLETE` | SCAN 5 — semua job `FINISHING_COMPLETE` (label dicetak) | Gudang |
| `STORED` | SCAN 6+7 — job disimpan ke rak (`StorageItem` STORED) | Gudang (`assignStorageLocation`) |
| `READY_FOR_PICKUP` | langsung setelah `STORED` (aksi yang sama) → antre notifikasi WA | sistem |
| `IN_TRANSIT` | SCAN 9 — barang dikonfirmasi di counter, slot rak dibebaskan | Gudang (`confirmItemAtCounter`) |
| `FINAL_AUDIT_PENDING` | SCAN 10 — `releaseOrder`: gate **lunas** (atau Owner + alasan override) → `PickupRecord` dibuat, job → `PICKED_UP` | Admin / Owner |
| `CLOSED` | `submitFinalAudit` hasil **GREEN** | Admin (`submitFinalAudit`) |
| `FINAL_AUDIT_COMPLETE` | `submitFinalAudit` hasil **YELLOW** (perlu approve Owner) | Admin |
| `CLOSED` / `ON_HOLD` | `approveFinalAudit` atas audit YELLOW (approve → CLOSED, tolak → ON_HOLD) | Owner |
| `ON_HOLD` | `submitFinalAudit` hasil **RED** (blokir CLOSED) | sistem |

### RETAIL (`order_type = "RETAIL"`)

| Status | Kapan | Oleh |
|---|---|---|
| `CLOSED` | `processRetailOrder` — order **lahir langsung** `CLOSED`: item + potong stok (`RetailStockMovement`) + `Payment` lunas, semua dalam satu transaksi. Tidak ada Design/Produksi/QC/Finishing/Storage/Audit. | Kasir/Admin |
| `CANCELLED` | `voidRetailOrder` — restok + `RetailStockMovement` IN kompensasi + `Payment` refund negatif. Admin (hari yang sama) / Owner (kapan saja). **Ini satu-satunya transisi keluar dari `CLOSED` di seluruh sistem.** | Admin / Owner |

---

## Kondisi khusus (bisa dari banyak titik)

| Status | Kapan | Siapa |
|---|---|---|
| `ON_HOLD` | `freezeOrder` kapan saja · audit RED · rework HOLD. `unfreezeOrder` mengembalikan ke status sebelum-hold (dari audit log), kecuali hold berasal dari audit-RED / rework-HOLD. | Owner |
| `CANCELLED` | Pra-produksi (`DRAFT`..`CONFIRMED`): Admin/Owner, DP refundable. In-produksi ke atas: **Owner saja**, DP hangus, hanya pelunasan di atas `dp_required` yang refundable. Job → CANCELLED, slot rak dibebaskan. | Admin / Owner (`cancelOrder`) |
| `INCIDENT` | `reportStorageIncident` — barang tak ditemukan di lokasi tercatat. `StorageItem` → INCIDENT. | Gudang |

---

## Diagram alur (implementasi)

```
DRAFT ──upload desain──▶ DESIGNING ──approveDesign──▶ WAITING_PAYMENT ──DP cukup──▶ CONFIRMED
  │  (makloon: DRAFT ─upload─▶ WAITING_PAYMENT)          (approveDesign +           │
  │                                                       DP sudah cukup) ──────────┤
  ▼                                                                                 ▼
CONFIRMED ──auto-release / assign manual──▶ PRODUCTION_ASSIGNED
   PRODUCTION_ASSIGNED ─SCAN1─▶ PRODUCTION_STARTED ─SCAN2(semua job)─▶ QC_PENDING
   QC_PENDING ─SCAN3 PASS─▶ QC_PASSED
             └─SCAN3 FAIL─▶ QC_REWORK_PENDING ─decideRework APPROVE/REJECT─▶ PRODUCTION_ASSIGNED
                                              └─HOLD─▶ ON_HOLD
   QC_PASSED ─SCAN4─▶ FINISHING_STARTED ─SCAN5─▶ FINISHING_COMPLETE
   FINISHING_COMPLETE ─SCAN6+7─▶ STORED ─(langsung)─▶ READY_FOR_PICKUP
   READY_FOR_PICKUP ─SCAN9─▶ IN_TRANSIT ─SCAN10 (lunas / Owner override)─▶ FINAL_AUDIT_PENDING
   FINAL_AUDIT_PENDING ─submitFinalAudit─▶ GREEN: CLOSED
                                          YELLOW: FINAL_AUDIT_COMPLETE ─approveFinalAudit─▶ CLOSED / ON_HOLD
                                          RED: ON_HOLD

RETAIL:  (buat) ─▶ CLOSED  ─voidRetailOrder─▶ CANCELLED
```

---

## Aturan

- **Tiap transisi di-guard**: aksi memakai `updateMany({ where: { id, status: { in: [status_asal_yang_sah] } } })`. Status tidak sah → tidak ada perubahan (tidak error diam-diam ganda).
- **Order multi-item**: `advanceOrderWhenAllJobs` (`src/lib/order-progress.ts`) — order hanya maju kalau **semua** job hidup order (bukan child rework, bukan `FAILED_REWORK`/`SUPERSEDED`) sudah **minimal** mencapai fase tsb. Perbandingan pakai **peringkat fase**, bukan cocok status persis, supaya job yang lebih cepat (sudah menyalip fase yang dicek) tetap dihitung "sudah sampai" dan order tidak macet. Helper tidak pernah memundurkan status dan tidak menyentuh status non-pipeline (`ON_HOLD`, `QC_REWORK_PENDING`, dst). Pengecualian: `startProduction` memajukan order begitu **job pertama** mulai. Rantai storage→counter→release (`src/actions/storage.ts`) memakai `allLiveJobsReached` dengan aturan sama: `READY_FOR_PICKUP` hanya setelah **semua** job `STORED`, `IN_TRANSIT` hanya setelah semua job di counter, `releaseOrder` melepas **semua** job + StorageItem order sekaligus (bukan hanya yang di-scan).
- **Deadline dianggap terpenuhi** sejak `READY_FOR_PICKUP` (lihat `DEADLINE_SETTLED` di `src/lib/order-status.ts` + `RESOLVED_STATUSES` di cron `deadline-alerts`). Order pada status itu ke atas tidak lagi dihitung "overdue".
- **Setelah `CLOSED`**: tidak ada transisi maju. Perbaikan data lewat `corrections` (record baru, tidak mengedit asli). Pengecualian tunggal: `voidRetailOrder` (`CLOSED → CANCELLED`) untuk pembatalan transaksi retail.
- Setiap perpindahan dicatat di `audit_logs`.

---

## Status yang TIDAK ada di implementasi

Nama-nama ini pernah ada di rancangan lama tapi **tidak pernah di-set** sebagai
`Order.status` — sub-state-nya ada di record anak:

`WAITING_APPROVAL`, `APPROVED` (→ `DesignVersion.approval_status`) ·
`QC_FAILED`, `REWORK_APPROVED` (→ `ProductionJob` / `QcRecord`) ·
`STORAGE_PENDING` (order langsung `STORED`) ·
`PRODUCTION_QUEUED`, `PRODUCTION_COMPLETE`, `PRODUCTION_PAUSED`, `PICKED_UP` (→ `ProductionJob.status`) ·
`NEW_RETAIL_ORDER`, `RETAIL_PAYMENT_COMPLETED` (order retail lahir langsung `CLOSED`).
