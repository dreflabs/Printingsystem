# POS (Point of Sale) Dashboard

Modul Kasir Cepat (Direct Sales) dirancang khusus untuk mempercepat penjualan barang retail/ready stock tanpa melalui alur printing.

## 1. Antarmuka Utama (Single Page Checkout)
- **Katalog Produk:** Grid atau list produk retail dengan foto, nama, sisa stok, dan harga.
- **Barcode Scanner Input:** Input field tersembunyi/fokus otomatis untuk menangkap input dari alat scanner barcode. Jika terscan, item langsung masuk ke keranjang.
- **Keranjang Belanja (Cart):** Daftar item yang akan dibeli. Bisa mengatur kuantitas, atau menghapus item.
- **Total Pembayaran:** Ringkasan subtotal, diskon (jika ada), dan total akhir.
- **Metode Pembayaran:** Tombol cepat untuk memilih "TUNAI" atau "QRIS".

## 2. Proses Checkout
- Jika dibayar TUNAI, muncul modal kalkulator kembalian (uang diterima, kembalian).
- Jika dibayar QRIS, muncul modal menampilkan QR Code atau input referensi.
- Setelah sukses: Muncul notifikasi "Pembayaran Berhasil" dan opsi cetak struk (Receipt) menggunakan thermal printer, lalu halaman langsung reset ke kondisi awal untuk pelanggan berikutnya.

## 3. Manajemen Stok (Inventory)
- Tab atau menu sekunder untuk melihat daftar barang retail.
- Opsi untuk "Tambah Stok Masuk" (IN) atau "Penyesuaian Stok" (ADJUSTMENT).
- Hanya bisa diakses oleh Supervisor/Admin/Owner, atau kasir yang diberi hak akses.

## 4. Riwayat Transaksi Retail
- Daftar pesanan khusus tipe `RETAIL` yang sudah `CLOSED`.
- Bisa mencetak ulang struk jika pelanggan meminta.
