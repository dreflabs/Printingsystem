# GUDANG DASHBOARD

Dashboard kerja untuk role **Gudang** — menggabungkan 3 tahap akhir alur produksi (QC, Finishing, Storage/Gudang) yang sebelumnya jadi 3 dashboard terpisah. Digunakan di tablet/HP di area produksi/gudang, mengacu ke `DESIGN-SYSTEM.md`.

**Navigasi:** dashboard ini dibagi jadi 3 tab yang bisa dipindah bebas oleh user Gudang — **QC**, **Finishing**, dan **Storage**. Satu orang bisa berpindah tab sesuai tahap mana yang sedang mereka kerjakan; tidak perlu akun terpisah untuk tiap tahap.

---

## Widget Ringkasan (baris atas, gabungan semua tahap)

| Card | Isi |
|------|-----|
| Menunggu Inspeksi (QC) | Job berstatus PRODUCTION_COMPLETE (QC_PENDING) |
| Menunggu Finishing | Job berstatus QC_PASSED belum dimulai |
| Menunggu Disimpan | Job FINISHING_COMPLETE belum tersimpan di lokasi |
| Slot Gudang Terisi | Jumlah slot storage terpakai dari total kapasitas |

---

## Tab 1: QC (Inspeksi Kualitas)

### Tabel — Antrian Job QC_PENDING
| Kolom | Keterangan |
|-------|-----------|
| Kode Job | |
| Kode Order | |
| Nama Produk | Spesifikasi ringkas (ukuran, jumlah, finishing) |
| Mesin | |
| Operator | |
| Selesai Produksi Pukul | `actual_end` |
| Deadline | Highlight sesuai `DESIGN-SYSTEM.md` |
| Aksi | Scan / Buka Form QC |

**Filter:** Mesin · Deadline (dari–sampai) · Urutkan (paling lama menunggu / deadline terdekat)

### Form Input QC (setelah scan Job QR — SCAN 3)
Checklist inspeksi, tiap poin diberi status OK / MASALAH MINOR / MASALAH MAYOR:
- Jumlah (quantity vs planned)
- Ukuran (size sesuai order)
- Warna (color accuracy)
- Kualitas cetak (bintik, blur, stripe)
- Defect fisik (sobek, kotor, lipatan)
- Finishing (laminating, cutting, welding sesuai order)

- Hasil akhir: **PASS** atau **FAIL** (tombol besar)
- Jika FAIL wajib: kategori masalah, deskripsi (min 20 karakter), upload foto defect, rekomendasi (rework/reprint/eskalasi)
- Catatan wajib diisi jika ada item MASALAH MINOR/MAYOR

### Tabel — Riwayat Inspeksi Saya
Kode Job · Tanggal Inspeksi · Hasil (PASS/FAIL, status pill) · Kategori Masalah (jika FAIL) · Rework Ke- · Status Tindak Lanjut

**Aksi yang bisa dilakukan:** lihat antrian QC_PENDING, scan Job QR buka form QC, submit hasil QC, upload foto defect, lihat riwayat QC sendiri.
**Yang tidak boleh tampil:** nomor HP konsumen, tombol approve rework (hanya Owner), akses laporan keuangan.

---

## Tab 2: Finishing

### Tabel — Antrian Job QC_PASSED
| Kolom | Keterangan |
|-------|-----------|
| Kode Job | |
| Kode Order | |
| Nama Produk | |
| Jenis Finishing | Laminasi / Potong / Welding / dll sesuai order |
| Qty | |
| Lulus QC Pukul | |
| Deadline | Highlight sesuai `DESIGN-SYSTEM.md` |
| Aksi | Scan Mulai Finishing |

**Filter:** Jenis finishing · Deadline (dari–sampai) · Urutkan (paling lama menunggu / deadline terdekat)

### Panel Job Aktif (Finishing Berjalan)
Kode job, produk, spesifikasi finishing, waktu mulai finishing, tombol "Selesai Finishing".

