# Laporan Audit Visual Nota / Bukti DP

**Tanggal audit:** 14 September 2026  
**Sumber:** Screenshot halaman `/print/nota/[id]`  
**Format yang terlihat:** nota thermal 80 mm yang dibuka dalam browser print preview  
**Ruang lingkup:** keterbacaan, hierarki informasi, warna, alignment, QR, kompatibilitas thermal printer, dan kepercayaan pelanggan

## Penilaian umum

Nota ini mendapat skor **7,8/10**. Struktur informasinya sudah kuat dan cocok untuk nota percetakan: identitas toko, nomor order, pelanggan, deadline pengambilan, item, total, pembayaran, bukti DP, riwayat pembayaran, QR, dan status pelunasan tersedia dalam urutan yang mudah diikuti.

Tidak ada masalah yang membuat isi nota tidak dapat dipakai. Temuan paling penting berada pada konfigurasi halaman cetak: screenshot memperlihatkan nota 80 mm berada di tengah lembar besar dengan ruang kosong sangat luas. Untuk printer thermal, aturan `@page` perlu ditetapkan agar ukuran kertas dan margin tidak bergantung pada default browser.

## Yang sudah baik

- **Hierarki informasi jelas.** Nama toko berada di bagian atas, identitas order setelah separator, lalu nilai transaksi dan bukti pembayaran.
- **Monospace cocok untuk thermal.** Angka, kode order, dan nominal mudah disejajarkan pada printer kasir.
- **Alignment nominal rapi.** Nilai uang berada di sisi kanan dan label berada di sisi kiri, sehingga subtotal, total, dibayar, dan sisa cepat dipindai.
- **Total transaksi menonjol.** `TOTAL` memakai bobot dan ukuran sedikit lebih besar daripada baris biasa.
- **Bukti DP memiliki kotak sendiri.** Batas hitam dan judul `BUKTI PEMBAYARAN DP` memisahkan informasi uang muka dari ringkasan transaksi.
- **Status pembayaran eksplisit.** Nota menyatakan `Belum lunas` dan menjelaskan pelunasan saat pengambilan.
- **QR cukup dominan.** Ukuran QR terlihat memadai untuk dipindai dari nota fisik, dan kode order ditulis ulang di bawahnya sebagai fallback manual.
- **Warna layar tidak mengganggu isi cetak.** Latar abu-abu hanya digunakan sebagai area preview; dokumen sendiri tetap hitam-putih sehingga aman untuk thermal printer.
- **Isi pelanggan dan deadline mendukung alur pickup.** Nama pelanggan, tanggal ambil, dan instruksi menunjukkan tujuan nota dengan jelas.

## Temuan prioritas

### P1 — Ukuran kertas thermal belum dikunci dengan `@page`

Komponen nota memakai lebar `80mm`, tetapi halaman tidak mendefinisikan `@page`. Akibatnya, browser print preview dapat memilih A4/Letter dengan margin bawaan. Inilah yang membuat screenshot memperlihatkan nota kecil di tengah halaman tinggi dengan ruang kosong panjang.

**Dampak:** hasil cetak dapat memiliki margin tambahan, page break yang tidak terduga, atau nota keluar sebagai lembar A4 ketika printer tidak menerima ukuran 80 mm secara otomatis.

**Saran:** tambahkan aturan print khusus nota:

```css
@page { size: 80mm auto; margin: 0; }
@media print {
  html, body { width: 80mm; margin: 0; }
}
```

Tetap sediakan varian 58 mm bila Print Pilot akan mendukung printer kasir kecil. Jangan memakai satu CSS untuk dua lebar tanpa pengujian karena QR dan label dapat terpotong.

### P2 — Riwayat pembayaran terlalu kecil untuk sebagian printer

Bagian `Riwayat Pembayaran` memakai teks sekitar 9px. Pada screenshot masih terbaca karena diperbesar oleh preview, tetapi thermal printer dengan kualitas rendah dapat membuat tanggal dan metode terlalu tipis.

**Saran:** gunakan minimal 10px untuk metadata riwayat, dan pertahankan 11px untuk nilai uang. Jika riwayat panjang, pecah setiap pembayaran menjadi dua baris yang tetap rapi daripada mengecilkan font.

### P2 — Label status QC masih panjang untuk lebar 80 mm

Label `Cetak Selesai — Menunggu QC` tampil baik di dashboard, tetapi pada nota panjang label status sebaiknya tidak ikut masuk bila tidak dibutuhkan pelanggan. Nota cukup menampilkan status transaksi dan instruksi pickup.

