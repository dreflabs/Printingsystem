# Absensi In-App — Pegawai Absen Langsung di Print Pilot

Revisi dari `11-FUTURE/ABSENSI-FINGERPRINT.md`. Fitur absensi dinaikkan dari
"model hybrid dengan mesin fingerprint sebagai sumber jam masuk/pulang" menjadi
**absen langsung di aplikasi sebagai cara utama, dengan import CSV fingerprint
tetap tersedia sebagai jalur cadangan / rekonsiliasi**.

Status: **Fitur Inti**. Menggantikan bagian "Model Hybrid" di dokumen lama.

---

## 1. Model Baru (Hybrid, In-App Utama)

| Aktivitas | Cara utama | Cadangan |
|-----------|-----------|----------|
| Masuk kerja | Tombol **Absen Masuk** di Print Pilot (HP pribadi / kiosk) | Import CSV fingerprint · input manual Admin |
| Pulang kerja | Tombol **Absen Pulang** di Print Pilot | Import CSV fingerprint · input manual Admin |
| Mulai / Selesai Istirahat | Tombol di Print Pilot (sudah ada di backend) | — |

Setiap baris `AttendanceRecord` menyimpan **`source`** supaya jelas asalnya dan
tidak dobel: `IN_APP` · `KIOSK` · `FINGERPRINT_IMPORT` · `MANUAL`.

### Dua jalur absen in-app

1. **HP pribadi pegawai** — pegawai login sendiri, buka dashboard, tekan tombol.
   Wajib: izin lokasi (GPS) + foto selfie. Opsional: hanya boleh dari IP kantor.
2. **Kiosk** — satu tablet/PC di meja depan, "login" sekali sebagai perangkat
   kiosk milik tenant. Menampilkan daftar pegawai → pegawai pilih namanya →
   masukkan **PIN 4–6 digit** → ambil selfie → Absen Masuk/Pulang. GPS = lokasi
   tetap tablet. Selfie adalah mekanisme anti-titip di kiosk (PIN bisa dititipkan,
   wajah tidak).

Owner memilih jalur mana yang aktif: `kiosk_enabled`, `personal_device_enabled`
(boleh keduanya).

---

## 2. Pengaturan Absensi (Dashboard Owner)

Halaman baru **`/owner/attendance-settings`** (Owner-only). Model
`TenantAttendanceSetting` (1 baris per tenant, dibuat saat registrasi dengan
default):

| Field | Default | Keterangan |
|-------|---------|-----------|
| `work_start` | `09:00` | Jam masuk resmi |
| `late_after` | `09:15` | Lewat ini → **TERLAMBAT**, `late_minutes` dihitung dari sini |
| `work_end` | `17:00` | Jam pulang; dipakai auto-close & status pulang cepat |
| `workdays` | `[1,2,3,4,5,6]` | Hari kerja (1=Senin … 7=Minggu). Absen di luar hari kerja → dicatat, ditandai `off_day` |
| `break_max_min` | `60` | Batas istirahat (sudah dipakai `clock.ts`) |
| `earliest_clock_in_min` | `120` | Tidak boleh Absen Masuk lebih awal dari `work_start − ini` |
| `geofence_lat` / `geofence_lng` / `geofence_radius_m` | kosong / `150` | Titik & radius kantor |
| `geofence_mode` | `FLAG` | `OFF` · `FLAG` (catat + tandai di luar radius) · `ENFORCE` (tolak di luar radius) |
| `ip_allowlist` | kosong | Daftar IP / CIDR kantor (dipisah koma) |
| `ip_mode` | `OFF` | `OFF` · `FLAG` · `ENFORCE` |
| `selfie_required` | `true` | Wajib selfie tiap absen |
| `selfie_retention_days` | `120` | Selfie lebih tua dari ini dihapus cron |
| `kiosk_enabled` | `false` | |
| `personal_device_enabled` | `true` | |
| `auto_close_at` | `23:59` | Jam cron menutup absen yang lupa pulang |

**Fase lanjut (bukan MVP):** jadwal shift per pegawai / per hari
(`EmployeeShift`) yang meng-override `work_start`/`work_end` global. Untuk MVP
satu jadwal per tenant + on/off hari kerja sudah cukup.

