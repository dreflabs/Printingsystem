# SAMPLE MACHINES — Daftar Mesin Percetakan

## Daftar Mesin Resmi

| Kode Mesin | Nama | Kategori | Produk yang Dihasilkan |
|-----------|------|----------|----------------------|
| M-OUT-01 | Mesin Outdoor 01 | Outdoor | Banner, Spanduk, Backdrop, MMT, Frontlit, Backlit |
| M-IND-01 | Mesin Indoor 01 | Indoor | Sticker Vinyl, Cetak Foto Besar, Sticker Oneway Vision |
| M-SUB-01 | Mesin Sublimasi 01 | Sublimasi | Jersey, Baju Polyester, Kain Custom, Bendera Sublim |
| M-A3-01 | Mesin A3 01 | A3/Digital | Cetak A3, Art Paper, Photo Paper A3, Undangan |
| M-UV-01 | Mesin UV 01 | UV Printing | Cetak di Acrylic, Kayu, Kaca, PVC, Plat Metal |
| M-DTF-01 | Mesin DTF 01 | DTF | Transfer ke Kaos, Jaket, Topi, Kain Gelap |
| M-FLG-01 | Mesin Bendera 01 | Bendera | Bendera Satin, Bendera Polyester, Umbul-umbul |

---

## Catatan

- Kode mesin mengikuti format: `M-[KATEGORI]-[NOMOR]`
- Jika di masa depan ada mesin tambahan sejenis: `M-OUT-02`, `M-OUT-03`, dst
- Setiap mesin memiliki daftar bahan (material) yang kompatibel — lihat `SAMPLE-MATERIALS.md`
- Mesin bisa dinonaktifkan di sistem jika sedang dalam perawatan (status: INACTIVE)

---

## Status Mesin

| Status | Artinya |
|--------|---------|
| ACTIVE | Siap digunakan untuk produksi |
| MAINTENANCE | Sedang diperbaiki/servis |
| INACTIVE | Tidak digunakan sementara |

Perubahan status mesin hanya bisa dilakukan oleh Supervisor atau Owner.
Jika mesin di-set MAINTENANCE, job yang sudah di-assign harus di-reassign ke mesin lain.
