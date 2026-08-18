# SUPERVISOR DASHBOARD

Dashboard operasional harian untuk **Supervisor**: assignment job produksi, pemantauan antrian mesin, approval rework level Supervisor, dan ringkasan produksi/material/keuangan (tanpa detail nominal). Mengacu ke `DESIGN-SYSTEM.md`.

---

## Widget Ringkasan (baris atas)

| Card | Isi |
|------|-----|
| Job Belum Di-assign | Job CONFIRMED menunggu assignment ke mesin/operator (badge oranye) |
| Job Sedang Berjalan | Job berstatus PRODUCTION_STARTED di semua mesin |
| Antrian QC | Job PRODUCTION_COMPLETE menunggu QC |
| QC FAIL Perlu Tindakan | Job FAIL menunggu penjelasan/rework |
| Mesin Maintenance | Jumlah mesin berstatus MAINTENANCE |
| Job Overdue | Job dengan deadline lewat |

---

## Panel Produksi per Mesin

Kanban/board per mesin: kolom mesin, isi kartu job (kode job, produk, operator, progress, estimasi selesai). Mesin MAINTENANCE ditandai dengan card abu-abu/nonaktif.

## Panel Reassignment

Daftar job yang butuh reassign (operator tidak hadir / mesin maintenance mendadak), tombol "Reassign" per baris.

---

## Tabel Utama — Antrian Job Produksi

| Kolom | Keterangan |
|-------|-----------|
| Kode Job | |
| Kode Order | |
| Nama Produk | |
| Mesin | |
| Operator | |
| Status | Status pill (PRODUCTION_ASSIGNED / STARTED / COMPLETE / dst) |
| Qty Target | |
| Deadline | Highlight sesuai `DESIGN-SYSTEM.md` |
| Aksi | Assign, Reassign, Set Mesin Maintenance |

## Filter

- Mesin (dropdown)
- Status job
- Operator
- Deadline (dari–sampai)
- Overdue only (toggle)

---

## Panel QC & Rework

| Kolom | Keterangan |
|-------|-----------|
| Kode Job | |
| Hasil QC | PASS / FAIL |
| Kategori Masalah | (jika FAIL) |
| Rework Ke- | 0 / 1 / 2 |
| Aksi | Approve Rework (hanya rework ke-1 dan ke-2), Lihat Detail |

> Rework ke-3 (setelah 2x FAIL berturut) wajib eskalasi ke Owner — tombol approve tidak tampil untuk kasus ini.

---

## Panel Ringkasan Material & Keuangan (ringkas, tanpa nominal detail)

- Stok material dengan status 🔴 MENIPIS
- Ringkasan produksi hari ini vs target
- Status pembayaran order (label saja, tanpa nominal detail) — sesuai batasan akses Supervisor di `03-ROLES/SUPERVISOR.md`

---

## Aksi yang Bisa Dilakukan dari Dashboard

- Assign job ke mesin & operator, reassign job
- Set status mesin MAINTENANCE
- Lihat antrian produksi semua mesin dan hasil QC
- Approve rework level Supervisor (rework ke-1 dan ke-2)
- Lihat & export laporan produksi dan laporan material
- Lihat audit log (read-only)

## Yang Tidak Boleh Tampil

- Edit order
- Nominal payment detail (hanya status)
- Data konsumen (phone/email)
- Approve/reject eskalasi rework setelah 2x FAIL berturut (hanya Owner)
- Hapus audit log
- Buat user baru
