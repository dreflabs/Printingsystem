> Status implementasi: Temuan P1 historis telah ditangani pada checkpoint 24d94c26; gap approval refund dan rekonsiliasi tetap terbuka.

# Laporan Audit Pembayaran dan Keuangan

Tanggal audit: 16 September 2026  
Scope: DP, pelunasan, sisa tagihan, diskon, refund, pembatalan, validasi server, approval, konsistensi status, nota, laporan omzet, dan audit log.

Audit ini bersifat **code review, document review, dan rekonsiliasi read-only** terhadap database lokal. Tidak ada kode aplikasi atau data yang diubah.

## Ringkasan eksekutif

Fondasi kontrol sudah cukup baik: harga produk cetak dan produk retail dihitung ulang di server, payment dibatasi pada Admin/Owner, diskon memiliki approval Owner, pickup memeriksa sisa tagihan, dan audit log memakai rantai hash per tenant.

Namun alur keuangan belum aman untuk produksi penuh. Ada empat risiko prioritas tinggi:

1. Refund pembatalan order cetak hanya disimpan sebagai metadata `dp_refund_amount`, tanpa transaksi refund negatif pada ledger `Payment` dan tanpa memperbarui `paid_amount`/`balance`.
2. `addPayment()` memeriksa saldo lalu membuat payment tanpa lock atau compare-and-set pada Order. Dua request bersamaan dapat melewati saldo yang sama dan menghasilkan overpayment.
3. Approval diskon setelah pembayaran dapat menurunkan `total` di bawah uang yang sudah masuk. Sistem mengubah `balance` menjadi nol, tetapi tidak membuat kredit/refund atau approval kelebihan bayar.
4. Aksi utama commit lebih dahulu, sedangkan `logAction()` dipanggil setelah transaksi dan menelan kegagalan. Aksi keuangan dapat berhasil tanpa jejak audit.

Database lokal memperlihatkan contoh konkret: order cetak `ORD-20260913-0004` memiliki total Rp280.000 tetapi pembayaran terkonfirmasi Rp300.000. Nilai `balance` nol, sehingga kelebihan Rp20.000 tidak terlihat sebagai piutang maupun refund.

## Nilai yang sudah terlindungi

- `createPrintingOrder()` menghitung subtotal, total, DP, dan saldo dari data server. Harga dari browser tidak dijadikan sumber kebenaran.
- `processRetailOrder()` mengambil harga produk retail dari database, menghitung pajak di server, dan mengurangi stok secara atomik.
- `addPayment()` menolak nominal yang lebih besar dari saldo yang terbaca, membatasi status terminal, dan menghitung ulang akumulasi payment terkonfirmasi.
- Permission `payment.receive` dan `discount.approve` divalidasi server-side. Designer, Operator, dan Gudang tidak memiliki jalur menerima pembayaran.
- `releaseOrder()` menahan serah-terima jika saldo masih positif, kecuali Owner memakai override dengan alasan.
- `decideDiscount()` hanya dapat dijalankan oleh pihak yang memiliki `discount.approve` (template saat ini Owner).
- Nota dan query order memakai `tenant_id`, sehingga data keuangan tenant lain tidak ikut terbaca.
- Audit log menyimpan `old_value_json`, `new_value_json`, actor, tenant, waktu, hash, dan `previous_hash`. Rekonsiliasi hash database lokal tidak menemukan rantai putus pada 197 log yang ada.

## Temuan berprioritas tinggi

### P1 — Refund pembatalan cetak tidak masuk ledger pembayaran

`cancelOrder()` menghitung refund dan mengisi `dp_refund_amount`/`dp_refund_method`, tetapi hanya melakukan `order.update()`. Tidak ada baris `Payment` negatif, dan `paid_amount` serta `balance` tidak disesuaikan. Sebaliknya, `voidRetailOrder()` sudah membuat Payment negatif dan mengosongkan paid/balance.

Dampak:

- nota tetap dapat menampilkan pembayaran lama setelah refund;
- laporan harian menghitung uang masuk bruto seolah refund tidak pernah terjadi;
- rekonsiliasi Payment dengan Order berbeda antara retail dan cetak;
- audit akhir hanya melihat saldo denormalisasi dan tidak memperoleh bukti arus dana keluar.

**Perbaikan wajib:** buat tipe transaksi refund/adjustment yang terpisah atau Payment negatif dengan metadata `REFUND`, referensi refund, approver, metode, dan waktu. Update paid/balance harus dilakukan dalam transaksi yang sama. Laporan harus memisahkan `gross_in`, `refund_out`, dan `net_cash`.

### P1 — Race condition pada penerimaan payment

