# ACCEPTANCE CRITERIA — Checklist Pengujian Per Modul

## Apa Ini?

Daftar kondisi yang harus **TERPENUHI** sebelum sistem dinyatakan siap digunakan.
Gunakan dokumen ini sebagai checklist saat testing sebelum sistem diserahkan untuk dipakai.

---

## Modul 1 — Authentication & User

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 1.1 | Login dengan username & password benar | Berhasil masuk, diarahkan ke dashboard sesuai role |
| 1.2 | Login dengan password salah 5 kali | Akun terkunci 15 menit, muncul pesan error |
| 1.3 | Login sebagai Designer, coba akses menu Payment | Ditolak, muncul pesan "Akses Ditolak" |
| 1.4 | Owner buat user baru | User tersimpan, bisa login dengan password sementara |
| 1.5 | Owner nonaktifkan user | User tidak bisa login |
| 1.6 | User baru login pertama kali | Sistem paksa ganti password |

---

## Modul 2 — Data Konsumen (Keamanan)

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 2.1 | Designer buka halaman detail order | Nama konsumen tampil, nomor HP **tidak tampil sama sekali** |
| 2.2 | API response untuk Designer yang request data konsumen | Field `phone` dan `email` **tidak ada** dalam JSON response |
| 2.3 | Admin buka halaman detail order | Nama + nomor HP tampil normal |
| 2.4 | Operator buka halaman job | Nama konsumen tampil, nomor HP tidak tampil |

---

## Modul 3 — Order

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 3.1 | Buat order baru dengan semua field wajib | Order tersimpan dengan status DRAFT |
| 3.2 | Coba buat order tanpa Customer ID | Sistem menolak, tampil error validasi |
| 3.3 | Order code format | Format `ORD-YYYYMMDD-XXXX` terbentuk otomatis |
| 3.4 | Dua order dibuat di hari yang sama | Urutan bertambah: 0001, 0002 |

---

## Modul 4 — Approval Desain

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 4.1 | Designer approve desain walk-in | Status desain → APPROVED, method: WALK_IN |
| 4.2 | Admin konfirmasi approval Online | Status desain → APPROVED, method: ONLINE |
| 4.3 | Makloon: file diupload | Status desain → APPROVED otomatis, method: MAKLOON |
| 4.4 | Coba kirim order ke produksi tanpa desain APPROVED | Sistem menolak |

---

## Modul 5 — Payment & DP

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 5.1 | Order walk-in, DP < 50% | Tidak bisa lanjut ke produksi |
| 5.2 | Admin coba apply diskon tanpa Owner | Tombol apply diskon tidak ada, hanya tombol "Ajukan" |
| 5.3 | Owner apply diskon | Harga order berubah, audit log tercatat |
| 5.4 | Designer coba konfirmasi payment | Tidak ada akses/tombol, ditolak server-side |

---

## Modul 6 — Produksi & QR

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 6.1 | Operator scan Job QR di browser HP | Kamera terbuka, QR terdeteksi, halaman job terbuka |
| 6.2 | Operator yang bukan di-assign scan Job QR | Muncul error "Anda tidak di-assign ke job ini" |
| 6.3 | Scan Job QR yang status bukan PRODUCTION_ASSIGNED | Tombol "Mulai Produksi" tidak tampil |
| 6.4 | Operator submit selesai tanpa isi actual_qty | Sistem menolak |
| 6.5 | Operator input waste > 0 tanpa alasan | Sistem menolak |
| 6.6 | Operator klik "Jeda Produksi" tanpa isi alasan | Sistem menolak |
| 6.7 | Operator jeda job PRODUCTION_STARTED | Status job → PRODUCTION_PAUSED, timer berhenti terlihat, `paused_at` tercatat |
| 6.8 | Operator klik "Lanjutkan Produksi" setelah jeda | Status job kembali PRODUCTION_STARTED, `resumed_at` tercatat, durasi jeda dikurangi dari total waktu produksi di laporan |
| 6.9 | Operator coba scan mulai job baru selagi masih ada job PRODUCTION_STARTED/PRODUCTION_PAUSED lain | Sistem menolak — 1 job aktif per Operator |

---

## Modul 7 — QC

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 7.1 | Gudang submit FAIL tanpa foto/keterangan | Sistem menolak (keterangan wajib) |
| 7.2 | QC FAIL | Notifikasi muncul di dashboard Owner dan Admin |
| 7.3 | Owner approve rework | Status → REWORK_APPROVED, operator bisa mulai ulang |
| 7.4 | Job sudah 2x rework, QC FAIL lagi | Sistem blokir rework ke-3, tampil eskalasi ke Owner |

---

## Modul 8 — Storage & Scan

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 8.1 | Scan Job QR (SCAN 6) saat status bukan FINISHING_COMPLETE | Sistem menolak aksi simpan |
| 8.2 | Scan Location QR slot yang sudah penuh | Sistem menolak, tampil error "Lokasi penuh" |
| 8.3 | Setelah SCAN 7 berhasil | Status → READY_FOR_PICKUP, WA dikirim otomatis |
| 8.4 | WA gagal terkirim | Status order tidak berubah, admin dapat alert merah |

---

## Modul 9 — Pickup & Release

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 9.1 | Admin scan Job QR saat pickup | Tampil nama konsumen, status payment, lokasi gudang |
| 9.2 | Coba release dengan sisa payment tanpa override Owner | Sistem menolak |
| 9.3 | Admin berhasil release | Status → PICKED_UP, storage item dilepas |
| 9.4 | Coba release job yang sama dua kali | Sistem menolak "Sudah di-release" |

---

## Modul 10 — Deadline & Notifikasi

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 10.1 | Order dengan deadline besok, belum selesai | Badge kuning "⚠ Deadline Besok" muncul di dashboard |
| 10.2 | Order melewati deadline, belum selesai | Badge merah "🔴 OVERDUE" muncul |
| 10.3 | Order selesai sebelum deadline | Badge peringatan hilang |

---

## Modul 11 — Cancel

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 11.1 | Cancel order sebelum produksi | Bisa dilakukan Admin, DP bisa dikembalikan |
| 11.2 | Cancel order saat produksi sudah berjalan | Harus tunggu approval Owner, DP hangus |
| 11.3 | Admin coba cancel order yang sudah produksi tanpa Owner | Tombol langsung cancel tidak ada, hanya "Ajukan Cancel" |

---

## Modul 12 — Audit & Laporan

| # | Skenario | Hasil yang Diharapkan |
|---|----------|----------------------|
| 12.1 | Semua aksi kritis dilakukan | Masing-masing muncul di audit log dengan detail lengkap |
| 12.2 | Admin coba hapus audit log | Tidak ada tombol hapus, API DELETE ditolak |
| 12.3 | Owner ekspor laporan | File PDF/XLSX berhasil diunduh, ada catatan di audit log |
| 12.4 | Operator coba edit data order | Ditolak, operator hanya bisa update job |
