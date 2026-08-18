# OWNER — Role & Hak Akses

## Deskripsi

Owner adalah level akses tertinggi dalam sistem. Owner memiliki visibilitas penuh ke semua data dan semua modul, serta menjadi satu-satunya pihak yang bisa mengambil keputusan pada kondisi-kondisi kritis.

---

## Hak Akses Eksklusif Owner (Tidak Bisa Dilakukan Role Lain)

| Aksi | Keterangan |
|------|-----------|
| Approve / Reject rework setelah QC FAIL | |
| Approve cancel order yang produksi sudah berjalan | |
| Approve / Apply diskon ke order | |
| Freeze order (ON_HOLD) | |
| Hapus audit log (via panel khusus, tetap ada log penghapusan) | |
| Tambah catatan ke data absensi (tanpa mengubah data) | |
| Buat / nonaktifkan user | |
| Reset password user | |
| Override batas DP (bebas persentase) | |
| Approve rework ke-3 (jika QC fail 3x berturut-turut) | |
| Unlock akun yang terkunci permanen (>3 kali terkunci dalam sehari) | |
| Export semua laporan | |

---

## Hak Akses Umum (Sama dengan Role Senior Lain)

- Lihat semua order, job, payment, storage
- Lihat audit log real-time
- Lihat laporan keuangan, produksi, material, pegawai
- Input stok material masuk
- Tambah bahan material baru

---

## Dashboard Owner

Widget yang tampil di halaman utama Owner:
1. KPI: Total order hari ini, Siap diambil, Produksi aktif, Omset bulan ini
2. Alert kritis (QC FAIL menunggu keputusan, cancel request, diskon request)
3. Order OVERDUE
4. WA gagal terkirim
5. Stok material menipis
6. Ringkasan absensi hari ini (berapa hadir, berapa terlambat)
7. Pipeline produksi (kanban mini per stage)
8. Antrian approval (rework, cancel, diskon)
9. Audit log 10 aksi terbaru

---

## Semua Aksi Owner Dicatat di Audit Log
