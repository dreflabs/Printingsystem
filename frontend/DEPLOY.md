# Deploy ke Coolify

Runbook untuk deployment Print Pilot di Coolify (self-hosted, VPS).
Aplikasi Next.js ada di subfolder `frontend/`, database Postgres jadi resource terpisah.

Urutan di bawah mengasumsikan resource aplikasi dan database sudah dibuat di Coolify.

---

## 1. Konfigurasi build

Resource aplikasi → **Configuration → General**.

| Field | Isi | Catatan |
|---|---|---|
| Branch | `main` | Branch yang di-build. Cek isinya, jangan tebak dari nama resource. |
| Base Directory | `/frontend` | Aplikasi ada di subfolder, bukan root repo |
| Build Pack | `nixpacks` | Default |
| Install Command | *kosong* | `prisma generate` sudah otomatis lewat `postinstall` |
| Build Command | `npm run build` | Default |
| Start Command | `npm run start` | Sudah memuat `prisma migrate deploy` |
| Pre-deployment Command | *kosong* | Tidak perlu — migration jadi bagian dari start |
| Health Check Path | `/api/health` | |
| Health Check Port | `3000` | |

Aktifkan **Health Check**. Endpoint-nya menjalankan `SELECT 1`, jadi `200` berarti
aplikasi benar-benar bisa melayani — bukan sekadar prosesnya menyala.

---

## 2. Environment variables

Resource aplikasi → **Environment Variables**.

Buat rahasianya sekaligus:

```sh
for k in AUTH_SECRET AUDIT_SECRET JOBS_SECRET; do
  echo "$k=$(openssl rand -hex 32)"
done
```

| Variabel | Wajib | Nilai |
|---|---|---|
| `DATABASE_URL` | ya, **+ Build Variable** | URL *internal* dari resource database |
| `AUTH_SECRET` | ya | string acak — kalau berubah, semua sesi logout |
| `AUDIT_SECRET` | ya | string acak |
| `AUTH_BYPASS` | ya | `0` |
| `JOBS_SECRET` | ya | string acak, min. 16 karakter |
| `APP_URL` | ya | URL publik aplikasi, untuk tautan reset password |
| `WA_PROVIDER_URL` / `WA_PROVIDER_TOKEN` | tidak | kosong = mode simulasi |
| `MAIL_PROVIDER_URL` / `MAIL_PROVIDER_TOKEN` / `MAIL_FROM` | tidak | kosong = mode simulasi |
| `ALLOW_PROD_SEED` | **jangan diisi** | membuka kunci seed yang menghapus seluruh data |

`DATABASE_URL` harus ditandai **Build Variable** karena dipakai `prisma generate`
saat build.

Salah isi tidak akan lolos diam-diam: server memvalidasi environment saat boot dan
**menolak start** sambil menyebut variabel mana yang salah. Lihat `src/lib/env.ts`.

---

## 3. Deploy pertama

Klik **Deploy**, lalu baca **Deployments → log**. Yang harus muncul berurutan:

1. `npm install` → diakhiri `Generated Prisma Client`
2. `npm run build` → `✓ Compiled successfully` lalu tabel `Route (app)`
3. `prisma migrate deploy` → `Applying migration…` atau `No pending migrations to apply.`
4. `✓ Ready in …` → status resource **Running** dan **healthy**

| Kalau gagal | Artinya | Perbaikan |
|---|---|---|
| `@prisma/client did not initialize` | `postinstall` tidak jalan | Pastikan branch memuat script `postinstall` di `package.json` |
| `P1001 can't reach database` | `DATABASE_URL` salah / pakai host public | Ganti ke URL internal, centang Build Variable |
| `Konfigurasi environment tidak lengkap` | Ada env wajib yang kosong/salah | Pesan errornya menyebut variabelnya — perbaiki lalu deploy ulang |
| Health check merah | Aplikasi hidup tapi DB tak terjangkau | Cek resource database jalan, cek `DATABASE_URL` |

---

## 4. Super Admin pertama

Hanya sekali, pada database yang belum punya Super Admin.
Resource aplikasi → **Terminal**:

```sh
SUPER_ADMIN_EMAIL="admin@contoh.id" \
SUPER_ADMIN_PASSWORD="KataSandiKuatMinimal12" \
SUPER_ADMIN_NAME="Super Admin" \
npm run bootstrap:superadmin
```

