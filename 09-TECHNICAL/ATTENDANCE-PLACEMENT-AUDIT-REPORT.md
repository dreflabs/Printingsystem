# Laporan Audit Penempatan Fitur Absensi

**Tanggal audit:** 15 September 2026  
**Ruang lingkup:** lokasi kartu Absensi pada dashboard, akses cepat absen masuk/pulang, kamera selfie, GPS/geofence, istirahat, kiosk, dan dampaknya terhadap fokus kerja.

## Kesimpulan

Fitur Absensi sebaiknya **tidak ditampilkan sebagai kartu besar di area utama dashboard**. Kartu saat ini memakan ruang sebelum antrian desain, produksi, atau QC sehingga analisis operasional harus digeser ke bawah.

Penempatan yang disarankan adalah **quick action ringkas di header/sidebar**, sementara form lengkap tetap dibuka sebagai modal atau panel khusus ketika pengguna menekan status absensi. Dengan pola ini, tombol absen tetap selalu mudah dijangkau tanpa mengganggu analisis order.

## Kondisi implementasi saat ini

- `AbsenCard` dirender langsung pada dashboard Designer, Operator, dan Gudang.
- Pada Owner, kartu hanya muncul pada mode `SOLO`; Admin dan Owner mode tim tidak memperoleh kartu self-attendance di dashboard utama.
- Kartu memuat status masuk/pulang, tombol istirahat, kamera selfie, GPS, dan informasi kebijakan.
- `clockIn`/`clockOut` menggunakan waktu server; GPS, geofence, IP, selfie, kiosk, dan audit sudah ditangani di server.
- Sidebar pegawai sekarang memiliki menu **Absensi Saya** yang menaut ke kartu absensi pada dashboard Designer, Operator, dan Gudang/Finishing. Navigasi hash menangani scroll container internal dan menandai menu yang sedang dipilih.
- Sidebar sudah memiliki menu **Absensi Pegawai** untuk Admin/Owner dan **Pengaturan Absensi** untuk Owner. Keduanya adalah modul pengelolaan/rekap, bukan tombol absen pribadi.

## Penilaian lokasi

### Area utama dashboard

Kelebihannya adalah tombol sangat terlihat saat awal masuk. Kekurangannya, kartu menjadi blok besar yang selalu tampil meskipun pegawai hanya menggunakannya sekali saat masuk dan sekali saat pulang. Ini mengganggu hierarki dashboard, terutama pada halaman yang membutuhkan pemantauan queue dan deadline.

### Sidebar

Sidebar cocok untuk status ringkas dan aksi yang selalu tersedia. Sidebar tidak cocok untuk menampilkan seluruh form selfie, GPS, timer istirahat, dan keterangan kebijakan karena lebarnya terbatas dan navigasi dapat terasa penuh.

### Header

Header cocok untuk indikator status dan satu CTA karena tetap terlihat saat pengguna berpindah halaman. Aksi kamera/selfie tetap harus membuka modal terpisah agar izin kamera dan proses absen tidak bercampur dengan navigasi.

## Rekomendasi desain yang disetujui

Gunakan pola tiga lapis:

1. **Header/sidebar:** komponen kecil `Absensi` berisi indikator warna, status (“Belum absen”, “Sudah masuk”, “Sudah pulang”), jam masuk, dan tombol kontekstual **Absen Masuk** atau **Absen Pulang**.
2. **Modal Absensi:** dibuka dari quick action; berisi selfie, lokasi, istirahat, dan konfirmasi. Modal mempertahankan seluruh validasi dan pesan error yang sekarang ada pada `AbsenCard`.
3. **Halaman rekap:** tetap di `/admin/attendance` untuk Admin/Owner dan `/owner/attendance-settings` untuk konfigurasi kebijakan.

Label yang disarankan:

- `Belum absen` → **Absen Masuk**
- `Sudah masuk` → **Absen Pulang** / **Mulai Istirahat**
- `Sudah pulang` → **Absensi hari ini selesai**
- Kiosk-only → **Gunakan perangkat kiosk di kantor**

## Aturan visibilitas per role

- Pegawai yang memiliki kewajiban absensi melihat quick action pribadi, termasuk Designer, Operator, Gudang, dan Admin bila Admin juga dicatat sebagai pegawai.
- Owner dapat mengikuti kebijakan tenant: tampilkan quick action bila Owner ikut dihitung sebagai pegawai; bila tidak, cukup tampilkan menu pengawasan.
- Data pribadi absensi tetap hanya dikirim untuk pengguna yang sedang login. Rekap, selfie, dan lokasi pegawai lain tetap berada di modul Admin/Owner sesuai permission.
- Quick action tidak boleh membuka `/admin/attendance` untuk pegawai biasa; ia hanya memanggil action self-attendance.

## Risiko dan kontrol

- **Kamera/GPS mengganggu navigasi:** buka modal terpisah dan hentikan stream kamera saat modal ditutup.
- **Pengguna mengira sidebar mengubah waktu:** tampilkan “Waktu dari server” pada modal, bukan memenuhi sidebar.
- **Kiosk-only:** quick action dapat berubah menjadi status baca-saja dengan instruksi menggunakan kiosk.
- **Absensi tidak tersedia pada sebagian role:** gunakan satu komponen global berbasis policy supaya Designer, Operator, Gudang, dan Admin tidak memiliki pengalaman yang berbeda tanpa alasan bisnis.
- **Aksi langsung tanpa UI:** pertahankan validasi server pada `clockIn`, `clockOut`, break, geofence, dan selfie; pemindahan lokasi UI tidak boleh menjadi kontrol keamanan.

## Keputusan audit

1. Pindahkan **kartu besar** dari area utama dashboard.
2. Tambahkan **Absensi Quick Action** pada header/sidebar untuk akses cepat.
3. Pertahankan detail kamera, GPS, istirahat, dan pesan kebijakan dalam modal.
4. Pertahankan modul rekap dan pengaturan pada navigasi Pegawai.
5. Tentukan policy tenant apakah Admin/Owner ikut melakukan absensi pribadi; jangan menentukan hanya dari posisi menu.

Penempatan ini menjaga akses absen tetap satu klik, tetapi area utama tetap berfokus pada order, produksi, QC, dan analisis operasional.

## Status implementasi

Quick action sidebar **Absensi Saya** untuk Designer, Operator, dan Gudang/Finishing sudah diterapkan dan diverifikasi pada dashboard Operator. Kartu detail masih berada di dashboard sehingga kamera, GPS, timer istirahat, dan pesan kebijakan tetap menggunakan alur yang sama. Pemindahan detail ke quick action header + modal masih merupakan pekerjaan lanjutan; modul rekap Admin/Owner dan konfigurasi Owner tetap berada di menu masing-masing.
