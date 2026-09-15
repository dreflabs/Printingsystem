# Audit Komprehensif Material, Stok, dan Kompatibilitas Produksi

Tanggal audit: 16 September 2026  
Scope: master material, ProductMaterial, MachineMaterial, penerimaan stok, Purchase Order, pemakaian produksi, waste, stock opname, adjustment, alert, permission, audit log, dokumen workflow, dan database PostgreSQL lokal.

## Kesimpulan

Fondasi material sudah cukup baik untuk tenant kecil. Penerimaan dan pemakaian memakai transaksi/row lock, ProductMaterial menjadi allowlist produk, dan routing produksi memvalidasi material terhadap mesin.

Modul belum aman untuk diberi status selesai sebelum temuan P1 ditutup. Temuan tertinggi:

1. updateMaterial menyebarkan seluruh payload client ke Prisma; field internal seperti saldo, kode, atau tenant berisiko ikut berubah.
2. createMaterial tidak menolak saldo awal negatif.
3. createMaterial dan adjustMaterialStock tidak membuat audit log terpisah.
4. Admin memiliki permission server untuk approval stock opname, padahal dokumen dan UI menetapkan Owner.
5. getOrderFormData masih mengirim seluruh material aktif walaupun form memakai allowlist produk.
6. Dua stock opname dapat dibuat bersamaan karena belum ada unique guard database.
7. Presisi jumlah inbound, adjustment, opname, dan produksi belum memakai satu kebijakan.
8. Database lokal saat audit kosong setelah reset material: 0 material, 0 movement, 0 PO. Semua 8 produk cetak aktif belum mempunyai mapping material.

Status: **fondasi baik, tetapi belum aman dan lengkap untuk produksi multi-user sebelum kontrol P1 ditutup.**

## Bukti database lokal

Pemeriksaan read-only menghasilkan:

- Material: 0 total dan 0 aktif.
- Material movement: 0.
- Purchase Order dan item: 0.
- Produk cetak aktif: 8.
- ProductMaterial aktif: 0.
- Semua 8 produk aktif belum memiliki mapping/default material aktif.
- Order item cetak: 14, semuanya belum memiliki material karena database material telah dikosongkan.
- Tidak ditemukan saldo negatif, aritmetika movement rusak, OUT/WASTE tanpa job, PO diterima melebihi pesanan, atau status PO yang tidak konsisten.
- Migrasi allowlist, material integrity, stocktake, operational alert, dan purchase order tercatat sudah diterapkan.

Kondisi ini adalah database lokal saat audit. Database server perlu diperiksa dengan invariant yang sama sebelum deploy.

## Temuan P1 — wajib ditutup sebelum deploy

### P1.1 Mass assignment pada update material

Bukti: [master-data.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/master-data.ts:590-645).

Action hanya mengetik field yang diperbolehkan, tetapi runtime menyebarkan seluruh property input ke Prisma. TypeScript bukan validasi runtime. Payload langsung dapat membawa current_stock, material_code, tenant_id, added_by, atau timestamp.

Perbaikan: buat patch eksplisit hanya untuk field master yang boleh diedit; jangan terima field internal dari client; tambahkan negative test payload tambahan.

### P1.2 Saldo material baru dapat negatif

Bukti: [master-data.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/master-data.ts:545-570) dan validator [master-data.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/master-data.ts:925-931).

Validator tidak memeriksa current_stock < 0. UI mengirim 0, tetapi server harus tetap fail closed.

Perbaikan: wajibkan current_stock >= 0. Rekomendasi lebih baik: material baru selalu saldo 0 lalu saldo awal dicatat sebagai movement OPENING_BALANCE dengan alasan dan actor.

### P1.3 Audit log create dan adjustment tidak lengkap

Bukti:

- createMaterial selesai di [master-data.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/master-data.ts:582-583) tanpa logAction.
- adjustMaterialStock hanya membuat movement di [master-data.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/master-data.ts:661-687).

Perbaikan: tambahkan MATERIAL_CREATED dan MATERIAL_ADJUSTED dengan before/after, delta, alasan, reference, dan actor. Ini juga menyelesaikan masalah saldo awal yang saat ini tidak punya movement pembuka.

### P1.4 Separation of duties stock opname tidak ditegakkan server

Bukti: Admin mendapat material.stocktake_approve di [permissions.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/lib/permissions.ts:45). Action approval hanya memeriksa permission di [stocktake.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/stocktake.ts:170-205). UI memang menyembunyikan tombol Admin, tetapi direct action tetap mungkin.

Dokumen menetapkan Owner sebagai approver: [MATERIAL-INVENTORY.md](/Users/drefan/Projects/PRINT%20PILOT/04-MODULES/MATERIAL-INVENTORY.md:158-171).

Perbaikan: hapus permission dari Admin atau ubah dokumen/UI menjadi dual control secara resmi. Tambahkan direct-action test.