### Form Selesai Finishing (SCAN 5)
- Actual quantity finishing, notes
- Setelah submit: sistem tampilkan **preview label** untuk dicetak (nama perusahaan, Job QR besar, Job Code + Order Code, nama konsumen tanpa nomor HP, deskripsi produk singkat, jumlah)
- Tombol "CETAK LABEL" → kirim ke printer terhubung
- Konfirmasi label sudah ditempel ke barang fisik

### Tabel — Riwayat Finishing Saya
Kode Job · Tanggal · Qty Selesai · Durasi Finishing · Status Label (Tercetak/Belum) · Status Job (FINISHING_COMPLETE / tersimpan di gudang)

### Alur Kerja
QC PASS → Scan Job QR (Mulai Finishing, SCAN 4) → Proses fisik (laminasi/potong/dll) → Scan Job QR (Selesai Finishing, SCAN 5) → Cetak & tempel label → Lanjut ke tab Storage untuk disimpan (SCAN 6–7)

> Finishing selesai saja belum membuat order siap diambil — status baru berubah menjadi READY_FOR_PICKUP setelah barang berhasil discan masuk ke lokasi storage (tab Storage).

**Aksi yang bisa dilakukan:** lihat antrian QC_PASSED, scan QR job (mulai & selesai finishing), cetak label QR, input actual qty finishing, lihat nama konsumen pada job.
**Yang tidak boleh tampil:** nomor HP konsumen, akses laporan apapun, label tidak boleh mencantumkan nomor HP konsumen.

---

## Tab 3: Storage (Gudang)

### Tombol Aksi Besar
- **SIMPAN JOB** — Scan Job QR → Scan Location QR → Confirm quantity → Store (SCAN 6–7, lihat `13-QR-SCAN-FLOW.md`)
- **CARI JOB** — Scan Job QR / cari manual → tampilkan lokasi saat ini & status
- **SCAN QR** — akses cepat kamera scan (Job QR atau Location QR)
- **PINDAH KE COUNTER** — konfirmasi barang dibawa dari gudang LT3 ke counter LT1 (SCAN 9)
- **RECEIVE / ISSUE MATERIAL** — input stok material masuk, tambah bahan material baru

### Tabel Utama — Daftar Barang Menunggu Disimpan
| Kolom | Keterangan |
|-------|-----------|
| Kode Job | |
| Kode Order | |
| Nama Produk | |
| Jumlah | |
| Status Finishing | FINISHING_COMPLETE (status pill) |
| Waktu Selesai Finishing | |
| Aksi | Simpan ke Gudang |

### Peta Gudang Visual
Peta per zona (grid rak): 🟢 kosong, 🔵 terisi, 🔴 penuh. Klik slot menampilkan popup info (Job Code, produk, tanggal simpan).

**Filter:** Zona / rak · Status slot (Kosong/Terisi/Penuh) · Kode job / order (search)

### Alur Kerja
- **Store Job:** Scan Job QR → Scan Location QR → Confirm quantity → Store (status → READY_FOR_PICKUP, trigger notifikasi WA otomatis)
- **Find Job:** Scan Job QR → tampilkan lokasi saat ini → tampilkan status
- **Konfirmasi ke Counter (Pickup):** Scan Job QR barang yang dibawa dari LT3 → catat "sudah di counter" → Admin lanjut verifikasi identitas & payment → Release final oleh Admin (lihat `10-PICKUP-DELIVERY.md`, Gudang tidak melakukan release final)

**Aksi yang bisa dilakukan:** scan QR Job (simpan ke storage), scan QR Lokasi (konfirmasi lokasi), lihat peta gudang LT3, pindahkan barang ke counter LT1, cari job di gudang, laporkan insiden (barang tidak ditemukan), input stok material masuk, tambah bahan material baru.
**Yang tidak boleh tampil:** nomor HP konsumen, tombol proses pickup / release final (hanya Admin), akses laporan keuangan.

Gudang tidak boleh perlu mencari-cari lewat tumpukan kertas untuk menemukan barang jadi — semua pencarian lewat sistem.