Perubahan pengaturan **di-audit-log** (`ATTENDANCE_SETTING_UPDATED`, old→new).
Tidak mengubah baris absensi yang sudah ada (status dihitung saat absen terjadi,
disimpan, tidak dihitung ulang).

---

## 3. Perubahan Schema

### `AttendanceRecord` — kolom tambahan

```
source                String   // IN_APP | KIOSK | FINGERPRINT_IMPORT | MANUAL
check_in_method       String?  // IN_APP | KIOSK | FINGERPRINT_IMPORT | MANUAL (per-punch)
check_out_method      String?
check_out_status      String?  // ON_TIME | EARLY | AUTO_CLOSED
check_in_lat          Float?
check_in_lng          Float?
check_in_accuracy_m   Float?
check_out_lat         Float?
check_out_lng         Float?
check_out_accuracy_m  Float?
check_in_ip           String?
check_out_ip          String?
geo_flag              Boolean  @default(false)  // true = ada punch di luar geofence
ip_flag               Boolean  @default(false)
off_day               Boolean  @default(false)  // absen di luar workdays
device_label          String?  // ringkas User-Agent / nama kiosk
```

`check_in` / `check_out` / `check_in_status` / `late_minutes` / `break_*` /
`owner_note` / `import_id` — **tidak berubah**. `import_id` tetap nullable.

### `AttendanceSelfie` — tabel baru (thumbnail di DB, bukan object storage)

```
id           String   @id @default(uuid())
tenant_id    String
record_id    String
kind         String   // CHECK_IN | CHECK_OUT
mime         String   // image/webp
bytes        Bytes    // selfie di-downscale klien ke ≤320px WebP (~15–25 KB)
created_at   DateTime @default(now())
@@index([tenant_id, created_at])
```

> **Alasan:** object storage nyata belum ada di proyek (masih `file_path` sintetis).
> Thumbnail absensi kecil, hanya untuk sengketa jangka pendek, dan dihapus setelah
> `selfie_retention_days`. Beberapa MB/tahun/tenant di Postgres — aman. Jalur
> migrasi ke S3/object storage nanti tinggal ganti `bytes` → `url`.

### `User` — kolom tambahan

```
kiosk_pin_hash        String?  // bcrypt, 4–6 digit, di-set Owner/Admin di form pegawai
```

`phone` **sudah ada** di schema tapi belum bisa diisi — form pegawai wajib
diberi input nomor HP (blocker WA ke pegawai).

### `KioskDevice` — tabel baru (Fase B)

```
id            String   @id @default(uuid())
tenant_id     String
label         String   // "Tablet Meja Depan"
token_hash    String   @unique  // token panjang di cookie perangkat, revocable
created_by    String
last_seen_at  DateTime?
active        Boolean  @default(true)
created_at    DateTime @default(now())
```

### `TenantAttendanceSetting` — tabel baru

Field di §2. `@@unique([tenant_id])`.

Migrasi: satu folder `prisma/migrations/<ts>_attendance_in_app/`. Jalankan
`prisma generate` → **restart `next dev`** (klien stale).

---

## 4. Server Actions (`src/actions/clock.ts` diperluas)

Waktu **selalu dari server** (`new Date()`), tidak pernah dari klien.

### `clockIn(input)` — absen masuk (HP pribadi, self)

```ts
input = {
  lat?: number; lng?: number; accuracyM?: number;  // dari navigator.geolocation
  selfie?: string;                                   // dataURL webp, wajib jika selfie_required
}
```

Langkah:
1. `requireUser()` + `requireTenant()`. Ambil `TenantAttendanceSetting`.
2. Tolak jika `personal_device_enabled === false`.
3. Sudah ada `AttendanceRecord` hari ini dengan `check_in` terisi → `fail("Anda sudah absen masuk hari ini.")`.
4. Terlalu awal: `now < work_start − earliest_clock_in_min` → tolak.
5. IP: baca dari header (`x-forwarded-for` pertama). `ip_mode=ENFORCE` & di luar `ip_allowlist` → tolak; `FLAG` → set `ip_flag`.
6. Geofence: `geofence_mode=ENFORCE` & jarak(haversine) > `radius + accuracyM` → tolak ("Anda di luar area kantor"); `FLAG` → set `geo_flag`.
7. Selfie: `selfie_required` & tidak ada → tolak. Simpan → `AttendanceSelfie(kind=CHECK_IN)` setelah record dibuat.
8. Hitung status: `now > late_after` → `check_in_status=LATE`, `late_minutes = menit(now − late_after)`; else `ON_TIME`. `off_day` jika weekday bukan di `workdays`.
9. Upsert `AttendanceRecord` (isi baris istirahat hari ini jika sudah dibuat oleh `startBreak`; jika belum, create). `source="IN_APP"`, `check_in_method="IN_APP"`, simpan lat/lng/accuracy/ip/device_label.
10. `logAction("ATTENDANCE_CLOCK_IN", ...)`. `revalidatePath` dashboard pegawai.
11. Jika `LATE` → antre `NotificationEvent` WA ke Owner ("[Nama] terlambat masuk. Jam masuk: [jam]") — dikirim oleh cron `dispatch-notifications` yang sudah ada.