### P1.5 Response form order membocorkan seluruh material

Bukti: [orders.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/orders.ts:657-745). materials global dikirim walaupun [NewOrderModal.tsx](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/components/orders/NewOrderModal.tsx:531-543) hanya memakai product.material_options.

Akibat: Designer dan role pemanggil dapat melihat nama, kode, serta tipe material yang tidak relevan melalui network.

Perbaikan: hapus materials global dari response; jika diperlukan, buat query terpisah dengan permission dan scope mesin/job.

### P1.6 Dua sesi stock opname dapat aktif bersamaan

Bukti: [stocktake.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/stocktake.ts:94-108). Read-then-create tidak dilindungi unique partial index atau tenant lock.

Perbaikan: partial unique index untuk DRAFT/SUBMITTED atau advisory lock, tangani konflik unique, dan uji concurrency.

### P1.7 PO CANCELLED didefinisikan tetapi belum dapat dibuat melalui workflow

Schema dan dokumen mengenal CANCELLED, penerimaan menolak status itu, tetapi tidak ada action/UI pembatalan. PO yang salah tetap menggantung.

Perbaikan: cancelPurchaseOrder dengan alasan wajib, guard SUBMITTED/PARTIAL, permission Admin/Owner, audit log, dan tampilan pembatalan.

## Temuan P2 — perlu diselesaikan sebelum skala meningkat

### P2.1 Presisi jumlah belum konsisten

Inbound/PO memakai helper dua desimal di [material-quantity.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/lib/material-quantity.ts:1-23). Adjustment di [master-data.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/master-data.ts:649-694), opname di [stocktake.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/stocktake.ts:119-146), dan produksi di [production-materials.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/lib/production-materials.ts:29-35) memakai aturan berbeda.

Tetapkan quantum per unit/material: PCS/LEMBAR biasanya integer; METER/LITER/KG dapat pecahan. Terapkan helper konsisten pada seluruh jalur.

### P2.2 Master material belum memvalidasi satuan custom di server

[validateMaterialSetup()](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/master-data.ts:925-931) belum memastikan unit allowlist, unit_custom wajib saat custom, type INK selalu consumable, dan skala angka sesuai Decimal.

### P2.3 Generator kode material rentan race

[master-data.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/master-data.ts:553-557) memakai count + 1. Concurrent create dapat membuat salah satu request gagal unique. Gunakan sequence, UUID pendek, atau retry khusus konflik.

### P2.4 Mapping material dapat diarahkan ke mesin nonaktif

Validator hanya mengecek tenant, bukan status mesin: [master-data.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/master-data.ts:929-930). Tolak mapping nonaktif atau tandai konfigurasi belum siap.

### P2.5 Produk dapat disimpan sebelum material kompatibel dengan mesin default

UI hanya memberi warning. saveProductMaterials tetap menyimpan, lalu auto-release menahan order di [auto-release.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/lib/auto-release.ts:153-179). Tolak konfigurasi atau beri status INCOMPLETE yang mencegah penjualan.

### P2.6 Operator menerima seluruh master dan riwayat material

Operator memiliki material.view. getMaterials mengembalikan seluruh material, saldo, standard cost, dan mesin; getMaterialMovementHistory mengembalikan supplier, biaya, referensi, dan actor: [master-data.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/master-data.ts:455-523).

Scope Operator ke mesin/job yang relevan dan hilangkan biaya beli/supplier dari payloadnya.

### P2.7 Produksi boleh membuat saldo minus

[production.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/production.ts:617-663) sengaja tidak memblokir stok kurang. Pilih kebijakan formal: hard block sebagai default, atau override Admin/Owner dengan alasan dan alert critical.

### P2.8 Waste belum punya batas anomali

[production.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/production.ts:575-586) hanya menolak waste negatif. Tambahkan batas waste terhadap usage/qty, kategori alasan, dan approval untuk nilai ekstrem.

### P2.9 Riwayat material belum menjadi laporan penuh

History hanya 200 movement terbaru tanpa pagination/filter/export: [master-data.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/master-data.ts:482-490). Dokumen menjanjikan laporan harian, bulanan, per job, mesin, operator, pembelian, adjustment, dan waste.

### P2.10 Tampilan inventori belum dikelompokkan per mesin

[MaterialTab.tsx](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/app/(dashboard)/finishing/MaterialTab.tsx:376-405) adalah tabel datar dengan filter group_name, sedangkan dokumen menjanjikan stok per mesin. Tambahkan section per mesin dan daftar material tanpa mesin.

### P2.11 Dokumen dan kode berbeda soal input pemakaian

Dokumen [MATERIAL-INVENTORY.md](/Users/drefan/Projects/PRINT%20PILOT/04-MODULES/MATERIAL-INVENTORY.md:86-101) menyebut Operator boleh melewati input pemakaian. Kode menolak materials=[]: [production.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/production.ts:579-607).