Script-nya idempotent dan tidak pernah menghapus data — aman diulang. Kalau akunnya
sudah ada, ia hanya melapor dan tidak mengubah apa pun.

Lupa kata sandi atau akun terkunci:

```sh
SUPER_ADMIN_EMAIL="admin@contoh.id" \
SUPER_ADMIN_PASSWORD="KataSandiBaruMinimal12" \
SUPER_ADMIN_RESET_PASSWORD=true \
npm run bootstrap:superadmin
```

Hapus `SUPER_ADMIN_PASSWORD` dari environment setelah selesai.

> **Jangan jalankan `npx prisma db seed` di produksi.** Seed menghapus seluruh isi
> database lebih dulu. Guard `ALLOW_PROD_SEED` ada justru untuk mencegah itu.

---

## 5. Auto-deploy dari GitHub

Tanpa ini, setiap perubahan harus di-deploy manual dan versi di server gampang
tertinggal dari repo.

**Cara yang dianjurkan — GitHub App Coolify:**

1. Coolify → **Sources** → **+ Add** → GitHub App → ikuti alur instalasinya.
2. Beri akses ke repositori ini.
3. Resource aplikasi → **Configuration → General** → pilih source tersebut.
4. Aktifkan **Auto Deploy**.

Coolify memasang webhook-nya sendiri. Setiap push ke branch yang dikonfigurasi
langsung memicu deploy.

**Alternatif — webhook manual (untuk deploy key / repo publik):**

1. Resource aplikasi → **Webhooks** → salin **Deploy Webhook URL**.
2. GitHub repo → **Settings → Webhooks → Add webhook**.
3. Payload URL: URL tadi. Content type: `application/json`.
4. Trigger: **Just the push event**. Aktifkan.

Setelah aktif, uji dengan satu commit kecil dan pastikan deployment muncul sendiri
di tab **Deployments**.

---

## 6. Background jobs

Tiga endpoint `/api/jobs/*` hanya jalan kalau dipanggil scheduler. Tanpa ini,
notifikasi WhatsApp tidak pernah terkirim dan `deadline_alerts` tetap kosong.

Resource aplikasi → **Scheduled Tasks**, tambah tiga task:

| Nama | Command | Frequency |
|---|---|---|
| `dispatch-notifications` | `./scripts/run-job.sh dispatch-notifications` | `*/3 * * * *` |
| `break-warnings` | `./scripts/run-job.sh break-warnings` | `*/3 * * * *` |
| `deadline-alerts` | `./scripts/run-job.sh deadline-alerts` | `0 * * * *` |

Jalankan sekali manual dan pastikan lognya berisi `ok`. Detail dan alternatif
crontab ada di [`JOBS.md`](./JOBS.md).

---

## 7. Backup database

**Wajib, dan sering terlupakan.** Resource database → tab **Backups**:

1. Tambah jadwal harian, cron `0 2 * * *`, retensi minimal 7 hari.
2. Kalau tersedia, arahkan ke S3 supaya backup tidak ikut hilang bersama VPS.
3. Jalankan sekali manual dan pastikan file backup benar-benar terbentuk.

Backup yang belum pernah diuji restore bukan backup.

---

## 8. Verifikasi

- [ ] `curl -i https://APP_URL/api/health` → `200` `{"ok":true,"db":"up"}`
- [ ] Status resource di Coolify **healthy**, bukan sekadar running
- [ ] Login Super Admin berhasil di `/platform/login`
- [ ] Daftar tenant baru sampai layar sukses; catat Workspace dan Username
- [ ] Logout, login lagi dengan Workspace + Username → berhasil
- [ ] Login dengan Workspace + email owner → berhasil juga
- [ ] Username benar tapi Workspace tenant lain → **ditolak**
- [ ] Daftar tenant kedua; datanya kosong sendiri, tidak menampilkan data tenant pertama
- [ ] Scheduled Tasks pernah jalan dan lognya `ok`
- [ ] Backup terjadwal aktif dan sudah menghasilkan satu file

---

## Aturan operasional

**Jangan pernah menjalankan `docker rm` atau `docker volume rm` di VPS.**
Coolify memegang state-nya sendiri; menghapus container di belakang punggungnya
membuat keduanya tidak sinkron, dan volume yang terhapus tidak bisa dikembalikan.

- Start / stop / restart / redeploy → tombol di UI Coolify.
- Terminal VPS hanya untuk **membaca**: `docker ps`, `docker logs`, `docker volume inspect`.
