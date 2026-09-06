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

## Menjalankan: pakai `scripts/run-job.sh`

```sh
./scripts/run-job.sh dispatch-notifications
./scripts/run-job.sh deadline-alerts
./scripts/run-job.sh break-warnings
```

Env yang dibaca: `JOBS_SECRET` (wajib), `JOBS_BASE_URL` (default
`http://127.0.0.1:3000`), `JOBS_TIMEOUT` (default 120 detik).

**Jangan pakai `curl ... >/dev/null 2>&1` di crontab.** Pola itu membuang seluruh
keluaran, sehingga `JOBS_SECRET` yang salah, aplikasi yang mati, dan job yang
sukses terlihat sama persis — cron bisa jalan berbulan-bulan tanpa hasil dan tidak
ada yang tahu. `run-job.sh` mencetak ringkasan JSON-nya dan keluar dengan kode
bukan-nol saat gagal, jadi kegagalan muncul di log scheduler.

Contoh keluaran sukses:

```
[2026-09-06T19:11:17Z] run-job deadline-alerts: ok {"ok":true,"job":"deadline-alerts","ms":7,"result":{...}}
```

## Jadwal di Coolify (Scheduled Tasks)

Resource aplikasi → tab **Scheduled Tasks** → tambah tiga task. Perintahnya
dijalankan di dalam container aplikasi, jadi `JOBS_SECRET` sudah tersedia dari
Environment Variables dan base URL default (`127.0.0.1:3000`) sudah benar.

| Nama | Command | Frequency |
|---|---|---|
| `dispatch-notifications` | `./scripts/run-job.sh dispatch-notifications` | `*/3 * * * *` |
| `break-warnings` | `./scripts/run-job.sh break-warnings` | `*/3 * * * *` |
| `deadline-alerts` | `./scripts/run-job.sh deadline-alerts` | `0 * * * *` |

Setelah tersimpan, jalankan sekali manual dari UI dan periksa lognya berisi `ok`.
Task yang merah berarti benar-benar gagal — bukan sekadar tidak ada pekerjaan.

## Alternatif: crontab di host

Kalau tidak memakai Scheduled Tasks, dari host VPS:

```cron
*/3 * * * * cd /path/ke/frontend && JOBS_SECRET=xxx JOBS_BASE_URL=https://app.contoh.id ./scripts/run-job.sh dispatch-notifications >> /var/log/printpilot-jobs.log 2>&1
*/3 * * * * cd /path/ke/frontend && JOBS_SECRET=xxx JOBS_BASE_URL=https://app.contoh.id ./scripts/run-job.sh break-warnings       >> /var/log/printpilot-jobs.log 2>&1
0   * * * * cd /path/ke/frontend && JOBS_SECRET=xxx JOBS_BASE_URL=https://app.contoh.id ./scripts/run-job.sh deadline-alerts      >> /var/log/printpilot-jobs.log 2>&1
```

Catat ke file log (`>>`), jangan ke `/dev/null`.

(Untuk cron-job.org / GitHub Actions: panggil URL yang sama dengan header Bearer,
dan pastikan layanannya melaporkan status HTTP bukan-200 sebagai kegagalan.)

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
