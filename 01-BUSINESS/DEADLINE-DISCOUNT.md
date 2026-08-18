# DEADLINE & OVERDUE — Sistem Peringatan

## Aturan Peringatan Deadline

### H-1 (1 Hari Sebelum Deadline)
Sistem otomatis memberi peringatan kepada:
- **Owner** — via badge/notifikasi di dashboard
- **Supervisor** — via badge/notifikasi di dashboard
- **Admin Sales** — via badge/notifikasi di dashboard (agar bisa persiapan komunikasi ke konsumen)

**Kondisi peringatan muncul:** Order belum berstatus READY_FOR_PICKUP dan deadline tinggal ≤ 24 jam.

**Tampilan di dashboard:** Badge kuning/oranye dengan tanda "⚠ DEADLINE BESOK" di daftar order.

### H-0 (Hari Deadline — Sudah Lewat)
Jika order belum selesai saat deadline tiba:
- Badge berubah merah dengan tanda "🔴 OVERDUE"
- Tampil di semua dashboard (Owner, Supervisor, Admin Sales)
- Muncul di laporan harian sebagai item yang harus ditangani
- **Tidak ada aksi otomatis** — hanya peringatan visual yang jelas

### Eskalasi Manual
- Supervisor yang memutuskan apakah perlu komunikasi ke konsumen tentang keterlambatan
- Admin Sales yang komunikasi ke konsumen (jika diperlukan)
- Owner yang putuskan apakah ada kompensasi atau tidak

---

## Aturan Teknis

- Pengecekan deadline dilakukan setiap jam oleh sistem (cron job)
- Peringatan tidak duplikat — jika sudah ada badge H-1, tidak muncul lagi keesokan harinya (langsung jadi OVERDUE)
- Peringatan hilang otomatis setelah order mencapai READY_FOR_PICKUP
- Semua peringatan yang muncul dicatat di sistem (bukan di audit_logs tapi di tabel `deadline_alerts`)

---

## Dashboard

Di halaman order list, kolom deadline menampilkan:
| Sisa Waktu | Tampilan |
|-----------|---------|
| > 2 hari | Teks normal |
| 1-2 hari | 🟡 Kuning — "Besok" |
| < 24 jam | 🟠 Oranye — "Hari ini" |
| Sudah lewat | 🔴 Merah — "OVERDUE X hari" |

---

## Database Tambahan

Tabel `deadline_alerts`:
```
id
order_id
alert_type    (H1_WARNING / OVERDUE)
triggered_at
resolved_at   (diisi saat order READY_FOR_PICKUP)
```

---

## Diskon — Aturan

Hanya **Owner** yang dapat memberikan diskon pada order.

**Alur:**
```
Admin Sales buka halaman order
  → Klik "Ajukan Diskon" (tombol ini tampil untuk Admin Sales dan Owner)
  → Admin Sales: hanya bisa ajukan, tidak bisa langsung apply
  → Request masuk ke Owner
  → Owner review → input jumlah/persen diskon + alasan
  → Owner klik "Setujui & Apply Diskon"
  → Harga order diupdate, audit log dicatat
```

**Catatan:**
- Diskon tidak bisa diberikan setelah order CLOSED
- Setiap diskon tercatat: siapa yang approve, berapa, alasan apa
- Admin Sales tidak bisa apply diskon sendiri tanpa Owner
- Designer tidak bisa ajukan diskon sama sekali
