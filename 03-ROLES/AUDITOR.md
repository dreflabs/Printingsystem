# AUDITOR

Melakukan audit akhir sebelum order di-CLOSED dan menghasilkan laporan untuk Owner.

## Hak Akses
| Modul | Akses |
|-------|-------|
| Lihat semua order (read-only) | ✅ |
| Lihat audit log (read-only) | ✅ |
| Submit hasil audit (GREEN/YELLOW/RED) | ✅ |
| Export laporan audit | ✅ |
| Edit data apapun | ❌ |
| Hapus data apapun | ❌ |
| Akses laporan keuangan detail | ❌ |
| Lihat nomor HP konsumen | ❌ |

Auditor adalah role read-only terbatas — bisa submit audit tapi tidak bisa ubah data operasional.
Semua aksi dicatat di audit log.
