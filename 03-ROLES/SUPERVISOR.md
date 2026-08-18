# SUPERVISOR — Role & Hak Akses

## Deskripsi

Supervisor mengelola jalannya produksi harian. Bertanggung jawab atas kelancaran job dari assignment hingga QC, serta menjadi jembatan antara Owner dan tim operasional.

---

## Hak Akses Supervisor

| Modul | Akses |
|-------|-------|
| Semua order (lihat) | ✅ |
| Edit order | ❌ |
| Payment (lihat saja) | ✅ tanpa nominal detail |
| Assign job ke mesin & operator | ✅ |
| Reassign job | ✅ |
| Set status mesin MAINTENANCE | ✅ |
| Lihat antrian produksi semua mesin | ✅ |
| Lihat hasil QC | ✅ |
| Approve rework (level Supervisor) | ✅ untuk rework ke-1 dan ke-2 |
| Approve rework ke-3 | ❌ hanya Owner |
| Lihat laporan produksi | ✅ |
| Lihat laporan material | ✅ |
| Export laporan produksi | ✅ |
| Lihat data konsumen (phone/email) | ❌ |
| Audit log (lihat) | ✅ |
| Hapus audit log | ❌ |
| Buat user | ❌ hanya Owner |

---

## Dashboard Supervisor

1. Antrian job belum di-assign (badge orange)
2. Job sedang berjalan per mesin (progress real-time)
3. Antrian QC
4. QC FAIL yang perlu tindakan
5. Job overdue
6. Mesin yang MAINTENANCE
7. Job perlu reassign (operator tidak hadir)
8. Ringkasan produksi hari ini vs target

---

## Semua Aksi Supervisor Dicatat di Audit Log
