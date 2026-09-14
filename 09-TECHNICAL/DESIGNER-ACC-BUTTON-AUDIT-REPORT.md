# Audit Tombol ACC pada Dashboard Designer

**Tanggal:** 15 September 2026
**Ruang lingkup:** tampilan Dashboard Designer Sales, `getDesignQueue()`, dan Server Action `approveDesign()`
**Status:** audit selesai; tidak ada perubahan kode pada audit ini.

## Kesimpulan

Tombol **ACC** tidak hilang secara acak. Tombol memang sengaja disembunyikan
setelah `DesignJob.status` menjadi `APPROVED`. Pada tampilan yang sedang dibuka,
empat job desain terbaca **Disetujui** (V1, V5, V3, dan V1), sehingga masing-masing
hanya menampilkan **Detail** dan menu aksi lain. Perilaku ini benar untuk mencegah
approval yang sama dikirim berulang kali.

Jika file baru saja diunggah dan versinya masih `PENDING`, tombol ACC seharusnya
muncul hanya untuk Designer yang menjadi PIC job, dan hanya untuk metode
`WALK_IN` atau `MAKLOON`. Untuk metode `ONLINE`, tombol tetap tidak muncul karena
approval harus dilakukan Admin/Owner.

## Bukti tampilan saat audit

Accessibility tree Dashboard Designer yang sedang terbuka menunjukkan:

- KPI: `0 Belum Ada Versi`, `0 Sedang Dikerjakan`, `4 Sudah Disetujui`.
- `ORD-20260915-0001`: `Disetujui V1`, aksi `Detail`.
- `ORD-20260914-0002`: `Disetujui V5`, aksi `Detail`.
- `ORD-20260914-0001`: `Disetujui V3`, aksi `Detail`.
- `ORD-20260910-0001`: `Disetujui V1`, aksi `Detail`.

Dengan data tersebut tidak ada kandidat approval yang menunggu keputusan. Jadi
ketiadaan tombol ACC pada layar ini konsisten dengan status data.

## Aturan UI yang menentukan tombol

Komponen `DesignRowActions` menggunakan aturan berikut:

1. `done = r.status === "APPROVED"`. Jika benar, tombol utama hanya **Detail**.
2. `owned = r.isOwnedByMe`. Job milik Designer lain hanya menampilkan **Detail**.
3. `hasApprovalCandidate` harus benar: versi terbaru atau salah satu item harus
   berstatus `PENDING`.
4. `r.method !== "ONLINE"`. Approval Online tidak dilakukan Designer.
5. Jika seluruh kondisi terpenuhi, tombol utama **ACC** ditampilkan.

Secara ringkas:

```text
ACC = PIC saya
      DAN DesignJob belum APPROVED
      DAN metode bukan ONLINE
      DAN ada versi PENDING
```

## Aturan server

`approveDesign()` mengulangi kontrol tersebut di server:

- Designer harus memiliki role desain dan menjadi PIC job; Admin/Owner dapat
  menjadi pengecualian operasional.
- Metode `ONLINE` hanya boleh disetujui Admin/Owner.
- Catatan bukti approval wajib diisi minimal lima karakter untuk metode selain
  MAKLOON.
- Hanya versi terbaru per slot yang belum approved yang diproses.
- `DesignJob` baru menjadi `APPROVED` setelah semua item non-retail memiliki file
  approved.
- Setelah approval lengkap, tombol ACC hilang pada refresh berikutnya.

## Mengapa sebelumnya muncul lalu hilang

- Setelah upload WALK_IN, versi dibuat `PENDING` dan job tetap `DESIGNING`; tombol
  ACC muncul untuk PIC Designer.
- Setelah **Simpan ACC** berhasil, versi berubah `APPROVED` dan, bila seluruh item
  lengkap, job berubah `APPROVED`; tombol ACC lalu diganti Detail.
- Untuk MAKLOON, upload langsung membuat versi `APPROVED`, sehingga tombol ACC
  memang tidak pernah diperlukan.
- Untuk ONLINE, tombol ACC tidak disediakan di Dashboard Designer; Admin/Owner
  harus melakukan approval.
- Jika job diambil Designer lain atau sesi login memakai akun berbeda, kondisi
  `isOwnedByMe` menjadi false dan tombol ACC tidak muncul.

## Penilaian audit

**Severity:** P2 — kejelasan UX, bukan kegagalan kontrol keamanan.
**Kesesuaian workflow:** benar. Approval harus idempotent dan tidak boleh dapat
dikirim lagi pada desain yang sudah approved.

Ada satu keterbatasan verifikasi: query Prisma langsung dari shell gagal dengan
`P1001` karena PostgreSQL `localhost:5432` tidak dapat dijangkau pada saat audit.
Data yang tampil di Dashboard berhasil dibaca, sehingga status job dapat
diverifikasi dari sisi aplikasi, tetapi pemetaan id user/PIC di database belum
dapat dikonfirmasi langsung.

## Rekomendasi UX

1. Pertahankan tombol ACC tersembunyi setelah approved.
2. Ganti label status `Disetujui` menjadi `ACC tersimpan` atau tambahkan tooltip
   **“ACC sudah dicatat — gunakan Minta revisi bila konsumen mengubah spesifikasi.”**
3. Tampilkan alasan nonaktif di menu/detail: `Menunggu ACC Admin`, `Bukan PIC`,
   `Tidak ada versi pending`, atau `Desain sudah approved`.
4. Untuk order yang masih sebelum produksi, tampilkan **Minta revisi** sebagai
   aksi yang terlihat, bukan hanya mengandalkan menu tiga titik.
5. Tambahkan acceptance test untuk enam kondisi: WALK_IN pending, ONLINE pending,
   MAKLOON, approved, bukan PIC, dan multi-item sebagian pending.

## Putusan

Pada layar yang diaudit, tombol ACC hilang karena semua job sudah approved. Ini
adalah hasil workflow yang diharapkan, bukan regresi. Bug baru perlu dibuka hanya
jika baris masih `DESIGNING`, versi terbaru `PENDING`, metode `WALK_IN/MAKLOON`,
dan Designer yang login adalah PIC tetapi tombol ACC tetap tidak muncul.
