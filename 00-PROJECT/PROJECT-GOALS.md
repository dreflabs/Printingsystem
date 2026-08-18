# Project Goals

## Goal utama
Membuat sistem percetakan yang transparan, mudah digunakan, dan sulit dimanipulasi.

## Masalah yang harus diselesaikan
- Desainer dapat memotong order dan menerima uang pribadi.
- Customer dapat berpindah ke hubungan personal.
- Material tidak tercatat.
- Waste tidak terkontrol.
- Barang jadi sulit ditemukan.
- Owner sulit mengetahui siapa melakukan apa.
- Tidak ada audit akhir yang konsisten.

## Kontrol barang jadi
Setiap Job memiliki QR/Barcode. Finishing melakukan scan, warehouse melakukan scan lokasi, lalu sistem mengubah status menjadi READY_FOR_PICKUP/READY_FOR_DELIVERY.

## Notifikasi customer
Setelah storage berhasil dikonfirmasi, sistem dapat otomatis mengirim WhatsApp kepada customer bahwa barang sudah selesai dan siap diambil/dikirim.

## Prinsip
- Setiap transaksi memiliki ID.
- Setiap produksi memiliki Job ID.
- Setiap material movement tercatat.
- Setiap barang jadi memiliki lokasi.
- Setiap aktivitas penting memiliki actor dan timestamp.
- CLOSED berarti terkunci.
