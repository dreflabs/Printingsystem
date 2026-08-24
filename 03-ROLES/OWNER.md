# OWNER — Role & Hak Akses

## Deskripsi

Owner adalah level akses tertinggi dalam sistem. Owner memiliki visibilitas penuh ke semua data dan semua modul, serta menjadi satu-satunya pihak yang bisa mengambil keputusan pada kondisi-kondisi kritis.

---

## Hak Akses Eksklusif Owner (Tidak Bisa Dilakukan Role Lain)

| Aksi | Keterangan |
|------|-----------|
| Approve / Reject rework **ke-1 dan ke-2** setelah QC FAIL | Sengaja tidak dipindah ke Admin saat penggabungan role Supervisor→Admin — rework berdampak langsung ke biaya material & waktu produksi (lihat `02-WORKFLOW/05-PRODUCTION.md` & `07-QC.md`) |
| Approve/reject eskalasi rework setelah 2x QC FAIL berturut-turut (bukan rework ketiga — job yang gagal 2x rework wajib eskalasi ke Owner untuk keputusan lanjutan: rework ulang dengan izin khusus, atau batalkan/tangani sebagai kasus khusus) | |
| **Approve reassignment job produksi ke-3 dst dalam 24 jam** untuk Job ID yang sama | Admin dibatasi maksimal 2x reassign mandiri per 24 jam; percobaan ke-3 otomatis diblokir sistem dan wajib eskalasi ke Owner (lihat `02-WORKFLOW/05-PRODUCTION.md` "Aturan Tegas — Reassignment Berulang") |
| **Approve hasil Final Audit YELLOW** sebelum order CLOSED | Admin yang submit hasil audit tidak boleh juga jadi approver-nya sendiri (separation of duties) |
| Approve cancel order yang produksi sudah berjalan | |
| Approve / Apply diskon ke order | |
| Freeze order (ON_HOLD) | |
| Hapus audit log (via panel khusus, tetap ada log penghapusan) | |
| Tambah catatan ke data absensi (tanpa mengubah data) | |
| Buat / nonaktifkan user | |
| Reset password user | |
| Override batas DP (bebas persentase) | |
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