`addPayment()` membaca `order.balance` di awal transaksi, lalu membuat Payment dan menghitung agregat. Tidak ada row lock (`FOR UPDATE`), advisory lock per order, atau update atomik yang memastikan saldo belum dipakai request lain.

Dampak: dua kasir/Admin yang menyimpan pembayaran hampir bersamaan dapat sama-sama lolos validasi saldo. Sistem kemudian menyimpan jumlah melebihi total order. Overpayment `ORD-20260913-0004` (Rp300.000 dibayar untuk total Rp280.000) adalah bukti invariant keuangan pernah terlanggar, walaupun sumber historisnya perlu ditelusuri lebih lanjut.

**Perbaikan wajib:** serialisasi per Order dalam transaksi; hitung saldo dari ledger terkunci; tolak jika agregat baru melebihi total; tambahkan constraint/rekonsiliasi berkala yang mengangkat alert bila `confirmed_payment_sum > total`.

### P1 — Approval diskon dapat membuat kelebihan bayar tanpa alur kredit/refund

`requestDiscount()` masih dapat dijalankan pada order yang sudah memiliki payment terkonfirmasi selama status belum CLOSED/CANCELLED. `decideDiscount()` lalu menghitung total baru dan hanya memakai `Math.max(0, total - paid)` untuk saldo. Tidak ada keputusan apakah selisih dibayarkan kembali, menjadi kredit pelanggan, atau harus ditolak.

**Perbaikan wajib:** pilih satu kebijakan dan enforce server-side:

1. diskon tidak boleh diajukan setelah payment pertama; atau
2. jika total turun di bawah paid, wajib membuat approval refund/credit note terpisah sebelum diskon berlaku.

Order `ORD-20260913-0004` menunjukkan pola ini: subtotal Rp300.000, diskon disetujui Rp20.000, total Rp280.000, tetapi payment terkonfirmasi Rp300.000.

### P1 — Audit log tidak atomic dengan transaksi keuangan

Payment, diskon, dan pembatalan melakukan commit database terlebih dahulu, kemudian memanggil `logAction()`. Logger menangkap error dan hanya menulis ke stderr. Dengan demikian kegagalan database audit, timeout, atau konfigurasi dapat membuat perubahan uang berhasil tanpa audit log.

**Perbaikan wajib:** gunakan transaction outbox atau tulis event audit di transaksi domain yang sama. Jika logger tetap terpisah, aksi keuangan harus diberi status `AUDIT_PENDING` dan alert kritis ketika log gagal; jangan menelan kegagalan tanpa mekanisme retry.

## Temuan prioritas menengah

### P2 — Validasi runtime payment belum lengkap

Tipe TypeScript `method: "CASH" | "TRANSFER" | "QRIS"` hilang saat request masuk. Server tidak memvalidasi ulang method, finite number, integer Rupiah, dan batas aman angka. `reference` juga tidak diwajibkan untuk TRANSFER, padahal dokumen validasi mewajibkannya. `voidRetailOrder()` menerima string refund method bebas.

**Perbaikan:** validasi schema runtime (misalnya Zod) untuk amount integer positif, method allowlist, reference wajib untuk TRANSFER, dan refund method allowlist. Terapkan schema yang sama pada printing dan POS.

### P2 — Nota memakai dua sumber nilai keuangan

`getOrderReceipt()` menampilkan `order.paid_amount` dan `order.balance`, sementara riwayat pembayaran diambil dari Payment ledger. Saat refund cetak atau koreksi terjadi, dua bagian nota dapat tidak sama. Nota juga belum memiliki blok eksplisit `Dibatalkan`, `Refund`, atau `DP hangus`; refund retail negatif hanya terlihat sebagai baris nominal negatif.

**Perbaikan:** bentuk DTO nota dari rekonsiliasi ledger; tampilkan status pembatalan, total refund, metode, approver, dan saldo bersih. Jika invariant gagal, nota harus diberi tanda `PERLU REKONSILIASI` dan tidak dianggap bukti final.

### P2 — Laporan harian, bulanan, dan refund memiliki definisi berbeda

- Laporan harian mengakumulasi Payment terkonfirmasi berdasarkan `paid_at`, sehingga refund cetak yang hanya berupa metadata tidak mengurangi pendapatan.
- Laporan bulanan menghitung `dpHangus` dari `paid_amount - dp_refund_amount`, tetapi `pendapatanMasuk` tetap mengambil Payment ledger. Dua angka dapat tidak menjelaskan arus kas yang sama.
- Pemisahan DP/pelunasan menggunakan timestamp payment pertama. Dua payment dengan timestamp identik dapat diklasifikasikan sebagai DP secara bersamaan.
- `omsetBruto` bulanan berbasis total order yang dibuat, sedangkan `pendapatanMasuk` berbasis cash-in. Label keduanya harus jelas agar tidak dibaca sebagai angka yang sama.

