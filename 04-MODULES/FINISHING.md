# FINISHING

Status: **Spesifikasi lengkap ada di** `02-WORKFLOW/08-FINISHING.md`

File ini hanya penanda modul teknis — jangan diisi ulang, karena akan duplikasi dengan sumber kebenaran di atas.

## Topik yang dicakup di sana

- Alur wajib: QC PASS → FINISHING → PACKING → scan QR/barcode job → cetak/verifikasi label → scan lokasi storage → READY_FOR_PICKUP → notifikasi otomatis
- Data yang wajib dicatat operator finishing (Job ID, operator, quantity, waktu mulai/selesai, catatan, hasil scan)
- Aturan penting: selesai finishing saja TIDAK membuat order siap diambil — wajib tersimpan di lokasi storage terdaftar dulu
- Isi label rekomendasi (nama perusahaan, QR Code, Job ID, Order ID, nama konsumen, deskripsi produk, quantity)
- Trigger notifikasi WhatsApp setelah scan storage berhasil
