# User Story: Owner (Pemilik Toko Percetakan)

Owner adalah pemilik dari bisnis percetakan (tenant) dan memiliki hak akses tertinggi di level toko. Owner fokus pada pengawasan, manajemen data, pengaturan kebijakan toko, dan memberikan persetujuan (approval) untuk aksi-aksi kritis yang tidak bisa dilakukan oleh role lain.

## 1. Persetujuan Kritis (Approvals)
- **Sebagai** Owner, **saya ingin** dapat menyetujui atau menolak proses *rework* (cetak ulang) setelah hasil QC gagal, **sehingga** saya bisa mengontrol kerugian material akibat kesalahan produksi.
- **Sebagai** Owner, **saya ingin** menyetujui pemindahan tugas (*reassignment*) mesin lebih dari 2 kali dalam 24 jam, **sehingga** saya bisa membatasi admin memindah-mindahkan pekerjaan tanpa alasan jelas.
- **Sebagai** Owner, **saya ingin** menyetujui hasil Final Audit yang berstatus *YELLOW* (ada selisih/anomali non-fatal), **sehingga** order bisa diselesaikan (*CLOSED*) dengan pengawasan saya.
- **Sebagai** Owner, **saya ingin** memberikan persetujuan jika ada permintaan pembatalan (*cancel order*) untuk pekerjaan yang sudah masuk tahap produksi, **sehingga** saya bisa memastikan biaya yang sudah keluar dapat tertangani (misal: potong DP).
- **Sebagai** Owner, **saya ingin** dapat memberikan otorisasi pemberian diskon manual pada order, **sehingga** kasir tetap butuh izin saya untuk menurunkan harga.
- **Sebagai** Owner, **saya ingin** dapat melampaui (*override*) batas minimal Down Payment (DP), **sehingga** saya bisa memberikan keringanan pembayaran bagi pelanggan khusus atau B2B.

## 2. Manajemen Karyawan, Absensi & Penggajian (Payroll)
- **Sebagai** Owner, **saya ingin** dapat membuat, menonaktifkan, dan mengatur role akun karyawan, **sehingga** mereka hanya bisa mengakses modul sesuai pekerjaannya.
- **Sebagai** Owner, **saya ingin** mengatur kebijakan absensi (jam kerja, jam masuk/pulang), **sehingga** sistem tahu kapan seorang karyawan dihitung terlambat.
- **Sebagai** Owner, **saya ingin** memberikan catatan tambahan pada data absensi karyawan tanpa memanipulasi waktu asli kedatangan mereka, **sehingga** saya bisa merekam alasan keterlambatan atau ketidakhadiran.
- **Sebagai** Owner, **saya ingin** mengatur gaji pokok (*base salary*) karyawan dan tarif potongan keterlambatan (Rp/menit), **sehingga** sistem bisa menghitung gaji bersih secara otomatis.
- **Sebagai** Owner, **saya ingin** membuat (*generate*) dan memfinalisasi periode penggajian bulanan berdasarkan data absensi riil, **sehingga** saya tidak perlu menghitung manual jumlah hari masuk dan potongan telat.
- **Sebagai** Owner, **saya ingin** melihat detail nominal pada slip gaji dan menandainya sebagai "Lunas" (*Paid*), di mana nominal ini disembunyikan dari role Admin, **sehingga** privasi gaji karyawan tetap terjaga.

## 3. Pengaturan Toko & Keamanan
- **Sebagai** Owner, **saya ingin** mengubah identitas toko (nama, alamat, nomor telepon, dan logo), **sehingga** struk dan tampilan aplikasi sesuai dengan branding bisnis saya.
- **Sebagai** Owner, **saya ingin** dapat mereset password karyawan dan membuka (*unlock*) akun yang terkunci akibat salah login, **sehingga** operasional tidak terhambat jika karyawan lupa sandi.
- **Sebagai** Owner, **saya ingin** bisa melihat dan (jika terpaksa) menghapus *audit log* melalui panel khusus (dengan 2 langkah konfirmasi), **sehingga** saya memiliki kontrol penuh atas data historis namun tetap terkontrol.

## 4. Dashboard, Pemantauan & Laporan
- **Sebagai** Owner, **saya ingin** memiliki dashboard yang menampilkan KPI hari ini (total order, omzet, siap diambil), **sehingga** saya tahu kondisi toko dalam sekilas.
- **Sebagai** Owner, **saya ingin** melihat *alert* kritis di dashboard (seperti QC FAIL, *cancel request*, *diskon request*, stok menipis), **sehingga** saya tahu prioritas mana yang butuh campur tangan saya segera.
- **Sebagai** Owner, **saya ingin** mengekspor seluruh laporan operasional, keuangan, dan absensi, **sehingga** saya dapat menganalisis performa bisnis lebih dalam menggunakan Excel.

## 5. Master Data & Inventori
- **Sebagai** Owner, **saya ingin** menambah dan mengelola master data produk beserta harganya, **sehingga** harga yang digunakan kasir selalu seragam.
- **Sebagai** Owner, **saya ingin** mencatat stok material yang masuk dan menambahkan bahan baru ke sistem, **sehingga** sistem bisa melacak ketersediaan bahan secara akurat.