### `clockOut(input)` — absen pulang (self)

Sama pola. Tolak jika belum `check_in`. `check_out_status`: `now < work_end` →
`EARLY`, else `ON_TIME`. Selfie `kind=CHECK_OUT`. Jika sedang istirahat
(`break_start && !break_end`) → tolak ("Selesaikan istirahat dulu").

### `kioskClockIn(userId, pin, input)` / `kioskClockOut(...)` — Fase B

- Dipanggil dari `/kiosk`, auth = **cookie token kiosk** (bukan sesi user).
  `assertKioskDevice(req)` → tenant dari `KioskDevice`.
- `userId` harus pegawai aktif di tenant itu; `bcrypt.compare(pin, user.kiosk_pin_hash)`.
- 5× PIN salah untuk userId itu dalam 15 menit → kunci userId di kiosk 15 menit
  (in-memory rate-limit, pola `src/lib/rate-limit.ts` yang sudah ada).
- Sisanya identik dengan `clockIn`, `source="KIOSK"`, `check_in_method="KIOSK"`,
  `device_label = KioskDevice.label`. GPS dari tablet (biasanya lolos geofence).

### Pengaturan (Owner-only)

- `getAttendanceSettings()` — buat default jika belum ada.
- `updateAttendanceSettings(patch)` — validasi (`late_after ≥ work_start`,
  radius 20–2000 m, IP/CIDR valid, dst.), audit-log.
- `setEmployeePin(userId, pin)` — Owner/Admin, di form pegawai. Hanya simpan hash.
- Kiosk: `createKioskDevice(label)` → kembalikan token sekali (tampil sekali),
  `listKioskDevices()`, `revokeKioskDevice(id)`.

---

## 5. Import CSV — guard konflik (WAJIB ditambah)

`commitAttendanceImport` sekarang `createMany` tanpa cek baris yang sudah ada.
Setelah ada absen in-app, ini bisa menimpa/menggandakan. Aturan baru:

Untuk tiap (user, tanggal) di file:
- **Belum ada record** → buat seperti biasa, `source="FINGERPRINT_IMPORT"`.
- **Sudah ada record `source=IN_APP`/`KIOSK`** → **jangan timpa**. Isi hanya field
  yang masih `null` (mis. `check_out` jika pegawai lupa absen pulang). Jika
  fingerprint & in-app beda > `15 menit` di field yang sama → catat
  `owner_note` prefiks "⚠ Konflik import:" + tandai untuk ditinjau Owner
  (jangan ubah nilai in-app).
- **Sudah ada `source=MANUAL`** → sama, in-app/manual menang, import mengisi celah.

Prioritas kepercayaan: `IN_APP`/`KIOSK` > `MANUAL` > `FINGERPRINT_IMPORT`.
(Bisa dijadikan setting nanti; MVP: hardcoded seperti di atas.)

---

## 6. Cron Baru — `POST/GET /api/jobs/attendance-autoclose`

Auth Bearer `JOBS_SECRET` (pola `src/lib/jobs.ts`). Jadwal: sekali sehari
sesudah `auto_close_at` (mis. `5 0 * * *`).

- Cari `AttendanceRecord` tanggal kemarin dengan `check_in` terisi & `check_out`
  null → set `check_out = work_end` (tanggal record), `check_out_status =
  AUTO_CLOSED`, `owner_note` prefiks "⚠ Lupa absen pulang".
- Istirahat menggantung (`break_start` & `!break_end`) lewat tengah malam →
  `break_end = break_start + break_max_min`, `break_status = EXCEEDED`,
  catatan "⚠ Lupa selesai istirahat".
