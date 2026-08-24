# Correction & Adjustment Setelah Order CLOSED

## Prinsip Dasar

Setelah order berstatus CLOSED:
- **Tidak ada edit langsung** ke record yang sudah ada
- Setiap koreksi dibuat sebagai **record baru** yang merujuk ke record asli
- Ini menjaga integritas data dan audit trail

---

## Kapan Correction Diperlukan

- Ditemukan kesalahan input setelah order ditutup (misalnya: jumlah salah, harga salah)
- Ada penyesuaian keuangan setelah closing (misalnya: diskon yang terlambat dicatat)
- Koreksi material yang baru ditemukan ketika rekonsiliasi stok
- Ada komplain konsumen yang ditemukan setelah order CLOSED

---

## Siapa yang Bisa Buat Correction

- **Owner** — untuk semua jenis correction
- **Admin** — hanya untuk correction operasional (qty, material) bukan keuangan

Designer **tidak bisa** buat correction pada order yang sudah CLOSED.

---

## Alur Correction

```
Owner/Admin masuk ke halaman order (status: CLOSED)
  → Klik "Buat Koreksi"
  → Pilih kategori: Keuangan / Material / Quantity / Lainnya
  → Isi form:
      - Field yang dikoreksi
      - Nilai lama (sudah terisi otomatis dari data asli)
      - Nilai baru
      - Alasan koreksi (wajib, min 20 karakter)
  → Submit → Sistem buat record correction baru
  → Correction muncul di laporan sebagai catatan terpisah
  → Audit log mencatat: siapa, apa yang dikoreksi, kapan, alasan
```

---

## Hasil Correction

- Record asli **tidak berubah**
- Record correction baru dibuat dengan referensi ke record asli
- Laporan menampilkan nilai asli + nilai koreksi secara terpisah
- Laporan keuangan mencerminkan koreksi di bulan/periode saat koreksi dibuat (bukan periode asli)

---

## Database

Tabel `corrections`:
```
id
order_id          (FK ke orders)
corrected_entity  (contoh: payments, order_items, material_movements)
corrected_id      (FK ke record yang dikoreksi)
category          (FINANCIAL / MATERIAL / QUANTITY / OTHER)
field_name        (nama field yang dikoreksi)
old_value
new_value
reason            (wajib)
created_by        (user_id)
created_at
approved_by       (user_id Owner jika correction oleh Admin)
approved_at
```
