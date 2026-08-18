# PAYMENT

Status: **Spesifikasi lengkap ada di** `02-WORKFLOW/04-PAYMENT.md`

File ini hanya penanda modul teknis — jangan diisi ulang, karena akan duplikasi dengan sumber kebenaran di atas.

## Topik yang dicakup di sana

- Alur umum: payment request → DP dibayar → konfirmasi Admin Sales → PARTIAL → produksi mulai → pelunasan → PAID
- Aturan DP minimum berbeda untuk Walk-in (50% wajib) vs konsumen remote (bisa override oleh Admin Sales/Owner)
- Mekanisme override DP dan pencatatan wajib di `audit_logs`
- Siapa yang boleh konfirmasi payment (hanya Admin Sales) dan larangan role lain
- Kondisi pelunasan sebelum barang bisa diserahkan
- Struktur tabel `payments` dan field terkait DP di tabel `orders`
- Batasan visibilitas nominal payment untuk Designer