**Perbaikan:** definisikan metrik resmi: gross sales, confirmed cash-in, refund out, net cash, receivable, discount, dan forfeited DP. Gunakan `payment_type`/sequence eksplisit, bukan inferensi timestamp.

### P2 — Refund dan pembatalan belum memiliki approval object khusus

Pembatalan memakai `cancellation_reason` pada Order sebagai request sekaligus alasan final. Tidak ada record refund request yang menyimpan nominal yang diminta, nominal yang disetujui, approver, dan status pembayaran refund. Ini menyulitkan pemisahan “dibatalkan” dari “refund sudah benar-benar dibayar”.

**Perbaikan:** tambahkan entitas `RefundRequest`/`FinancialAdjustment` dengan status `REQUESTED → APPROVED → PAID → REJECTED`, idempotency key, dan reference transfer/cash.

### P2 — Correction keuangan belum mengubah ledger atau laporan

`createCorrection()` dan `approveCorrection()` membuat/menyetujui record koreksi, tetapi tidak menerapkan jurnal ke Payment, Order, atau laporan. Ini sesuai prinsip “record asli tidak diedit”, tetapi belum cukup untuk koreksi finansial yang harus memengaruhi saldo dan arus kas.

**Perbaikan:** pisahkan koreksi operasional dari jurnal finansial. Koreksi finansial yang disetujui harus menghasilkan adjustment ledger yang immutable dan muncul di laporan periode koreksi.

### P2 — Dokumen dan implementasi pembayaran belum sepenuhnya selaras

`02-WORKFLOW/04-PAYMENT.md` masih menyebut status order `PARTIAL` dan `PAID`, sedangkan state machine implementasi memakai `WAITING_PAYMENT`, `CONFIRMED`, dan saldo sebagai indikator lunas; tidak ada status order `PAID`. Dokumen juga menggambarkan payment `PENDING → CONFIRMED/REJECTED` dan endpoint confirm terpisah, sementara action aktif langsung membuat Payment `CONFIRMED` dan repository tidak memiliki action pembayaran pending/confirm yang setara.

**Perbaikan:** pilih satu model resmi. Rekomendasi: status pipeline tetap terpisah dari `payment_state` turunan (`UNPAID`, `DP`, `PAID`, `REFUNDED`, `OVERPAID`), lalu selaraskan SOP, API docs, UI, dan acceptance criteria.

## Rekonsiliasi database lokal

Snapshot read-only tanggal 16 September 2026:

- 13 order `PRINTING`, 2 order `RETAIL`.
- 15 Payment berstatus `CONFIRMED`, total nominal bersih Rp2.071.580.
- Tidak ditemukan method Payment di luar `CASH`/`TRANSFER`/`QRIS` pada data saat ini; ini tidak menghilangkan celah validasi request.
- Tidak ditemukan Payment negatif pada snapshot ini.
- Tidak ditemukan perbedaan `balance` denormalisasi terhadap rumus `max(total - confirmed_payment_sum, 0)`, tetapi rumus tersebut menyembunyikan overpayment.
- Ditemukan satu overpayment: `ORD-20260913-0004`, total Rp280.000 dan confirmed payment Rp300.000.
- Ada satu order cetak `CANCELLED`, tetapi pada snapshot tidak memiliki payment terkonfirmasi maupun metadata refund positif. Ini tidak membuktikan refund cetak aman; jalur kodenya tetap tidak membuat jurnal refund bila kelak ada pembayaran.
- Rantai hash `AuditLog` lokal tidak menunjukkan putus pada 197 entri.

## Audit per area

### DP, pelunasan, dan sisa tagihan

Perhitungan server dan gate pickup sudah benar secara konsep. Risiko utamanya adalah concurrent payment dan overpayment tersembunyi karena saldo memakai `max(0, total-paid)`. DP tidak perlu menjadi status pipeline tersendiri; UI sebaiknya menampilkan state pembayaran turunan yang konsisten.

### Diskon

Approval Owner dan alasan sudah tercatat. Celah utamanya adalah perubahan diskon setelah pembayaran serta tidak adanya mekanisme kredit/refund untuk selisih. Diskon pending juga harus tetap dibedakan dari diskon yang sudah mengubah total.

### Refund dan pembatalan

Retail void sudah memiliki pola ledger negatif, tetapi printing cancel belum. Kebijakan DP hangus/refund di dokumen sudah jelas, namun “refund disetujui” belum berarti “refund dibayar” di sistem.

### Manipulasi dari browser

