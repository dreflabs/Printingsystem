# GUDANG

Menangani seluruh tahap akhir alur produksi dalam satu role: inspeksi kualitas (QC), proses finishing & cetak label, hingga penyimpanan dan pengeluaran barang dari gudang. Role ini menggabungkan 3 role sebelumnya (QC Inspector, Finishing Staff, Warehouse Staff) menjadi satu — cocok untuk percetakan kecil/menengah yang stafnya mengerjakan lebih dari satu tahap sekaligus.

## Hak Akses

### QC (Inspeksi Kualitas)
| Modul | Akses |
|-------|-------|
| Lihat antrian job QC_PENDING | ✅ |
| Submit hasil QC (PASS / FAIL) | ✅ |
| Upload foto defect | ✅ |
| Lihat riwayat QC yang pernah dilakukan | ✅ |

### Finishing
| Modul | Akses |
|-------|-------|
| Lihat antrian job QC_PASSED | ✅ |
| Scan QR Job (mulai & selesai finishing) | ✅ |
| Cetak label QR untuk job | ✅ |
| Input actual qty finishing | ✅ |

### Gudang / Storage
| Modul | Akses |
|-------|-------|
| Scan QR Job (simpan ke storage) | ✅ |
| Scan QR Lokasi (konfirmasi lokasi) | ✅ |
| Lihat peta gudang LT3 | ✅ |
| Pindahkan barang ke counter LT1 | ✅ |
| Cari job di gudang | ✅ |
| Laporkan insiden (barang tidak ditemukan) | ✅ |
| Input stok material masuk | ✅ |
| Tambah bahan material baru | ✅ |

### Umum
| Modul | Akses |
|-------|-------|
| Lihat nama konsumen pada job | ✅ |
| Lihat nomor HP / email konsumen | ❌ |
| Approve rework | ❌ (hanya Owner) |
| Proses pickup (serahkan ke konsumen) | ❌ hanya Admin |
| Akses laporan apapun (keuangan/produksi/material) | ❌ |

Semua aksi dicatat di audit log.
