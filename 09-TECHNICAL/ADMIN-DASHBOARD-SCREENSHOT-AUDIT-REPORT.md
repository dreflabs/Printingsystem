# Laporan Audit Screenshot Dashboard Admin

**Tanggal audit:** 14 September 2026  
**Sumber:** Screenshot dashboard Admin pada `http://127.0.0.1:3000/admin`  
**Resolusi tangkapan:** sekitar 1167 × 944 px, termasuk chrome browser  
**Ruang lingkup:** polish visual, efek, hierarki, kepadatan informasi, status, dan kesiapan operasional

## Penilaian umum

Skor visual screenshot ini adalah **8,1/10**. Dashboard sudah siap dipakai untuk operasi harian dan tidak menunjukkan blocker visual P1. Palet terang, sidebar, header, CTA, KPI, panel prioritas, dan tabel order membentuk alur baca yang jelas.

Sisa pekerjaan berada pada tingkat polish P2: keseimbangan grid KPI pada breakpoint desktop, konsistensi tinggi kontrol untuk layar sentuh, dan cara menonjolkan konteks overdue agar Admin tidak perlu menafsirkan tanggal merah secara manual.

## Yang sudah terlihat kuat

- Hierarki halaman jelas: judul dan tanggal di atas, tiga CTA utama di kanan, panduan, KPI, panel prioritas, lalu daftar order.
- Tombol **Order Baru** memakai teal sebagai focal point. **Scan QR** dan **Kasir POS** tampil sebagai aksi sekunder sehingga tidak berebut perhatian.
- Surface putih, border abu-abu tipis, dan shadow rendah menghasilkan tampilan bersih yang cocok untuk aplikasi operasional.
- Sidebar aktif menggunakan latar teal muda dan chevron, sehingga lokasi pengguna mudah dikenali.
- Warna status memiliki makna yang konsisten: biru untuk order baru, amber untuk tagihan/audit, hijau untuk siap diambil, dan merah untuk overdue.
- Panel **Siap Diambil** dan **Menunggu Final Audit** memiliki empty state yang tenang dan tidak membuat halaman terasa rusak ketika datanya kosong.
- Tabel order menampilkan informasi inti dalam satu baris: kode, konsumen, tipe, status, total, sisa, deadline, dan aksi.
- Status `Cetak Selesai — Menunggu QC` menggunakan chip berwarna sehingga dapat dipindai lebih cepat daripada teks polos.
- Tipografi terlihat stabil: judul kuat, metadata lebih kecil, angka KPI dominan, dan kode order memakai gaya monospaced.

## Temuan polish yang perlu ditindaklanjuti

### P2 — Komposisi KPI masih 3 + 2 pada lebar desktop

Pada screenshot, lima KPI tersusun tiga kartu di baris pertama dan dua kartu di baris kedua. Baris kedua menyisakan ruang kosong besar di sisi kanan. Penyebabnya adalah grid Admin memakai `grid-cols-2 md:grid-cols-3 xl:grid-cols-5`; viewport sekitar 1167px belum mencapai breakpoint `xl`.

**Saran:** aktifkan lima kolom mulai breakpoint `lg`, atau gunakan komposisi tiga kolom dengan dua kartu terakhir dipusatkan secara eksplisit. Lima kolom pada area konten ini masih layak karena label KPI pendek dan angka tetap mudah dibaca. Uji ulang pada 1024px dan 1280px sebelum menetapkan pilihan final.

### P2 — KPI dapat sedikit lebih informatif tanpa menambah noise

KPI memakai titik warna kecil sebagai penanda status. Label teks sudah ada, sehingga informasi tidak bergantung sepenuhnya pada warna, tetapi Admin belum mendapat konteks tindakan dari kartu `Overdue`.

**Saran:** pertahankan titik warna sebagai aksen, lalu tambahkan teks pendek seperti `1 order perlu ditindaklanjuti` pada kartu overdue ketika nilainya lebih dari nol. Pada nilai nol, gunakan teks netral seperti `Tidak ada overdue` bila ruang memungkinkan.

### P2 — Konteks overdue masih bergantung pada tanggal merah

Baris order menampilkan `11 Sep` dengan warna merah. Ini mudah terlihat, tetapi belum langsung menjawab berapa lama order terlambat.

**Saran:** tampilkan label sekunder `Terlambat 3 hari` atau tooltip yang berisi tanggal lengkap. Pertahankan tanggal absolut agar audit tetap jelas. Jangan mengganti tanggal dengan label relatif saja.

### P2 — Chip status panjang perlu lebar yang stabil

Chip `Cetak Selesai — Menunggu QC` membungkus menjadi dua baris. Pembungkusan ini masih aman pada screenshot, tetapi dapat membuat tinggi row berubah saat status lain lebih panjang.

