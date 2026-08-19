# ABSENSI — Aturan & Workflow

## Model Hybrid

Sistem menggunakan pendekatan hybrid antara mesin fingerprint dan PrintFlow:

| Aktivitas | Dicatat di | Keterangan |
|-----------|-----------|-----------|
| Masuk kerja | Mesin Fingerprint | Import CSV ke PrintFlow |
| Pulang kerja | Mesin Fingerprint | Import CSV ke PrintFlow |
| Mulai Istirahat | PrintFlow (tombol di HP/browser) | Real-time tracking |
| Selesai Istirahat | PrintFlow (tombol di HP/browser) | Real-time tracking |

---

## Aturan Absensi

### 1. Keterlambatan Masuk

- **Batas masuk:** 09:15 WIB
- Jika jam masuk (dari fingerprint) > 09:15 → status otomatis: **TERLAMBAT**
- Label terlambat **tidak bisa diubah** oleh siapapun kecuali Owner
- Saat data fingerprint diimport, sistem otomatis memberi label per pegawai
- Laporan keterlambatan langsung muncul di:
  - Dashboard Owner (notifikasi real-time setelah import)
  - Dashboard Admin Sales (tampilan saja, tidak bisa diubah)

### 2. Istirahat

- **Durasi maksimal istirahat:** 60 menit (1 jam)
- Pegawai klik **"Mulai Istirahat"** di PrintFlow saat akan istirahat
- Pegawai klik **"Selesai Istirahat"** saat kembali kerja

#### Peringatan 15 Menit Sebelum Selesai
- Sistem otomatis menghitung: `waktu_mulai_istirahat + 45 menit`
- Pada menit ke-45: sistem kirim peringatan ke pegawai:
  - Badge/popup di halaman browser yang sedang dibuka pegawai
  - WhatsApp ke nomor HP pegawai (jika terdaftar di sistem)
- Pesan peringatan: *"Istirahat Anda berakhir dalam 15 menit. Silakan kembali ke tempat kerja."*

#### Istirahat Melebihi 1 Jam
- Jika pegawai belum klik "Selesai Istirahat" setelah 60 menit:
  - Status otomatis: **ISTIRAHAT BERLEBIH**
  - Alert merah muncul di dashboard Owner dan Admin
  - WhatsApp otomatis ke Owner: *"[Nama Pegawai] sudah istirahat lebih dari 60 menit sejak [jam]"*
- Sistem tetap mencatat waktu sebenarnya saat pegawai klik Selesai Istirahat

---

## Aturan Immutability (Tidak Bisa Diubah)

| Data | Bisa Diubah? | Pengecualian |
|------|-------------|-------------|
| Jam masuk (dari fingerprint) | ❌ Tidak | Owner bisa tambahkan catatan koreksi (bukan ubah data) |
| Label TERLAMBAT | ❌ Tidak | Owner bisa tambahkan keterangan (misal: ada alasan sah) |
| Waktu mulai istirahat | ❌ Tidak | Tercatat otomatis saat klik tombol |
| Waktu selesai istirahat | ❌ Tidak | Tercatat otomatis saat klik tombol |
| Label ISTIRAHAT BERLEBIH | ❌ Tidak | Owner bisa tambahkan keterangan |

Owner **tidak bisa menghapus atau mengedit** data absensi — hanya bisa menambahkan **catatan/keterangan** sebagai lampiran. Ini menjaga integritas data.

---

## Tombol di PrintFlow (Per Pegawai)

Di halaman dashboard masing-masing pegawai (Operator, Finishing, QC, dll):

```
┌─────────────────────────────────────────┐
│  STATUS HARI INI                        │
│  Masuk: 09:10 ✅ (dari fingerprint)     │
│                                         │
│  [ 🍽️  MULAI ISTIRAHAT  ]              │
│  (tombol muncul jika belum istirahat)   │
└─────────────────────────────────────────┘
```

Saat istirahat berjalan:
```
┌─────────────────────────────────────────┐
│  ISTIRAHAT BERJALAN                     │
│  Mulai: 12:00 | Berlangsung: 35 menit  │
│  Sisa: 25 menit                         │
│                                         │
│  [ ✅  SELESAI ISTIRAHAT  ]            │
└─────────────────────────────────────────┘
```

---

## Notifikasi WhatsApp ke Pegawai

Agar bisa kirim WhatsApp ke pegawai, **nomor HP pegawai harus disimpan di data user**.

Tambahkan field `phone` di tabel `users`:
```
users.phone  — nomor HP pegawai (opsional, untuk notifikasi internal)
```

Jenis notifikasi WA ke pegawai:
| Trigger | Pesan |
|---------|-------|
| 45 menit istirahat | *"Istirahat Anda berakhir dalam 15 menit. Silakan kembali ke tempat kerja."* |
| 60 menit istirahat terlewat | *"Istirahat Anda sudah melebihi batas 1 jam. Segera kembali."* |

---

## Notifikasi ke Owner & Admin

| Event | Channel | Isi |
|-------|---------|-----|
| Pegawai terlambat (saat import CSV) | Dashboard Owner + WA Owner | "[Nama] terlambat masuk. Jam masuk: [jam]" |
| Istirahat > 60 menit | Dashboard Owner + Admin + WA Owner | "[Nama] sudah istirahat [X] menit." |
| Import absensi fingerprint selesai | Dashboard Owner | "Data absensi [tanggal] berhasil diimport. [X] pegawai hadir, [Y] terlambat." |

---

## Laporan Absensi

Tampil di **Owner Dashboard** dan **Laporan Bulanan Owner**:

| Kolom | Keterangan |
|-------|-----------|
| Nama Pegawai | |
| Tanggal | |
| Jam Masuk | Dari fingerprint |
| Status Masuk | TEPAT WAKTU / TERLAMBAT |
| Jam Mulai Istirahat | Dari PrintFlow |
| Jam Selesai Istirahat | Dari PrintFlow |
| Durasi Istirahat | Dihitung otomatis |
| Status Istirahat | NORMAL / BERLEBIH |
| Keterangan Owner | Catatan opsional dari Owner |

**Tidak tampil di dashboard Designer, Operator, Finishing, Warehouse.**
Admin Sales hanya bisa **lihat** laporan absensi, tidak bisa edit.

---

## Database

### Tabel `attendance_records`
```
id
user_id               (FK ke users)
date
check_in              (dari import fingerprint)
check_out             (dari import fingerprint)
check_in_status       (ON_TIME / LATE)
late_minutes          (selisih dari 09:15)
break_start           (dari tombol PrintFlow)
break_end             (dari tombol PrintFlow)
break_duration_min    (dihitung otomatis)
break_status          (NORMAL / EXCEEDED)
warning_sent_at       (timestamp kirim peringatan 15 menit)
owner_note            (catatan Owner, tidak mengubah data)
import_id             (FK ke attendance_imports)
created_at
```

### Tabel `attendance_imports`
```
id
imported_by           (user_id Owner/Admin)
import_date
file_path
period_start
period_end
row_count
late_count
created_at
```

---

## Fase Implementasi

Fitur absensi ini masuk **Fase 2** setelah core workflow selesai.

Urutan implementasi Fase 2:
1. Tambah field `phone` di tabel `users`
2. Buat halaman import CSV fingerprint
3. Buat tombol Mulai/Selesai Istirahat di dashboard pegawai
4. Buat cron job untuk peringatan 15 menit & 60 menit
5. Buat laporan absensi di Owner dashboard
6. Integrasi WA notification ke pegawai
