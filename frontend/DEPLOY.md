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
| `WA_PROVIDER` + `WA_PROVIDER_URL` / `WA_PROVIDER_TOKEN` | tidak | lihat §6b; kosong = mode simulasi |
| `MAIL_PROVIDER` + `MAIL_PROVIDER_URL` / `MAIL_PROVIDER_TOKEN` / `MAIL_FROM` | tidak | lihat §6b; kosong = mode simulasi |
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

Reset password juga menaikkan versi perubahan password dan mencabut sesi platform
lama. Bootstrap menulis event `SUPER_ADMIN_PASSWORD_RESET` atau
`SUPER_ADMIN_CREATED` sebagai `SYSTEM_BREAK_GLASS` di `PlatformAuditLog`; tetap
catat operator, waktu, dan alasan di change log Coolify karena jalur terminal
tidak memiliki identitas Super Admin aplikasi.

Password yang pernah tercetak di terminal atau chat harus dianggap kompromi dan
tidak boleh dipakai lagi. Masukkan password melalui `read` interaktif, bukan
sebagai literal pada command atau Environment Variable permanen.

> **Jangan jalankan `npx prisma db seed` di produksi.** Seed menghapus seluruh isi
> database lebih dulu. Guard `ALLOW_PROD_SEED` ada justru untuk mencegah itu.

### Login Super Admin — email + password (tanpa MFA/OTP)

Satu langkah: isi email + password → masuk. MFA/OTP email dihapus 2026-09-08
(keputusan pemilik). **Provider email TIDAK lagi wajib untuk login Super Admin**
— `MAIL_*` hanya dipakai fitur lain (reset password tenant, fallback WA→email).

Proteksi login yang tersisa:
- Salah password 5× → akun dikunci sementara (durasi bertahap, maks 60 menit).
- Rate-limit 10 percobaan / 15 menit per identifier.
- Sesi panel dibatasi 12 jam (`PLATFORM_SESSION_MAX_AGE_MS`).

Pemulihan akun (password hilang / terkunci): SUPER_ADMIN lain reset password lewat
**Akun Admin**, atau `npm run bootstrap:superadmin` di server (menulis langsung ke DB).

Kelola akun Super Admin lain (buat, nonaktifkan, ubah sub-level, reset password,
buka kunci) lewat **Akun Admin** di panel — `bootstrap:superadmin` hanya untuk
akun pertama.

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

Resource aplikasi → **Scheduled Tasks**, tambah task berikut:

| Nama | Command | Frequency |
|---|---|---|
| `dispatch-notifications` | `./scripts/run-job.sh dispatch-notifications` | `*/3 * * * *` |
| `break-warnings` | `./scripts/run-job.sh break-warnings` | `*/3 * * * *` |
| `deadline-alerts` | `./scripts/run-job.sh deadline-alerts` | `0 * * * *` |
| `attendance-autoclose` | `./scripts/run-job.sh attendance-autoclose` | `5 0 * * *` |
| `tenant-lifecycle` | `./scripts/run-job.sh tenant-lifecycle` | `30 3 * * *` |

Jalankan sekali manual dan pastikan lognya berisi `ok`. Detail dan alternatif
crontab ada di [`JOBS.md`](./JOBS.md).

`tenant-lifecycle` men-`SUSPENDED` tenant `UNPAID` yang lewat jatuh tempo, lalu
meng-arsipkan `SUSPENDED` lama jadi `CHURNED` (melepas nama subdomain-nya) dan
menghapus permanen tenant `CHURNED` yang lewat 30 hari. **Setelah deploy
penghapusan free trial**, jalankan sekali di dalam container:
`npm run backfill:trial-to-active` (DRY RUN — tambah `APPLY=true` untuk
eksekusi) supaya tenant yang sedang trial tidak terputus. Jalankan backfill ini
**sebelum** migrasi `drop_trial_ends_at` diterapkan bila masih ada tenant TRIAL.

### 6b. Provider WhatsApp & email

Selama belum dikonfigurasi, notifikasi berjalan dalam **mode simulasi**: pesan
hanya dicatat ke log dan dianggap terkirim. Di produksi, tanpa konfigurasi
pengiriman dikembalikan gagal — termasuk tautan reset password, jadi Owner belum
benar-benar bisa reset password sendiri sampai email tersambung.

`WA_PROVIDER` dan `MAIL_PROVIDER` **wajib cocok dengan provider yang dipakai** —
bukan sekadar URL + token. Bentuk header dan badan permintaannya berbeda-beda:

