# STORAGE

Status: **Spesifikasi lengkap ada di** `02-WORKFLOW/09-STORAGE.md`

File ini hanya penanda modul teknis — jangan diisi ulang, karena akan duplikasi dengan sumber kebenaran di atas.

## Topik yang dicakup di sana

- Dua area storage: Gudang Finishing (Lantai 3, penyimpanan utama) dan Counter Penyerahan (Lantai 1, area transit pengambilan)
- Sistem penomoran lokasi (`LT3-[ZONA]-[RAK]-[SLOT]`) dan pembagian zona A–D
- Alur masuk storage lantai 3 (scan Job QR → scan QR lokasi → validasi → READY_FOR_PICKUP)
- Alur pengambilan (pickup flow) di counter lantai 1, termasuk verifikasi identitas dan pelunasan
- Penanganan insiden barang tidak ditemukan
- Struktur tabel `storage_locations` dan `storage_items`
- Format dan konteks penggunaan QR lokasi storage
