# Design & Approval Workflow

## Prinsip Utama

Hanya desain yang sudah disetujui yang boleh masuk ke produksi.
Cara approval berbeda-beda tergantung tipe konsumen.

---

## Tipe 1 — Walk-in (Konsumen Datang Langsung)

**Kondisi:** Konsumen datang langsung ke toko, duduk di depan Designer/Sales.

**Alur:**
```
Konsumen duduk dengan Designer
  → Designer buat/ubah desain di hadapan konsumen
  → Konsumen lihat langsung di layar dan setujui secara lisan
  → Designer klik "Tandai Desain Disetujui" di sistem
  → Input: nama versi, catatan singkat, tanggal persetujuan
  → Status desain → APPROVED
  → Order bisa masuk ke antrian produksi
```

**Tidak perlu:** link online, tanda tangan digital, atau upload dari konsumen.
**Dicatat di sistem:** versi desain yang disetujui + timestamp + siapa yang approve (Designer yang input atas nama konsumen).

---

## Tipe 2 — Makloon (Konsumen Bawa File Sendiri)

**Kondisi:** Konsumen sudah punya file desain sendiri (format print-ready: AI, CDR, PDF, PNG resolusi tinggi).

**Alur:**
```
Konsumen kirim file (bawa langsung / kirim via WA ke Admin / upload link)
  → Admin Sales atau Designer upload file ke sistem
  → Pilih tipe: "Makloon — file dari konsumen"
  → Tidak perlu proses approval desain
  → Status desain → APPROVED (otomatis karena file dari konsumen sendiri)
  → Order bisa masuk ke antrian produksi setelah DP terpenuhi
```

**Catatan:** File yang diupload harus disimpan di sistem sebagai dokumentasi.
Jika hasil cetak tidak sesuai karena kesalahan file konsumen, sistem punya bukti bahwa file yang digunakan adalah file yang konsumen berikan.

---

## Tipe 3 — WhatsApp / Remote

**Kondisi:** Konsumen minta desain dari toko, tapi tidak datang langsung. Komunikasi via WhatsApp.

**Alur:**
```
Designer buat desain → upload preview/draft ke sistem
  → Admin Sales melihat preview di sistem
  → Admin Sales kirim preview ke konsumen via WhatsApp (di luar sistem)
  → Konsumen reply setuju/minta revisi
  → Jika setuju:
      Admin Sales klik "Konfirmasi Persetujuan via WA" di sistem
      → Input: keterangan singkat ("Konsumen konfirmasi setuju via WA jam 14:30")
      → Status desain → APPROVED
  → Jika minta revisi:
      Admin Sales catat permintaan revisi di sistem
      → Designer buat versi baru
      → Proses diulang
```

**Catatan penting:**
- Admin Sales yang mengkonfirmasi — bukan Designer
- Preview desain yang dikirim ke konsumen tidak boleh mengandung watermark atau identitas yang memungkinkan konsumen print sendiri tanpa bayar
- Persetujuan "via WA" dicatat sebagai teks di sistem (screenshot WA bisa dilampirkan sebagai bukti opsional)

---

## Aturan Umum Desain

- Setiap desain disimpan dengan versi (V1, V2, V3...)
- Hanya versi yang sudah APPROVED yang bisa masuk produksi
- Jika konsumen minta revisi setelah APPROVED, butuh re-approval sebelum bisa lanjut
- Designer tidak bisa meng-approve desainnya sendiri untuk tipe WA (harus Admin Sales)
- File desain disimpan di sistem dan tidak bisa dihapus oleh Designer setelah order masuk produksi

---

## Pencatatan di Database

Tabel `design_versions`:
- `version_no`: V1, V2, V3...
- `file_path`: lokasi file di storage
- `preview_path`: preview gambar (untuk ditampilkan di sistem)
- `uploaded_by`: user_id Designer
- `uploaded_at`
- `approval_status`: PENDING / APPROVED / REJECTED
- `approved_at`
- `approved_by`: user_id Admin Sales (untuk WA) atau Designer (untuk walk-in/makloon)
- `approval_method`: WALK_IN / MAKLOON / WHATSAPP
- `approval_notes`: catatan singkat