Rekomendasi profesional: pemakaian wajib untuk job yang memakai material, dengan override Admin/Owner beralasan. Ubah dokumen agar sama.

### P2.12 Alert stok dihitung saat action dipanggil

[getOperationalAlerts()](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/operational-alerts.ts:25-75) sinkron ketika dashboard/cron dibuka, bukan event langsung setelah movement. Pastikan cron aktif, monitor kegagalan cron, dan pertimbangkan outbox untuk alert kritis.

## Kontrol yang sudah baik

- ProductMaterial memiliki unique tenant/product/material dan unique default aktif per produk.
- Order memvalidasi allowlist produk–material di [orders.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/orders.ts:238-262).
- Auto-release dan getJobMaterialPlan memvalidasi produk–material serta material–mesin.
- Receipt langsung mengunci Material dan mencatat before/after.
- Receipt PO mengunci PO item dan Material, mencegah over-receipt.
- Pemakaian produksi memakai stable lock order dan decrement atomik.
- Stock opname menolak approval jika saldo berubah sejak snapshot.
- Query material utama memakai tenant scope.
- Unit test material lulus 3/3.
- Integration test katalog/routing fixture rollback lulus 1/1.

## Matriks kesiapan

### Sudah memiliki fondasi

- Master material aktif/nonaktif.
- Allowlist material produk.
- Penerimaan langsung dan PO dua desimal.
- Routing material ke mesin.
- Ledger movement dan stock opname serial.

### Belum boleh dianggap selesai

- Whitelist update material.
- Separation of duties approval opname.
- Audit log create/adjustment.
- Single active stocktake pada concurrency.
- Scope data material untuk Operator/Designer.
- Kebijakan stok minus dan presisi per unit.
- Pembatalan PO.
- Laporan historis material.

## Rencana remediasi

### Tahap 0 — sebelum server production

1. Whitelist patch updateMaterial.
2. Tolak saldo awal negatif dan catat opening movement.
3. Selaraskan permission Admin untuk approval opname.
4. Hapus payload materials global dari order form.
5. Tambahkan audit log create dan adjustment.
6. Tambahkan unique guard sesi opname.
7. Tambahkan pembatalan PO.

### Tahap 1 — sebelum multi-user intensif

1. Presisi per unit pada seluruh jalur.
2. Scope material/history Operator berdasarkan mesin/job.
3. Tegakkan konfigurasi product–machine–material.
4. Putuskan hard block atau override stok minus.
5. Tambahkan kontrol waste.
6. Jalankan invariant pada database staging/server.

### Tahap 2 — penguatan operasional

1. Inventori per mesin.
2. Laporan dan export material.
3. Monitoring alert outbox/cron.
4. Supplier lifecycle dan lot/batch bila kebutuhan terbukti.
5. Test concurrency receipt, stocktake, PO, dan finish production.

## Acceptance criteria audit berikutnya

- Payload update dengan tenant_id/current_stock/material_code tambahan tidak mengubah record.
- Material baru tidak dapat memiliki saldo negatif.
- Create dan adjustment menghasilkan audit log.
- Hanya Owner yang dapat approve opname, atau kebijakan dual control terdokumentasi.
- Response order tidak mengandung material global.
- Hanya satu sesi opname DRAFT/SUBMITTED pada request paralel.
- PCS menolak pecahan dan METER mengikuti quantum yang ditetapkan.
- Operator tidak menerima standard cost/supplier.
- PO CANCELLED dapat dibuat dengan alasan dan tidak dapat diterima.
- Rekonsiliasi ledger sama dengan saldo master.

## Catatan scope

Audit ini tidak mengubah kode, database, atau data lokal. Laporan inbound sebelumnya tetap berlaku untuk detail bug min/step dan perbaikannya: [MATERIAL-INBOUND-QUANTITY-INPUT-AUDIT-REPORT.md](/Users/drefan/Projects/PRINT%20PILOT/09-TECHNICAL/MATERIAL-INBOUND-QUANTITY-INPUT-AUDIT-REPORT.md).


## Implementasi tahap lanjutan — 16 September 2026

Allowlist ProductMaterial dan MachineMaterial sekarang menjadi gate server-side untuk order, auto-release, start, dan finish produksi. Job wajib memiliki bahan utama yang direncanakan, material harus aktif dan kompatibel dengan mesin, serta pemakaian/waste dikonversi ke unit stok dengan presisi enam desimal. Harga item dan `pricing_unit`/`cost_unit` disnapshot saat order dibuat.

Gap lanjutan tetap: fallback/substitusi formal setelah produksi berjalan, tarif efektif per material untuk HPP, dan rekonsiliasi biaya aktual-vs-snapshot pada laporan margin.
