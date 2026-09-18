# Audit UX Dashboard Designer untuk Order Multi-item

**Tanggal:** 15 September 2026  
**Objek:** `ORD-20260915-0003` dan tampilan Antrian Desain pada screenshot 15 September 2026  
**Ruang lingkup:** kepadatan tabel, keterbacaan item, status approval, versi desain, dan responsif.

## Putusan

Tampilan desktop **belum terlalu menumpuk secara visual**. Enam baris masih memiliki tinggi yang konsisten, kolom utama terbaca, dan badge `2/2 item` memberi sinyal bahwa seluruh item sudah disetujui.

Masalah utamanya adalah **informasi multi-item terlalu diringkas**. Pada baris Simon, kolom Konsumen hanya menampilkan item pertama lalu `+1`, sementara kolom Desain hanya menampilkan status agregat `Disetujui V1` dan `2/2 item`. Designer belum dapat memastikan isi item kedua tanpa membuka Detail. Ini bukan masalah estetika besar, tetapi berisiko menimbulkan salah pilih file ketika dua item memiliki produk atau ukuran yang mirip.

## Temuan berdasarkan screenshot

### 1. Kepadatan desktop masih sehat

- Row height seragam dan tidak ada teks yang bertabrakan.
- Status, versi, progres, deadline, dan aksi masih berada dalam satu garis kerja yang mudah dipindai.
- Badge hijau `2/2 item` memiliki kontras yang baik dan langsung menunjukkan coverage penuh.
- Tombol `Detail` dan menu aksi tidak mengambil terlalu banyak ruang.

**Penilaian:** baik untuk antrean kerja harian.

### 2. Ringkasan item terlalu tersembunyi

Baris `ORD-20260915-0003` menampilkan `Cetak Banner Outdoor · 400x100 · ... +1`. Informasi item kedua hanya dapat diketahui setelah membuka Detail. Pada order dengan dua item yang sama, ringkasan ini tidak cukup untuk memastikan item target.

**Risiko:** Designer dapat membuka order yang benar, tetapi tetap memilih slot item yang keliru saat upload karena identitas item belum terlihat pada antrean.

### 3. Status agregat dan versi masih dapat disalahartikan

`Disetujui V1` berada di samping `2/2 item`. Pada implementasi, `currentVersion` adalah ringkasan nomor tertinggi lintas slot, sedangkan nomor versi sebenarnya berjalan per item. Karena itu, `V1` tidak selalu berarti semua item menggunakan satu versi yang sama.

**Risiko:** pengguna mengira order mempunyai satu V1 global, padahal bisa terdapat `Item 1 V1` dan `Item 2 V1`.

### 4. Tombol aksi sudah tepat

Untuk order yang sudah lengkap, tombol `Detail` sudah sesuai. Untuk order yang masih menunggu, tombol `ACC` tampil pada order milik Designer. Pada screenshot tidak terlihat aksi yang berlebihan.

### 5. Responsif mobile perlu perhatian lebih

Implementasi mobile sudah mengubah tabel menjadi kartu dan menampilkan progres item. Namun daftar nama item yang menunggu dapat terpotong dengan `truncate`, sedangkan item yang sudah approved hanya terlihat melalui angka progres. Detail tetap diperlukan untuk mengetahui isi item satu per satu.

## Rekomendasi prioritas

### P1 — Tambahkan ringkasan item yang dapat dibuka

Pertahankan tabel ringkas sebagai default, lalu jadikan badge `2/2 item` atau teks `+1 item` sebagai tombol **Lihat item**. Drawer/popover menampilkan daftar ringkas:

```text
Item 1 · Banner Outdoor · 400×100 · 11 pcs · ACC · V1
Item 2 · Banner Outdoor · 600×200 · 1 pcs · ACC · V1
```

Dengan pola ini, tabel tidak menjadi tinggi, tetapi informasi penting tersedia tanpa berpindah halaman.

### P1 — Pisahkan progres dari kolom Desain

Pertahankan kolom Desain untuk status file dan versi. Tambahkan kolom atau subteks `Progress`:

- `2/2 ACC` untuk lengkap;
- `1/2 ACC` untuk sebagian;
- `0/2` untuk belum ada desain.

Gunakan kata `ACC`, bukan hanya `item`, agar angka tidak disalahartikan sebagai jumlah file yang sudah diupload.

### P2 — Ubah label versi menjadi per-item

Untuk multi-item gunakan `V1 per item` atau tampilkan versi di daftar item. Hindari menjadikan `V1` global sebagai satu-satunya informasi versi pada baris order.

### P2 — Perjelas ringkasan kolom Konsumen

Untuk order multi-item, ubah teks menjadi:

```text
2 item · Banner Outdoor 400×100
```

Lalu sediakan tombol `Lihat 2 item`. Ini lebih jujur daripada menampilkan item pertama seolah-olah mewakili seluruh order.

### P2 — Pastikan mobile tidak menyembunyikan item pending

Jangan hanya memakai `truncate` untuk daftar `Menunggu`. Tampilkan maksimal dua item dalam dua baris, lalu tombol `Lihat semua` jika lebih panjang. Nama item harus tetap dapat dibaca sebelum Designer membuka modal upload.

## Hal yang sebaiknya dipertahankan

- Tabel antrean dengan satu baris per order.
- Badge status berwarna yang konsisten.
- Progres agregat per item.
- Tombol aksi utama yang berubah sesuai status order.
- Modal Detail sebagai sumber spesifikasi lengkap.
- Validasi server menggunakan `order_item_id`, sehingga perbaikan UX tidak menggantikan pengamanan backend.

## Acceptance criteria rekomendasi

1. Pada order dua item, Designer dapat melihat nama, ukuran, jumlah, status approval, dan versi kedua item tanpa meninggalkan antrean.
2. Label versi tidak membuat pengguna mengira semua item berbagi satu nomor versi global.
3. Tabel desktop tetap memiliki tinggi row yang ringkas.
4. Pada lebar mobile, nama item pending tidak terpotong sampai tidak bermakna.
5. Tidak ada perubahan pada aturan server: satu file item tetap terikat pada `order_item_id` dan order yang benar.

## Kesimpulan

Desain saat ini sudah profesional untuk antrean singkat dan tidak mengalami penumpukan visual yang fatal. Perbaikan yang paling bernilai adalah menambahkan **ringkasan item yang bisa dibuka** dan memperjelas bahwa `2/2` berarti **dua item sudah ACC**, sementara nomor versi harus dibaca per item.

## Implementasi tindak lanjut

Rekomendasi UX sudah diterapkan pada Dashboard Designer:

- Ringkasan item pada kolom Konsumen sekarang dapat diklik dan membuka Detail tanpa meninggalkan antrean.
- Progress multi-item berubah menjadi `2/2 ACC` dan dapat diklik untuk melihat status tiap item.
- Versi pada order multi-item diberi konteks `V1 per item`.
- Daftar item pending di mobile menampilkan maksimal dua item serta jumlah item lain yang masih menunggu, tanpa memotong seluruh konteks menjadi satu baris.
- Identitas pending sekarang memasukkan produk, ukuran, deskripsi, bahan, dan finishing jika tersedia.

Verifikasi browser pada `ORD-20260915-0003` menunjukkan dua item terbuka sebagai `Item 1` dan `Item 2`, masing-masing dengan ukuran, jumlah, bahan, file, serta status `Desain: final`. TypeScript dan lint pada file yang berubah juga lulus.
