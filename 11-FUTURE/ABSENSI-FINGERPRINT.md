> [!IMPORTANT]
> **Dokumen ini digantikan.** Spesifikasi absensi yang berlaku ada di
> [`02-WORKFLOW/18-ABSENSI-IN-APP.md`](../02-WORKFLOW/18-ABSENSI-IN-APP.md).

# ABSENSI — Arsip

Dokumen lama ini merancang model **hybrid mesin fingerprint + import CSV**, dengan
jam masuk/pulang selalu berasal dari mesin fingerprint fisik dan Print Pilot hanya
mencatat istirahat.

Sejak 2026-09-09 fitur absensi dinaikkan menjadi **absen langsung di aplikasi
sebagai cara utama** (HP pribadi + perangkat kiosk, dengan GPS + selfie),
sementara import CSV fingerprint tetap ada sebagai jalur cadangan / rekonsiliasi.
Semua aturan (batas telat, immutability, peringatan istirahat 45/60 menit, dst.)
dipindahkan dan diperluas di dokumen baru.

Lihat `02-WORKFLOW/18-ABSENSI-IN-APP.md` untuk: model hybrid baru, pengaturan
absensi per tenant (Owner), skema DB, server action `clockIn`/`clockOut`,
guard konflik import, cron `attendance-autoclose`, dan alur kiosk.