**Saran:** tetapkan `min-width` pada kolom status, gunakan line-height yang konsisten, dan pastikan wrapping hanya terjadi di dalam chip tanpa mendorong kolom lain. Pada layar sempit, kartu mobile boleh memakai dua baris.

### P2 — Kontrol pencarian dan filter sedikit kecil untuk sentuhan

Input pencarian dan dua filter di header tabel tampak sekitar 36px. Ukuran ini baik untuk mouse, tetapi target 40–44px lebih nyaman untuk laptop layar sentuh dan tablet.

**Saran:** gunakan tinggi `h-10` untuk ketiga kontrol pada breakpoint sentuh, lalu pertahankan layout wrap agar tidak memaksa tabel melebar.

### P3 — Redundansi informasi role di header

Role `Admin` muncul pada pill kiri dan kembali pada blok profil kanan. Pengulangan ini masih membantu orientasi, tetapi pada ruang sempit dapat terasa berlebih.

**Saran:** pertahankan pill kiri sebagai konteks mode aktif. Pada viewport sempit, sembunyikan label role di blok profil dan sisakan nama/avatar.

### P3 — Empty state dapat memberi langkah berikutnya

Pesan `Belum ada order siap diambil` dan `Tidak ada order menunggu audit` sudah jelas, namun panel belum memberi aksi lanjutan.

**Saran:** ketika kosong, tambahkan satu tautan ringan hanya bila ada tindakan yang benar-benar relevan, misalnya `Lihat semua order` atau `Buka daftar produksi`. Jangan menambahkan CTA dekoratif.

## Audit efek visual

- **Shadow:** efek sudah halus dan tidak mengganggu. Komponen Admin masih menggunakan beberapa `shadow-sm`; samakan ke token `shadow-card` agar perubahan tema terpusat lebih mudah.
- **Border:** border panel dan tabel cukup terlihat pada latar `#F8FAFC`, tanpa garis yang terlalu dominan.
- **Gradient:** CTA utama tidak bergantung pada gradient berat. Ini membuat warna teal lebih konsisten antar-role.
- **Blur:** tidak terlihat blur berlebihan pada shell Admin setelah normalisasi light theme.
- **Hover/focus:** implementasi focus ring teal global sudah tersedia; pastikan hover tidak menjadi satu-satunya indikator pada tombol tabel.
- **Radius:** radius kartu, panel, filter, dan chip terasa satu keluarga. Hindari menambah radius baru pada komponen Admin tanpa alasan fungsi.
- **Kepadatan:** jumlah informasi pada first fold tepat untuk satu order aktif. Dengan data puluhan order, header tabel perlu tetap sticky atau filter tetap terlihat saat scroll.

## Catatan screenshot

Lingkaran hitam di sudut kiri bawah menutupi sebagian area footer sidebar. Bentuk dan posisinya konsisten dengan overlay browser atau alat tangkapan layar, bukan komponen Print Pilot. Area ini perlu diabaikan saat menilai UI aplikasi.

## Rencana tindakan

1. ~~Ubah breakpoint grid KPI ke `lg:grid-cols-5` dan uji pada 1024px, 1167px, 1280px, serta 1440px.~~ **Selesai.**
2. ~~Naikkan tinggi search/filter menjadi 40px pada layout yang dapat disentuh.~~ **Selesai.**
3. ~~Tambahkan konteks overdue dan stabilkan lebar chip status.~~ **Selesai.**
4. ~~Samakan `shadow-sm` Admin ke token `shadow-card` bila tidak ada kebutuhan khusus.~~ **Selesai.**
5. Jalankan screenshot regression lanjutan setelah data order dibuat lebih padat, status panjang, nama konsumen panjang, dan filter aktif.

## Status implementasi rekomendasi

Perubahan yang disetujui sudah diterapkan pada Dashboard Admin:

- KPI berubah menjadi lima kolom mulai breakpoint `lg`, sehingga tampilan desktop tidak lagi menyisakan dua kartu pada baris kedua.
- Pencarian dan filter memakai tinggi 40px.
- Order overdue menampilkan tanggal absolut sekaligus teks relatif seperti `Terlambat 3 hari`.
- Chip status pada tabel memiliki lebar minimum dan line-height konsisten.
- Panel KPI, prioritas, dan daftar order memakai token `shadow-card`.

Smoke check browser setelah perubahan menampilkan tiga order, satu overdue, dan chip status tanpa error render.

## Kesimpulan

Dashboard Admin pada screenshot sudah pantas untuk penggunaan profesional. Tidak ada efek visual yang tampak berlebihan atau merusak keterbacaan. Perubahan yang disarankan bersifat polish dan optimasi scanning; prioritas tertinggi adalah memperbaiki keseimbangan KPI pada breakpoint sekitar 1024–1279px, lalu memperjelas konteks overdue.
