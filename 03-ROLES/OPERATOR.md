# OPERATOR

## Absensi

- Wajib absen masuk sebelum mengambil job produksi dan absen pulang setelah
  pekerjaan selesai.
- Istirahat hanya dapat dimulai setelah check-in dan dibatasi oleh
  `break_max_min` tenant.

Menjalankan produksi di mesin, scan QR, dan input pemakaian material.

## Hak Akses
| Modul | Akses |
|-------|-------|
| Lihat job yang di-assign ke dirinya | ✅ |
| Lihat job antrean pada mesin yang ditugaskan | ✅ |
| Ambil & mulai job antrean secara atomik | ✅ |
| Scan QR Job (mulai & selesai produksi) | ✅ |
| Jeda & lanjutkan produksi (dengan alasan wajib) | ✅ |
| Input actual qty & waste saat selesai | ✅ |
| Input pemakaian material per job | ✅ |
| Lihat spesifikasi produk pada job | ✅ |
| Buka / unduh file cetak (versi desain APPROVED) untuk di-RIP ke mesin | ✅ |
| Lihat nama konsumen pada job | ✅ |
| Lihat nomor HP / email konsumen | ❌ |
| Lihat job operator lain | ❌ |
| Akses laporan apapun | ❌ |
| Input stok material masuk | ❌ |

Semua aksi dicatat di audit log.

## Aturan Banyak Mesin

Operator dapat ditugaskan ke lebih dari satu mesin melalui `UserMachine`. Dashboard
menampilkan antrean dari seluruh mesin tersebut. Job antrean hanya bisa diambil oleh
Operator yang memiliki grant mesin; setelah satu Operator berhasil mengambilnya,
Operator lain akan ditolak oleh validasi atomik. Jika sebuah mesin belum memiliki
Operator, job tetap berada di queue dan muncul sebagai **Queue Tanpa Operator** pada
Dashboard Admin Produksi.