- Purge `AttendanceSelfie` lebih tua dari `selfie_retention_days`.

`break-warnings` & `dispatch-notifications` — tidak berubah.

---

## 7. Frontend

### Kartu di dashboard pegawai (Operator / Finishing / Designer)

Satu komponen `AbsenCard` yang menggabung absen + istirahat:

```
┌────────────────────────────────────────┐
│  ABSENSI HARI INI                      │
│  Status: Belum absen masuk            │
│  [ 📷  ABSEN MASUK ]                   │   ← minta kamera + lokasi saat ditekan
├────────────────────────────────────────┤
│  Setelah masuk:                        │
│  Masuk: 09:07 ✅  (IN_APP)            │
│  [ 🍽️  MULAI ISTIRAHAT ]              │   ← clock.ts (sudah ada)
│  [ 🏁  ABSEN PULANG ]                 │
└────────────────────────────────────────┘
```

- Ambil GPS: `navigator.geolocation.getCurrentPosition` (tangani izin ditolak →
  pesan jelas, tombol tetap bisa jika `geofence_mode≠ENFORCE`).
- Selfie: `getUserMedia({video})` → capture `<canvas>` → downscale ≤320px →
  `toDataURL("image/webp", 0.7)`. Kalau kamera ditolak & `selfie_required` →
  tombol nonaktif + instruksi.
- Badge peringatan menit ke-45 istirahat (doc lama §37) di kartu yang sama.
- Kartu **tidak** muncul untuk peran yang tak butuh (spec lama §137: designer/
  operator/finishing tetap dapat kartu absen; owner/admin tidak).

### `/kiosk` — halaman tablet (Fase B)

Route lolos middleware bila ada cookie token kiosk valid; kalau tidak → layar
"Aktifkan perangkat ini" (Owner tempel token dari `/owner/attendance-settings`).
Grid nama pegawai → pilih → PIN pad → kamera → Masuk/Pulang → layar sukses 3
detik → kembali ke grid.

### `/owner/attendance-settings` (Owner)

