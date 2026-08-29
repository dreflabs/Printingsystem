# Background Jobs (`/api/jobs/*`)

Pendekatan: **DB-polling + endpoint HTTP + cron eksternal**. Tidak ada message
queue / worker terpisah. Tiap job memindai baris yang perlu diproses, mengerjakan,
lalu mengembalikan ringkasan JSON. Semua job **idempoten** — aman dipanggil ulang.

## Autentikasi

Semua endpoint butuh header:

```
Authorization: Bearer <JOBS_SECRET>
```

`JOBS_SECRET` diset di `.env` (min. 16 karakter). Tanpa header valid → `401`.
Endpoint menerima `POST` maupun `GET` (beberapa layanan cron hanya bisa GET).

Middleware sudah dikonfigurasi untuk membiarkan `/api/jobs/*` lewat tanpa sesi.

## Daftar Job

| Endpoint | Fungsi | Frekuensi disarankan |
|---|---|---|
| `/api/jobs/dispatch-notifications` | Kirim antrian `NotificationEvent` (WhatsApp) lewat provider. Retry maks. 3× jeda ≥5 menit; gagal permanen → `FAILED` + email fallback ke Admin. | tiap 2–5 menit |
| `/api/jobs/deadline-alerts` | Buat baris `deadline_alerts` H1_WARNING (deadline ≤24 jam) & OVERDUE (lewat). Tutup alert saat order `READY_FOR_PICKUP`+. | tiap 1 jam |
| `/api/jobs/break-warnings` | Menit ke-45 istirahat → WA ke pegawai. Lewat 60 menit → status `EXCEEDED` + WA ke Owner. | tiap 2–5 menit |

## Contoh cron (crontab)

```cron
*/3 * * * * curl -fsS -X POST -H "Authorization: Bearer $JOBS_SECRET" https://APP_URL/api/jobs/dispatch-notifications >/dev/null 2>&1
*/3 * * * * curl -fsS -X POST -H "Authorization: Bearer $JOBS_SECRET" https://APP_URL/api/jobs/break-warnings       >/dev/null 2>&1
0   * * * * curl -fsS -X POST -H "Authorization: Bearer $JOBS_SECRET" https://APP_URL/api/jobs/deadline-alerts      >/dev/null 2>&1
```

(Untuk Vercel Cron / cron-job.org / GitHub Actions: panggil URL yang sama dengan header di atas.)

## Provider (abstraction layer)

- **WhatsApp** — `src/lib/wa.ts`. Set `WA_PROVIDER_URL` + `WA_PROVIDER_TOKEN`
  (Fonnte / Wablas / WA Business API). Kosong = mode **simulasi** (log ke stdout,
  dianggap terkirim) — hanya di non-produksi.
- **Email** — `src/lib/mail.ts`. Set `MAIL_PROVIDER_URL` + `MAIL_PROVIDER_TOKEN` + `MAIL_FROM`.
  Kosong = mode simulasi.

Core workflow tidak pernah meng-import provider langsung — hanya lewat
`sendWhatsApp()` / `sendEmail()`.

## Catatan

- `dispatch-notifications` hanya memproses `channel = "WHATSAPP"`. Peringatan
  internal (istirahat, dsb.) dikirim langsung via `sendWhatsApp()`, tidak lewat
  tabel `NotificationEvent` (tabel itu wajib punya `order_id` + `customer_id`).
- Template pesan pelanggan: `src/lib/notification-templates.ts`.
