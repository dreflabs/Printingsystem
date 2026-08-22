# QC

Status: **Spesifikasi lengkap ada di** `02-WORKFLOW/07-QC.md`

File ini hanya penanda modul teknis — jangan diisi ulang, karena akan duplikasi dengan sumber kebenaran di atas.

## Topik yang dicakup di sana

- Alur utama: production complete → scan Job QR → checklist inspeksi → hasil PASS/FAIL
- Item checklist inspeksi (quantity, ukuran, warna, kualitas cetak, defect fisik, finishing)
- QC PASS: order lanjut ke FINISHING tanpa approval tambahan
- QC FAIL: alur rework lengkap 5 langkah (pelaporan, notifikasi otomatis ke Owner/Admin, penjelasan operator, keputusan Owner approve/reject/hold, QC ulang oleh inspector berbeda)
- Batas maksimal rework (2x per Job ID) dan eskalasi wajib jika rework kedua juga gagal
- Struktur tabel `qc_records` dan pencatatan keputusan rework di `audit_logs`
