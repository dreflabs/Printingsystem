# Business Rules — Sistem Percetakan PrintFlow

## Aturan Bisnis Inti

1. Konsumen dapat datang langsung ke toko, menghubungi via WhatsApp, atau makloon (bawa file sendiri).
2. Admin Sales atau Designer yang membuat order resmi di sistem — konsumen tidak punya akses ke sistem.
3. Semua transaksi keuangan (DP, pelunasan) adalah milik catatan keuangan perusahaan dan tidak bisa diedit setelah dikonfirmasi.
4. Produksi hanya bisa dimulai jika desain sudah berstatus APPROVED dan ada Job ID yang valid.
5. Semua pemakaian material PRINTING harus terhubung ke Job ID — tidak ada pengeluaran material produksi tanpa job. *(Pengecualian: pesanan `order_type = RETAIL` tidak memiliki Job ID; pemotongan stok barang jadi dicatat via `retail_stock_movements` dengan referensi ke `order_id`)*
6. Waste (bahan terbuang) wajib dicatat dengan alasan.
7. QC PASS wajib terpenuhi sebelum lanjut ke finishing dan penyimpanan.
8. Barang selesai finishing wajib disimpan ke lokasi gudang yang terdaftar di sistem (LT3).
9. Penyerahan barang ke konsumen wajib ada otorisasi release dan konfirmasi status payment lunas (atau override Owner).
10. Final Audit wajib dilakukan sebelum order PRINTING bisa di-CLOSED. *(Pengecualian: pesanan `order_type = RETAIL` tidak melalui Final Audit — alurnya langsung `PAYMENT_COMPLETED → CLOSED` setelah barang diserahkan)*
11. Hasil audit RED memblokir penutupan order — harus diselesaikan dulu.
12. Order yang sudah CLOSED tidak bisa diedit langsung — harus lewat workflow Correction/Adjustment.
13. DP minimum 50% untuk konsumen walk-in. Override hanya oleh Admin (min 30%) atau Owner (bebas), dengan alasan wajib tercatat.
14. Diskon hanya bisa diberikan atas persetujuan Owner — Admin hanya bisa mengajukan permintaan diskon.
15. Order yang dibatalkan setelah produksi berjalan: DP hangus, harus ada persetujuan Owner.
16. Stok material tidak bisa dikurangi secara manual tanpa Job ID yang valid (kecuali Adjustment dengan alasan dan approval).
17. Mesin yang sedang MAINTENANCE tidak bisa menerima assignment job baru.
18. Data kontak konsumen (phone, email) tidak pernah tampil di layar untuk role Designer, Operator, QC, Finishing, Warehouse.
19. Audit log bersifat immutable — tidak ada edit atau delete oleh siapapun kecuali Owner via panel khusus yang juga dicatat.
20. Absensi (jam masuk dari fingerprint dan waktu istirahat dari sistem) tidak bisa diubah — Owner hanya bisa menambahkan catatan.

---

## Aturan Deadline

- Peringatan otomatis H-1 (24 jam sebelum deadline) muncul di dashboard Owner, Supervisor, dan Admin Sales.
- Order yang melewati deadline tanpa selesai mendapat label OVERDUE (merah) di semua dashboard.
- Overdue tidak otomatis memblokir produksi — tapi harus menjadi prioritas tertinggi.

---

## Aturan Stok Material

- Alert stok minimum dikirim ke Owner + Admin Sales saat stok ≤ batas minimum.
- Alert tidak memblokir produksi — hanya peringatan.
- Stok roll diukur per Roll untuk pencatatan, tapi pemakaian operator diinput per Meter (sistem konversi otomatis).
- Bahan shared (Graftac dll) memiliki satu stok terpusat yang bisa dipakai dari 2 mesin.
- Admin Sales dan Owner bisa menambahkan jenis bahan baru kapan saja langsung di sistem.

---

## Aturan Absensi

- Batas masuk: 09:15 WIB. Lebih dari itu otomatis tercatat TERLAMBAT.
- Istirahat maksimal 60 menit. Peringatan dikirim di menit ke-45.
- Lebih dari 60 menit: alert ke Owner dan Admin Sales.
- Data absensi tidak bisa diubah oleh siapapun (immutable). Owner hanya bisa tambah catatan.

---

## Aturan Keamanan

- RBAC diterapkan di server-side — menyembunyikan tombol di UI saja tidak cukup.
- Semua aksi kritis diblokir di level API jika role tidak sesuai.
- Login gagal 5 kali: akun terkunci 15 menit otomatis.
- Tidak ada registrasi mandiri — akun dibuat hanya oleh Owner.
- Password reset hanya oleh Owner secara offline.

---

## Aturan Direct Sales / Retail (POS)

Aturan khusus untuk pesanan `order_type = RETAIL` (Penjualan Langsung Barang Jadi):

- Pesanan RETAIL menggunakan "Fast-Track Workflow": `NEW_RETAIL_ORDER → PAYMENT_COMPLETED → CLOSED`.
- Tidak ada proses Desain, Produksi, QC, Finishing, Gudang, atau Final Audit untuk pesanan RETAIL.
- Stok barang jadi (`retail_products`) dipotong otomatis saat status mencapai `PAYMENT_COMPLETED`.
- `customer_id` bersifat opsional (boleh `null`) untuk pelanggan walk-in/guest yang tidak terdaftar.
- Diskon pada pesanan RETAIL mengikuti aturan yang sama dengan PRINTING — hanya bisa diapply oleh Owner.
- Pesanan RETAIL dan PRINTING **tidak boleh digabung dalam satu nota** — jika pelanggan membeli keduanya, dibuat dua transaksi terpisah.
- Pembatalan pesanan RETAIL hanya bisa dilakukan sebelum pembayaran dikonfirmasi; setelah `PAYMENT_COMPLETED` dianggap final.