| `WA_PROVIDER` | Header | URL |
|---|---|---|
| `fonnte` | `Authorization: <token>` tanpa Bearer | default `https://api.fonnte.com/send` |
| `wablas` | `Authorization: <token>` tanpa Bearer | `https://<domain>.wablas.com/api/send-message` |
| `meta` | `Authorization: Bearer <token>` | `https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages` |

| `MAIL_PROVIDER` | Header | URL |
|---|---|---|
| `resend` | `Authorization: Bearer <key>` | default `https://api.resend.com/emails` |
| `brevo` | `api-key: <key>` | default `https://api.brevo.com/v3/smtp/email` |

`MAIL_FROM` harus memakai domain yang sudah diverifikasi di provider, kalau tidak
pengiriman ditolak.

**Uji sebelum diandalkan** — dari Terminal resource aplikasi:

```sh
curl -X POST -H "Authorization: Bearer $JOBS_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"wa":"08123456789","mail":"kamu@contoh.id"}' \
     http://127.0.0.1:3000/api/jobs/test-notification
```

`200` = terkirim. `502` = ada yang gagal, dan balasannya memuat pesan error
provider apa adanya. Tabel lengkap ada di [`JOBS.md`](./JOBS.md).

### 6c. Penyimpanan file desain — VPS (lokal) atau Cloudflare R2

Designer meng-upload file desain langsung dari dashboard. Aplikasi mendukung
dua driver penyimpanan lewat `src/lib/storage.ts`, dipilih env `STORAGE_DRIVER`:

- **`local`** — file ditulis ke disk VPS sendiri, lewat route
  `/api/local-storage`. **Ini yang dipakai sekarang (default aktif).**
- **`r2`** — file di Cloudflare R2, upload/unduh langsung dari browser lewat
  presigned URL (tidak lewat server). Kodenya tetap ada dan didukung penuh —
  tinggal ganti `STORAGE_DRIVER=r2` + isi env `R2_*` kapan saja mau pindah
  balik, tanpa perlu ubah kode apa pun.

Kalau `STORAGE_DRIVER` tidak diisi sama sekali, aplikasi auto-pilih: pakai R2
kalau env `R2_*` lengkap, kalau tidak baru jatuh ke lokal. Karena kita ingin
lokal jadi pilihan pasti (bukan auto-fallback), **selalu set `STORAGE_DRIVER`
secara eksplisit** di Coolify — jangan dibiarkan kosong.

#### Setup VPS/lokal (aktif sekarang)

Beda penting dari R2: upload/unduh lewat server aplikasi sendiri (bukan
langsung ke storage eksternal), jadi **wajib** ada volume disk persisten —
tanpa itu, semua file desain hilang setiap kali aplikasi di-redeploy.

1. Coolify → resource aplikasi → tab **Storages** (Persistent Storage) →
   tambah volume, mount ke path di dalam container, mis. `/data/uploads`.
   Jangan pakai path di dalam folder build aplikasi (tertimpa tiap deploy).
2. Coolify → **Environment Variables**:
   ```
   STORAGE_DRIVER=local
   LOCAL_STORAGE_DIR=/data/uploads
   DESIGN_MAX_UPLOAD_MB=200        # opsional
   ```
3. **Redeploy.**
4. Verifikasi: upload 1 file desain test → buka lagi untuk pastikan bisa
   dibaca → **redeploy sekali lagi TANPA ubah apa pun** → buka file yang sama
   tadi. Kalau masih bisa dibuka, volume persisten sudah benar. Kalau
   hilang/404, volume belum ter-mount dengan benar — jangan pakai mode ini
   sampai ini beres.
5. Kalau upload file besar (mendekati batas `DESIGN_MAX_UPLOAD_MB`) gagal
   di tengah jalan, cek batas ukuran body di reverse proxy Coolify (Traefik) —
   itu di luar kendali kode aplikasi.
6. **Backup VPS harus mencakup path volume ini juga**, terpisah dari backup
   database di §7 — kalau tidak, file desain tidak ikut ter-backup.

#### Setup Cloudflare R2 (alternatif, tersimpan untuk dipakai lagi kapan saja)

1. Cloudflare dashboard → **R2** → **Create bucket** → nama `printpilot-designs`
   (biarkan **private** — jangan aktifkan Public Access).
