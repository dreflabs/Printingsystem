# Audit Deployment Tombol ACC Designer

**Tanggal:** 15 September 2026
**Ruang lingkup:** commit Git, branch GitHub, dan konfigurasi branch deployment
**Status:** audit selesai; belum melakukan perubahan konfigurasi deployment.

## Kesimpulan

Perubahan terbaru sudah tersimpan dan sudah dikirim ke GitHub, tetapi dikirim ke
branch **`feat/backend-integration`**. Dokumentasi deployment Print Pilot
menetapkan Coolify membangun branch **`main`**. Karena `main` belum berisi commit
terbaru, website produksi dapat tetap menjalankan build lama dan tidak
menampilkan perilaku yang terlihat pada local server.

## Bukti GitHub

- Branch aktif lokal: `feat/backend-integration`.
- Commit lokal: `0a833e68` — `fix: enforce multi-role staffing safeguards`.
- `origin/feat/backend-integration`: `0a833e68` (sama dengan lokal).
- `origin/main`: `e09a7c37` — commit Owner Dashboard tanggal 25 Agustus 2026.
- `origin/feat/production-routing`: `d2f63c2d`.
- `feat/backend-integration` memiliki banyak commit yang belum ada di `main`,
  termasuk hardening role, production routing, dan perubahan Designer terbaru.
- Working tree bersih untuk kode; satu laporan audit baru masih berupa file
  lokal yang belum menjadi commit.

## Bukti konfigurasi deployment

`frontend/DEPLOY.md` bagian konfigurasi build menetapkan:

- Branch: `main`
- Base Directory: `/frontend`
- Build Command: `npm run build`
- Start Command: `npm run start`

Dokumen yang sama menjelaskan bahwa auto-deploy hanya berjalan pada branch yang
dikonfigurasi di Coolify. Push ke branch lain tidak otomatis mengubah container
produksi.

## Dampak terhadap tombol ACC

Implementasi local terbaru menggunakan `DesignRowActions` dengan kondisi:

```text
ACC = job milik Designer yang login
      + job belum APPROVED
      + metode bukan ONLINE
      + ada versi PENDING
```

Branch `feat/backend-integration` berisi implementasi tersebut. Website yang
masih membangun `main` belum tentu memakai file dan Server Action yang sama.
Selain perbedaan kode, data produksi juga harus memenuhi kondisi `PENDING` dan
PIC Designer yang sama; job `APPROVED` memang tidak menampilkan ACC.

## Akar masalah paling mungkin

**P1 — branch deployment tertinggal.** Kode sudah terkirim ke branch fitur,
tetapi Coolify diarahkan ke `main`. Ini menjelaskan perbedaan local server dan
website tanpa menganggap tombol ACC mengalami kerusakan runtime.

**P2 — tidak ada verifikasi commit pada halaman produksi.** Belum ada indikator
build SHA/version yang menunjukkan commit yang sedang berjalan, sehingga sulit
membedakan cache browser, container lama, dan data job yang sudah approved.

**P2 — database produksi harus diperiksa terpisah.** Walaupun kode terbaru sudah
terdeploy, ACC tetap tidak muncul jika `DesignJob.status = APPROVED`, metode
`ONLINE`, Designer bukan PIC, atau tidak ada versi `PENDING`.

## Rekomendasi deployment

Pilih salah satu strategi berikut:

1. **Direkomendasikan untuk rilis terkontrol:** ubah branch Coolify menjadi
   `feat/backend-integration`, lalu lakukan Redeploy. Pastikan Base Directory
   tetap `/frontend`.
2. **Direkomendasikan untuk rilis production standar:** review dan merge
   `feat/backend-integration` ke `main`, push `main`, lalu Redeploy Coolify.
   Cara ini sesuai runbook saat ini dan menjaga `main` sebagai sumber produksi.

Setelah deploy:

1. Pastikan log build selesai pada `npm run build`.
2. Pastikan `npm run start` menjalankan `prisma migrate deploy` tanpa error.
3. Pastikan health check `/api/health` mengembalikan HTTP 200.
4. Lakukan hard refresh browser atau buka private window.
5. Login sebagai Designer PIC, buka job `WALK_IN` dengan versi `PENDING`, lalu
   pastikan tombol ACC muncul.
6. Uji job `APPROVED` dan `ONLINE` untuk memastikan tombol tetap tersembunyi
   sesuai aturan.

## Putusan audit

Commit sudah berhasil di-commit dan di-push ke GitHub, tetapi **belum dapat
dianggap aktif di website produksi** sebelum branch deployment Coolify diarahkan
ke commit tersebut atau commit tersebut di-merge ke `main` dan dideploy ulang.
Masalah saat ini berada pada sinkronisasi branch/deployment, bukan bukti bahwa
implementasi local gagal.