**Saran:** pertahankan label proses produksi di dashboard/internal view. Pada nota pelanggan, gunakan teks ringkas seperti `Menunggu QC` hanya jika status memang perlu diinformasikan.

### P2 — Emoji pada footer berisiko tidak tercetak

Teks `Terima kasih 🙏` ramah, tetapi banyak printer thermal tidak memiliki glyph emoji. Hasilnya dapat berupa kotak kosong atau karakter yang tidak konsisten.

**Saran:** gunakan `Terima kasih` sebagai teks cetak utama. Jika ingin mempertahankan emoji pada preview web, sembunyikan emoji saat `@media print`.

### P2 — URL browser memperlihatkan UUID internal

Screenshot browser menampilkan route dengan UUID order. UUID tidak tercetak di nota, tetapi dapat ikut tersebar jika operator membagikan screenshot atau menyalin URL.

**Saran:** gunakan order code publik sebagai identifier route bila memungkinkan, atau pastikan route tetap melakukan otorisasi tenant dan jangan menganggap UUID sebagai rahasia. Ini adalah catatan keamanan/privasi tambahan, bukan masalah layout nota.

## Audit warna dan tipografi

- **Hitam di atas putih** adalah pilihan paling aman untuk thermal dan fotokopi.
- **Bold** dipakai pada total, status DP, dan status pelunasan dengan proporsi tepat.
- **Separator dashed** membantu grouping tanpa menghabiskan tinta sebanyak blok berwarna.
- **Tidak ada ketergantungan pada warna** untuk memahami jumlah atau status, sehingga nota tetap usable pada printer monokrom.
- **Font 11px** cocok sebagai default 80 mm. Hindari menurunkannya untuk memaksa lebih banyak konten masuk; lebih baik nota bertambah panjang.

## Audit QR dan kepercayaan pelanggan

- QR menampilkan order code yang sama dengan teks di bawahnya, sehingga pelanggan memiliki fallback ketika kamera gagal.
- Instruksi `Tunjukkan QR ini saat pengambilan` jelas dan berada dekat QR.
- Status pembayaran dan sisa tagihan ditampilkan sebelum QR, sehingga pelanggan memahami kondisi transaksi sebelum memakai kode pickup.
- Pastikan endpoint yang menerima QR memeriksa tenant, status order, dan hak akses; QR tidak boleh menjadi satu-satunya kontrol otorisasi.

## Rekomendasi implementasi

1. ~~Tetapkan `@page 80mm auto` dan margin print 0 pada nota.~~ **Selesai.**
2. Uji cetak fisik pada printer thermal 80 mm dengan driver Chrome dan satu printer ESC/POS.
3. Uji nota dengan nama pelanggan panjang, alamat toko dua baris, item banyak, diskon, pembayaran lebih dari satu, dan riwayat panjang.
4. ~~Naikkan metadata riwayat pembayaran ke 10px.~~ **Selesai.**
5. ~~Ganti emoji footer untuk mode cetak.~~ **Selesai.**
6. ~~Gunakan route berbasis order code publik dengan otorisasi tenant tetap wajib.~~ **Selesai pada tautan pembuka nota.**

## Status implementasi

Perubahan kode sudah diterapkan pada halaman nota:

- `@page` menetapkan ukuran 80 mm dan margin 0; wrapper print tidak lagi memaksa tinggi viewport.
- Riwayat pembayaran memakai ukuran teks 10px.
- Footer cetak memakai `Terima kasih` tanpa emoji.
- Link cetak dari Admin dan order baru menggunakan `orderCode` yang sudah di-encode; action server tetap menerima kode maupun ID dan memeriksa tenant serta role Admin/Owner.

Verifikasi TypeScript lulus. Smoke check browser pada sesi saat ini dialihkan ke Dashboard Designer karena role aktif bukan Admin; penolakan pencetakan nota pada sesi tersebut sesuai policy keamanan.

## Kesimpulan

Desain nota sudah fungsional, terstruktur, dan cukup profesional. Kekuatan terbesar ada pada alignment nominal, kotak bukti DP, status pelunasan, dan QR yang memiliki fallback teks. Perbaikan paling penting adalah mengunci ukuran halaman thermal melalui `@page`; setelah itu, tingkatkan keterbacaan metadata kecil dan hilangkan emoji dari output cetak.