2. **R2** → **Manage R2 API Tokens** → **Create API token**:
   - Permission: **Object Read & Write**
   - Scope: bucket `printpilot-designs` saja
   - Catat **Access Key ID**, **Secret Access Key**, dan **Account ID**.
3. Bucket → **Settings** → **CORS Policy** → tambahkan (ganti origin dengan domain aplikasi):
   ```json
   [
     {
       "AllowedOrigins": ["https://hrm-kreatifindo.cloud"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   Tanpa CORS yang benar, upload dari browser **gagal** (HTTP 0 / error jaringan).
4. Coolify → **Environment Variables**:
   ```
   STORAGE_DRIVER=r2
   R2_ACCOUNT_ID=<account id>
   R2_ACCESS_KEY_ID=<access key id>
   R2_SECRET_ACCESS_KEY=<secret>
   R2_BUCKET=printpilot-designs
   DESIGN_MAX_UPLOAD_MB=200        # opsional
   ```
5. **Redeploy.**

Format file yang diterima (berlaku untuk kedua mode): PDF, AI, CDR, EPS, SVG,
PSD, PNG, JPG, WEBP, TIFF. Tanpa storage dikonfigurasi, tombol upload menolak
dengan pesan jelas (fitur lain tidak terganggu). `purgeTenant` menghapus file
tenant yang di-purge di storage manapun yang sedang aktif (lokal atau R2).

> **Pindah antar mode kapan saja**: tinggal ganti `STORAGE_DRIVER` + env
> terkait lalu redeploy — tidak ada migrasi data otomatis antar mode, file
> lama di mode sebelumnya tidak ikut pindah sendiri kalau nanti bolak-balik.

---

## 7. Backup database

**Wajib, dan sering terlupakan.**

### 7a. Backup terjadwal Coolify (utama)

Resource database → tab **Backups**:

1. Tambah jadwal harian, cron `0 2 * * *`, retensi minimal 7 hari.
2. Kalau tersedia, arahkan ke S3 — backup yang hanya ada di VPS ikut hilang
   bersama VPS-nya.
3. Jalankan sekali manual dan pastikan file backup benar-benar terbentuk.

### 7b. Backup + verifikasi lewat script

Coolify tidak memeriksa apakah backup-nya masuk akal, dan tidak pernah menguji
restore. Dua celah itu ditutup dua script berikut. Jalankan dari **host VPS** —
container aplikasi Next.js tidak memuat `pg_dump`.

```sh
# dump + verifikasi + rotasi
DATABASE_URL="postgres://…" \
BACKUP_DIR=/var/backups/printpilot \
PP_DB_CONTAINER=<nama-container-postgres> \
./scripts/db-backup.sh
```

Bukan hanya men-dump: file hasilnya dibaca ulang dan ditolak kalau terlalu kecil
atau memuat terlalu sedikit tabel. Ini persis yang menyelamatkan kamu kalau
volume database sempat kosong — backup dari database kosong akan **gagal keras**,
bukan menimpa backup bagus dengan file kosong.

Env: `BACKUP_DIR` (default `./backups`), `BACKUP_KEEP` (default 7),
`BACKUP_MIN_TABLES` (default 20), `PP_DB_CONTAINER` (bila `pg_dump` tidak ada
di host).

### 7c. Latihan restore — lakukan sekali, lalu berkala

> Backup yang belum pernah diuji restore bukan backup, itu harapan.

```sh
DATABASE_URL="postgres://…" \
BACKUP_DIR=/var/backups/printpilot \
PP_DB_CONTAINER=<nama-container-postgres> \
./scripts/db-verify-restore.sh
```

Memulihkan backup terbaru ke database sementara bernama acak, menghitung isi
`Tenant` / `User` / `Role` / `Order` / `SuperAdmin`, lalu menghapus database
sementara itu. **Database produksi tidak pernah disentuh** — tidak ada satu pun
perintah tulis ke sana.

Contoh keluaran sehat:

```
verify-restore: Tenant: 3 baris
verify-restore: User: 8 baris
verify-restore: SuperAdmin: 1 baris
verify-restore: ok — backup terbukti bisa dipulihkan
```

Jadwalkan mingguan (`0 3 * * 0`) supaya backup rusak ketahuan sebelum kamu
membutuhkannya.

> Nama tabel memakai **PascalCase** dan wajib dikutip ganda di SQL —
> `SELECT count(*) FROM "Tenant";`, bukan `FROM tenants`. Schema Prisma tidak
> memakai `@@map`, dan Postgres melipat identifier tanpa kutip jadi huruf kecil.

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
