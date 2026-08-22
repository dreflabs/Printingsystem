# Direct Sales / POS Workflow

Fitur Direct Sales (Point of Sale) dirancang untuk memfasilitasi penjualan barang jadi (seperti kertas, bolpoin, penggaris, dsb) tanpa harus melalui alur panjang produksi printing.

## State Machine Khusus (OrderType.RETAIL)

Jika pesanan dibuat dengan `order_type = RETAIL`, sistem akan menggunakan "Fast-Track Workflow":

```
[ NEW_RETAIL_ORDER ] --> [ RETAIL_PAYMENT_COMPLETED ] --> [ CLOSED ]
```

### 1. NEW_RETAIL_ORDER
- **Aktor:** Kasir / Admin (via modul POS)
- **Proses:** 
  - Kasir men-scan barcode atau memilih barang dari katalog `retail_products`.
  - Sistem membuat baris di tabel `orders` dengan `order_type = RETAIL`.
  - Item disimpan di `order_items` dengan merujuk pada `retail_product_id` (bukan `product_id`).
  - (Opsional) `customer_id` bisa diisi, atau dibiarkan `null` untuk pelanggan Walk-in/Guest.

### 2. RETAIL_PAYMENT_COMPLETED
- **Aktor:** Kasir
- **Proses:**
  - Kasir menerima pembayaran (Tunai/QRIS).
  - Saat pembayaran dikonfirmasi lunas:
    - Status pesanan langsung menjadi `RETAIL_PAYMENT_COMPLETED` (atau langsung `CLOSED`).
    - **Trigger Otomatis:** Sistem langsung memotong stok di tabel `retail_products` dan mencatat mutasi stok di `retail_stock_movements`.

### 3. CLOSED (Handover)
- **Aktor:** Kasir / Gudang
- **Proses:**
  - Barang langsung diserahkan kepada pelanggan saat itu juga.
  - Pesanan dianggap ditutup dan masuk ke pelaporan pendapatan tanpa perlu melalui proses Design, Production, QC, atau Finishing.

## Penanganan Hybrid (Pelanggan Membeli Printing & Retail Sekaligus)
Berdasarkan keputusan desain, **pesanan hybrid tidak digabung dalam 1 nota**.
- Jika pelanggan memesan cetak spanduk dan membeli 1 lusin bolpoin:
  1. Kasir membuat **1 Nota RETAIL** khusus bolpoin. Transaksi selesai saat itu juga dan pelanggan membawa pulang bolpoinnya.
  2. CS/Desainer membuat **1 Nota PRINTING** khusus spanduk yang akan mengikuti alur panjang standar (Design -> Approval -> Produksi).
- Ini menghindari kompleksitas status "sebagian barang sudah diambil, sebagian masih diproduksi".