Form semua field §2 + peta kecil untuk set titik geofence (klik peta / "pakai
lokasi saya sekarang") + panel Kiosk (daftar perangkat, buat, cabut).

### `/admin/attendance` (rekap — sudah ada, ditambah)

Kolom **Sumber** (badge IN_APP/KIOSK/IMPORT/MANUAL), ikon 📍 (link
`google.com/maps?q=lat,lng`) bila ada koordinat, thumbnail selfie (klik →
besar), penanda merah untuk `geo_flag`/`ip_flag`/`AUTO_CLOSED`/konflik import.
Admin tetap **lihat-saja**.

### Form Pegawai (`owner/users` UserFormModal)

Tambah input **Nomor HP** (`phone`) + **PIN Kiosk** (opsional, hanya tampil bila
`kiosk_enabled`; tulis via `setEmployeePin`, tak pernah tampilkan PIN lama).

---

## 8. Aturan Immutability (tetap)

Tidak berubah dari doc lama: pegawai **tidak bisa** mengedit/menghapus absensi.
Owner hanya **menambah `owner_note`**. GPS, selfie, jam — semua tercatat otomatis
dan permanen. Selfie hanya dihapus oleh cron retensi, bukan oleh manusia.

Catatan `owner_note` sebaiknya **kumulatif** (append `\n[tgl · Nama]: teks`),
bukan menimpa — sesuai kata "lampiran" di doc lama §63. (Perbaikan kecil pada
`addAttendanceOwnerNote` yang sekarang menimpa.)

---

## 9. Laporan (melengkapi gap yang ada)

- **Owner dashboard**: panel "Terlambat hari ini" (nama + jam masuk, dari
  `getOwnerDashboard`), + item alert "Istirahat berlebih" bila ada record hari
  ini `break_status=EXCEEDED`, + "Lupa absen pulang" (AUTO_CLOSED kemarin).
- **Laporan Bulanan Owner** (`getMonthlyReport`): bagian Absensi — per pegawai
  {hari hadir, hari telat, total menit telat, jumlah istirahat berlebih, jumlah
  AUTO_CLOSED}. + kolom CSV.
- Kedua hal ini sudah jadi gap sebelum fitur ini (lihat catatan review absensi);
  digabung ke sini.

---

## 10. Fase Implementasi

**Fase A — Absen in-app HP pribadi (inti) — SELESAI (2026-09-09, belum di-commit):**
1. ✅ Migrasi `20260909000000_attendance_in_app` (kolom `AttendanceRecord` + `AttendanceSelfie` + `TenantAttendanceSetting` + `KioskDevice` + `User.kiosk_pin_hash`). `registerTenant` bikin 1 baris setting default; backfill untuk tenant lama di migrasi.
2. ✅ `clockIn`/`clockOut` + `getMyAttendanceToday` di `src/actions/clock.ts`; helper murni di `src/lib/attendance.ts` (haversine, IP/CIDR, late/off-day, decode selfie). Selfie disimpan ≤200 KB WebP di `AttendanceSelfie`. Geofence/IP mode OFF/FLAG/ENFORCE. Notifikasi WA telat ke Owner (fire-and-forget; NotificationEvent butuh order+customer jadi tak dipakai).
3. ✅ `src/actions/attendance-settings.ts`: `getAttendanceSettings`/`updateAttendanceSettings` (Owner-only, audit `ATTENDANCE_SETTING_UPDATED`) + `setEmployeePin` (bcrypt 12).
4. ✅ Guard konflik di `commitAttendanceImport` — prioritas IN_APP/KIOSK > MANUAL > FINGERPRINT_IMPORT; fingerprint hanya isi celah pada baris in-app, selisih > 15 mnt → catatan konflik di `owner_note`; re-import menimpa baris FINGERPRINT_IMPORT.
5. ✅ Cron `GET/POST /api/jobs/attendance-autoclose` — tutup lupa-pulang (`AUTO_CLOSED`), tutup istirahat menggantung (`EXCEEDED`), purge selfie > retensi.
6. ✅ Input `Nomor HP` di `UserFormModal` → `createEmployee({phone})`.
7. ✅ `src/components/dashboard/AbsenCard.tsx` (kamera getUserMedia → canvas ≤320px WebP, `navigator.geolocation`, tombol istirahat digabung) di dashboard operator/finishing/designer; halaman `/owner/attendance-settings` + nav Sidebar "Pengaturan Absensi" (owner).
- Verifikasi: migrasi apply bersih; `tsc` + `next build` hijau (45 route); cron 200 (auth) / 401 (tanpa); alur `clockIn→clockIn(gagal)→startBreak→clockOut(gagal saat istirahat)→endBreak→clockOut→clockOut(gagal)` + `getMyAttendanceToday` lewat sesi Owner nyata (route throwaway, sudah dihapus); halaman setting render tanpa error konsol. BELUM diuji lewat kamera/GPS asli di browser (pane headless) dan guard import belum diuji runtime (logika lurus, tsc bersih).

**Fase B — Kiosk:**
8. `KioskDevice` + `assertKioskDevice` + middleware exception `/kiosk`.
9. `kioskClockIn`/`kioskClockOut` + PIN rate-limit + device CRUD.
10. Halaman `/kiosk` + panel kiosk di settings + input PIN di form pegawai.

**Fase C — Laporan & rapihan:**
11. Owner dashboard: panel telat + alert istirahat berlebih + lupa pulang.
12. `getMonthlyReport` bagian absensi + CSV.
13. Rekap `/admin/attendance`: kolom Sumber, peta, selfie, penanda flag.
14. `owner_note` kumulatif.
15. Pindahkan `11-FUTURE/ABSENSI-FINGERPRINT.md` → arsip; jadikan dokumen ini rujukan. Perbarui matriks RBAC + `09-TECHNICAL/` bila menyebut absensi.

---

## 11. Keputusan yang Masih Terbuka

1. **Selfie**: thumbnail di Postgres (rekomendasi, MVP) **atau** berdirikan
   object storage dulu (lebih rapi, tapi proyek terpisah).
2. **Geofence & IP**: mulai di mode `FLAG` (catat, jangan tolak) lalu naik ke
   `ENFORCE` setelah data lokasi kantor terkumpul — atau langsung `ENFORCE`.
3. **Shift per pegawai**: MVP satu jadwal per tenant. Perlu shift per orang/hari
   sekarang, atau Fase C+?
4. **Kiosk auth**: token panjang di cookie perangkat (rekomendasi) vs akun
   "kiosk" khusus per tenant dengan password.