Harga produk cetak, harga katalog retail, subtotal, total, dan batas saldo dihitung di server sehingga perubahan field UI tidak cukup untuk mengubah total secara langsung. Kontrol ini belum tahan terhadap request bersamaan, field string yang tidak divalidasi runtime, atau perubahan diskon/refund pada waktu yang salah.

### Approval dan pemisahan peran

Permission server-side sudah memisahkan penerimaan payment, approval diskon, pickup override, dan cancel produksi. Refund perlu dipindahkan ke objek approval tersendiri agar nominal yang disetujui dan eksekusi pembayaran dapat diaudit terpisah.

### Nota dan laporan

Nota memiliki rincian item, diskon, DP, payment, saldo, dan QR. Namun sumber nilai ganda dan ketiadaan blok refund/cancel membuatnya belum cukup sebagai dokumen finansial final. Laporan sudah tenant-scoped dan role-gated, tetapi belum menyajikan refund cetak serta net cash secara konsisten.

### Audit log

Hash chain, actor, tenant, dan event finansial utama tersedia. Kelemahan terpenting adalah penulisan log setelah transaksi dan error yang ditelan. Untuk audit profesional, setiap perubahan uang harus memiliki event immutable yang ikut commit atau masuk outbox yang wajib diproses.

## Rencana perbaikan yang disarankan

### Tahap 1 — Blokir risiko uang (P1)

1. Serialisasi `addPayment()` per order dan tolak overpayment.
2. Implementasikan ledger refund printing yang immutable; jangan hanya mengandalkan `dp_refund_amount`.
3. Larang approval diskon setelah payment, atau wajibkan credit/refund workflow.
4. Jadikan audit event bagian dari transaksi/outbox dan buat alert jika gagal.
5. Jalankan rekonsiliasi harian: `confirmed_payment_sum`, `refund_sum`, `order.paid_amount`, `order.balance`, dan `order.total`.

### Tahap 2 — Keras-kan validasi dan approval (P2)

1. Tambahkan runtime schema untuk semua input nominal, method, reference, reason, dan idempotency key.
2. Buat `RefundRequest`/`FinancialAdjustment` dengan status dan bukti pembayaran refund.
3. Selaraskan permission `payment.receive`, `payment.confirm`, `payment.refund_request`, dan `payment.refund_approve` dengan action yang benar-benar tersedia.
4. Perbarui nota agar menampilkan cancel/refund/net balance dan tanda rekonsiliasi.
5. Selaraskan dokumen `04-PAYMENT.md`, `STATUS-MACHINE.md`, `API.md`, dan acceptance criteria.

### Tahap 3 — Laporan dan pengujian produksi

1. Tambahkan dashboard exception: overpaid, refund pending, audit pending, discount-after-payment, dan payment tanpa reference.
2. Pisahkan metrik gross sales, cash-in, refund-out, net cash, receivable, discount, dan DP hangus.
3. Tambahkan integration test untuk dua kasir bersamaan, payment sebelum/sesudah diskon, refund pre-produksi, refund saat produksi, payment terminal, dan kegagalan audit logger.
4. Uji nota dengan multi-payment, diskon pending, diskon disetujui setelah DP, refund sebagian, refund penuh, dan order cancelled.

## Kesimpulan audit

Alur pembayaran sudah memiliki kontrol dasar yang baik, tetapi belum layak dianggap final untuk uang nyata sebelum ledger refund cetak, serialisasi payment, aturan diskon setelah pembayaran, dan jaminan audit event diperbaiki. Temuan overpayment lokal harus ditandai dan diselesaikan melalui koreksi finansial resmi; jangan diedit langsung di database.


## Implementasi tahap lanjutan — 16 September 2026

Temuan P1 yang sudah diperbaiki:

- Pembatalan order cetak membuat Payment negatif sebagai ledger refund, memperbarui `paid_amount`/`balance`, dan mencatat metode refund.
- `addPayment()` dan pembatalan mengunci baris Order di transaksi sehingga dua kasir tidak dapat melewati saldo yang sama.
- Nominal payment harus integer Rupiah positif; metode dibatasi; transfer wajib memiliki reference.
- Pengajuan/keputusan diskon setelah payment pertama sekarang ditolak dan diarahkan ke alur refund/credit approval.
- Event pembayaran dan pembatalan ditulis dengan `logActionInTransaction` di transaksi domain yang sama.
- POS memvalidasi jumlah, nominal pembayaran, metode, dan reference transfer di server.

Yang masih terbuka: entitas `RefundRequest` dengan status REQUESTED/APPROVED/PAID, credit note untuk koreksi selisih, rekonsiliasi terjadwal dan metrik net cash, serta distributed idempotency key untuk integrasi pembayaran eksternal.
