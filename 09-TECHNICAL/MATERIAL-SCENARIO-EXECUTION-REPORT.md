# Material Scenario Execution Report

- Tenant: `duniapercetakan`
- Waktu: 2026-09-15T18:08:01.611Z
- Hasil transaksi: seluruh fixture transaksi dibuat dalam satu transaksi lalu di-rollback; saldo database tetap pada baseline.
- Ringkasan: **7 PASS**, **3 REVIEW**, **0 FAIL**.

| ID | Skenario | Status | Bukti |
|---|---|---|---|
| CAT-01 | Katalog dan satuan material | **PASS** | 9 material aktif; ROLL, RIM, LITER, KG, PCS, dan custom PAKET tersedia. |
| CAT-02 | Allowlist product → material | **PASS** | Banner hanya menampilkan MAT-0001, MAT-0002, MAT-0003. |
| TX-01 | Stok masuk langsung | **PASS** | Saldo MAT-0002: 50.5 → 50.75 ROLL; movement IN terbentuk. |
| TX-02 | PO sebagian, penuh, dan overreceipt | **PASS** | PO PO-SCENARIO-A49F75FD: SUBMITTED → PARTIAL (4) → RECEIVED (10); overreceipt ditolak. |
| TX-03 | Adjustment dan saldo negatif | **PASS** | Adjustment +1.5 tercatat; target negatif ditolak. |
| TX-04 | Stock opname dan approval | **PASS** | Sesi 04edd9c7-96d2-42b9-afb7-6f6c0dfc3db7 menghasilkan variance -0.5 dan adjustment. |
| ALERT-01 | Alert stok minimum | **PASS** | Flexi China 400 gr: 0 ROLL, minimum 10; kondisi alert terdeteksi. |
| CONC-01 | Dua transaksi bersamaan | **REVIEW** | Belum dieksekusi pada fixture ini karena perlu dua sesi database nyata; mekanisme row lock wajib diuji di staging dengan dua worker. |
| PROD-01 | Pemakaian produksi dan waste | **REVIEW** | Perlu job produksi nyata agar pemakaian utama, consumable tinta, dan waste dapat diuji end-to-end tanpa membuat order palsu. |
| ROLE-01 | Role Owner/Admin/Gudang/Operator/Designer | **REVIEW** | Fixture memastikan data lintas role tersedia; validasi izin harus dijalankan melalui UI/session test per role. |

## Baseline yang diisi

Material utama dan fixture satuan dibuat oleh `setup-material-scenarios.ts`. Saldo awal tercatat sebagai movement `IN` dengan referensi `OPENING-MATERIAL-SCENARIO`. Fixture `QA-UNIT-*` sengaja diberi prefix QA supaya mudah dihapus sebelum input stok produksi.

## Tahap lanjutan

1. Jalankan alur UI untuk role Gudang pada stok masuk, PO, dan stock opname.
2. Buat satu order Banner dan satu order Stiker untuk menguji filter material pada form order.
3. Rilis order ke produksi, isi pemakaian Flexi/Tinta/Waste, lalu verifikasi movement dan audit log.
4. Jalankan uji dua worker bersamaan di staging untuk memastikan claim/lock atomik.
5. Setelah validasi selesai, hapus fixture `QA-UNIT-*` dan supplier `SUP-QA-001` sebelum memasukkan stok nyata.
