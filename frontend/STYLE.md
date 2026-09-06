# Panduan Bahasa & Penulisan — Print Pilot

Acuan singkat supaya teks di aplikasi konsisten. Berlaku untuk semua kode di `frontend/src`.

---

## 1. Bahasa antarmuka (UI)

- **Bahasa Indonesia** untuk semua teks yang dilihat pengguna: label, tombol, judul, placeholder, toast, pesan error.
- Sapaan **"Anda"** (formal), bukan "kamu". Konsisten di seluruh app.
- Kalimat pendek, tanpa tanda seru berlebihan. Judul pakai Title Case ("Laporan Bulanan"), kalimat biasa pakai sentence case.

### Istilah yang **boleh tetap Inggris**

Hanya daftar tertutup ini — selain ini wajib Indonesia:

| Tetap Inggris | Alasan |
|---|---|
| Nama status enum: `DRAFT`, `CONFIRMED`, `QC_PASSED`, `READY_FOR_PICKUP`, dst | Nilai teknis, tampil apa adanya di badge/log |
| `Order`, `Job`, `DP`, `QC`, `POS`, `SKU` | Istilah baku yang sudah dipakai tim & spec |
| `Waste` | Istilah lapangan di percetakan |
| Kode: `ORD-…`, `JOB-…`, `LT3-A-01-01` | Format identitas |

### Jangan campur — padanan wajib

| ❌ Jangan | ✅ Pakai |
|---|---|
| Actual Qty / Actual quantity | Jumlah aktual / Qty Aktual |
| Planned Qty | Qty Rencana |
| Completion Rate | Tingkat Penyelesaian |
| Cancel rate | Tingkat pembatalan |
| Reassign Job | Alihkan Job |
| Design job | Job desain |
| "Jumlah (Quantity vs Planned)" | "Jumlah (aktual vs rencana)" |

Satu konsep = satu istilah. Kalau sudah ada padanannya di tabel atas, jangan bikin varian baru.

---

## 2. Pesan error (`fail(...)` di server action)

### Error otorisasi (403) — **satu template**

```ts
fail("Hanya {Peran} yang boleh {aksi}.")
```

- Contoh: `"Hanya Owner/Admin yang boleh melihat laporan keuangan."`, `"Hanya role Gudang yang boleh melakukan QC."`
- Selalu **"yang boleh"**, bukan "yang bisa" (khusus otorisasi).
- Jangan pakai `"Tidak berwenang."` atau `"… hanya untuk Owner."` — selalu bentuk lengkap template di atas.
- `"yang bisa"` hanya untuk **guard status/state**, contoh: `"Hanya job berjalan yang bisa dijeda."`

### Error validasi

- Pola: `"{Field} wajib diisi."`, `"{Field} minimal {N} karakter."`, `"{Field} tidak boleh 0."`
- Fallback catch: `"Gagal {aksi}."` (mis. `"Gagal memuat laporan absensi."`) — konsisten, tanpa "Silakan coba lagi" yang panjang.

---

## 3. Komentar kode

- **Bahasa Indonesia** untuk komentar yang menjelaskan aturan bisnis / alur (biar sejalan dengan dokumen spec yang berbahasa Indonesia).
- Boleh Inggris untuk hal murni teknis (nama pattern, catatan library).
- **Jangan campur dua bahasa dalam satu file.** File lama yang komentarnya Inggris (`user-management.ts`, `password-reset.ts`, `register.ts`, `profile.ts`) boleh dibiarkan sampai disentuh lagi, tapi kalau mengedit isinya, sekalian samakan ke Indonesia.

---

## 4. Data & placeholder

- Ejaan benar: **"Vinyl"** (bukan "Viny"), **"Flexi"** (bukan "Flexy") — konsisten satu ejaan.
- Placeholder contoh diawali `"Cth: …"` atau `"mis. …"` — pilih satu (`"Cth: "`).
- Jangan hardcode password default di komentar/string. Ambil dari satu konstanta bila perlu.

---

## 5. Checklist saat menambah teks baru

- [ ] Semua teks UI Bahasa Indonesia, sapaan "Anda"?
- [ ] Tidak ada kata Inggris di luar daftar §1?
- [ ] Error 403 pakai template `"Hanya {Peran} yang boleh {aksi}."`?
- [ ] Istilah sama dengan yang sudah dipakai di tempat lain (bukan varian baru)?
- [ ] Komentar sebahasa dengan file sekitarnya?
