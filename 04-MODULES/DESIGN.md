# DESIGN

Status: **Spesifikasi lengkap ada di** `02-WORKFLOW/03-DESIGN-APPROVAL.md`

File ini hanya penanda modul teknis — jangan diisi ulang, karena akan duplikasi dengan sumber kebenaran di atas.

## Topik yang dicakup di sana

- Tiga jalur approval desain: Walk-in (approval lisan langsung), Makloon (file dari konsumen, auto-approved), Online/Remote (approval via konfirmasi Admin)
- Aturan umum: versioning desain (V1, V2, V3...), hanya versi APPROVED yang boleh masuk produksi
- Larangan Designer meng-approve desainnya sendiri untuk jalur Online
- Struktur tabel `design_versions` (file_path, preview_path, approval_status, approved_by, approval_method, dll.)
