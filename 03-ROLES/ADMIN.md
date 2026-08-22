# ADMIN

Mengelola order, pembayaran, pickup, notifikasi WA konsumen, **dan seluruh jalannya produksi harian** (tugas yang sebelumnya dipegang role Supervisor — role Supervisor sudah dihapus dan digabung ke Admin). Input stok material fisik adalah tugas Gudang, bukan Admin.

## Hak Akses — Order, Pembayaran & Konsumen
| Modul | Akses |
|-------|-------|
| Buat & edit order (DRAFT-CONFIRMED) | ✅ |
| Konfirmasi pembayaran DP & pelunasan | ✅ |
| Proses pickup konsumen | ✅ |
| Kirim ulang notifikasi WA yang gagal | ✅ |
| Konfirmasi approval desain (Online/Makloon) | ✅ |
| Ajukan diskon (pending approval Owner) | ✅ |
| Apply diskon langsung | ❌ |
| Lihat nomor HP konsumen | ✅ |
| Cancel order (sebelum produksi) | ✅ |
| Cancel order (setelah produksi) | ❌ hanya Owner |
| Buat correction/adjustment pasca-CLOSED | ✅ (hanya operasional: qty/material — bukan keuangan) |

## Hak Akses — Produksi (eks-Supervisor)
| Modul | Akses |
|-------|-------|
| Assign job ke mesin & operator | ✅ |
| Reassign job | ✅ |
| Set status mesin MAINTENANCE | ✅ |
| Lihat antrian produksi semua mesin | ✅ |
| Lihat hasil QC | ✅ |
| Approve rework (semua tingkat: ke-1, ke-2, & eskalasi setelah 2x FAIL) | ❌ **hanya Owner** — rework berdampak langsung ke biaya material & waktu produksi, sengaja tidak ikut pindah dari Supervisor |
| **Lihat stok gudang (Storage LT3) real-time** | ✅ (lihat saja — input fisik stok masuk & tambah bahan baru sekarang murni tugas Gudang, lihat `03-ROLES/GUDANG.md`) |

## Hak Akses — Laporan & Audit
| Modul | Akses |
|-------|-------|
| Lihat laporan keuangan | ✅ (tanpa nominal detail, hanya ringkasan) |
| Edit laporan keuangan | ❌ |
| Lihat & export laporan produksi | ✅ |
| Lihat & export laporan material | ✅ |
| **Submit hasil Final Audit (GREEN/YELLOW/RED)** | ✅ |
| **Approve hasil Final Audit YELLOW sebelum CLOSED** | ❌ **hanya Owner** — Admin yang submit hasil audit tidak boleh juga jadi approver-nya sendiri (separation of duties) |
| **Lihat audit log (read-only, scoped ke area operasional Admin)** | ✅ |
| Hapus audit log | ❌ hanya Owner |

Semua aksi dicatat di audit log.
