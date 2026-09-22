# Laporan Audit Alur Order sampai Operator

**Tanggal audit:** 14 September 2026  
**Ruang lingkup:** order PRINTING yang dibuat Admin dan Designer Sales, desain, approval, pembayaran, completeness gate, auto-release/manual release, routing mesin, dan pengambilan job oleh Operator.  
**Sumber:** `02-WORKFLOW/01-CUSTOMER-DESIGNER.md`, `02-WORKFLOW/02-ORDER.md`, `02-WORKFLOW/03-DESIGN-APPROVAL.md`, `02-WORKFLOW/04-PAYMENT.md`, `02-WORKFLOW/05-PRODUCTION.md`, `02-WORKFLOW/17-AUTO-RELEASE-PRODUKSI.md`, serta implementasi di `frontend/src/actions/orders.ts`, `design.ts`, `production.ts`, `lib/auto-release.ts`, `lib/production-readiness.ts`, dan UI Admin/Designer/Operator.

## Kesimpulan eksekutif

Kerangka alurnya sudah benar: kedua sumber order membuat `DRAFT`, desain dipisahkan dari pembayaran, hanya Admin/Owner yang menerima DP, dan Operator bekerja dari `ProductionJob`. Namun audit end-to-end menemukan **lima risiko P1** yang dapat membuat order berhenti atau masuk produksi dengan kontrol yang tidak lengkap:

1. Order baru dari Designer tidak memiliki input kontak write-only, sehingga completeness gate dapat menahan order sampai Admin memperbaiki data pelanggan.
2. Order Makloon yang DP-nya dibayar sebelum file diunggah dapat berhenti di `WAITING_PAYMENT` walaupun DP sudah terpenuhi.
3. Jalur `assignProductionJob` manual tidak menjalankan seluruh completeness gate dan tidak memverifikasi bahwa target user adalah Operator aktif.
4. Order Makloon multi-item dapat memiliki lebih dari satu file approved pada slot yang sama, lalu beberapa file dikirim ke Operator.
5. Jalur manual assignment menjadi bypass server-side terhadap gate bila action dipanggil langsung, karena UI saja yang memblokir sebagian kondisi.

Secara keseluruhan, desain proses berada di **6,5/10**: separation of duties baik, tetapi konsistensi state dan defense-in-depth pada handoff produksi masih perlu diperkuat.

## Alur target yang seharusnya

### Jalur A — order dibuat Admin

1. Admin mengisi customer, item, ukuran, material, deadline, harga, dan tipe order.
2. Sistem membuat Order `DRAFT`, OrderItem, dan satu DesignJob `PENDING`.
3. Admin dapat menunjuk Designer atau membiarkan job masuk queue untuk di-claim.
4. Designer melakukan claim, upload V1, lalu menjalankan cabang approval Walk-in/Online/Makloon.
5. Admin menerima DP dan sistem mengubah order menjadi `CONFIRMED` bila desain serta DP sudah memenuhi syarat.
6. `autoReleaseToProduction()` menjalankan completeness gate, memeriksa mesin default, lalu membuat ProductionJob `PRODUCTION_QUEUED` atau `PRODUCTION_ASSIGNED`.
7. Operator yang berhak atas mesin mengambil job melalui dashboard/SCAN 1; status job menjadi `PRODUCTION_STARTED`.

### Jalur B — order dibuat Designer Sales

1. Designer membuat order melalui New Order Modal; order dibuat sebagai `DRAFT` dan DesignJob tanpa PIC atau PIC yang diberikan.
2. Designer claim job bila belum memiliki PIC.
3. Designer upload V1 dan membuat V2/V3 bila ada revisi.
4. Walk-in dapat di-ACC Designer dengan bukti; Online harus dikonfirmasi Admin; Makloon auto-approved setelah file tersedia.
5. Designer mengarahkan konsumen ke Admin untuk DP. Designer tidak boleh menerima atau mengonfirmasi pembayaran.
6. Admin menerima DP; sistem menjalankan status transition dan auto-release yang sama seperti Jalur A.
7. Operator hanya melihat ProductionJob yang sudah lolos gate dan mengambil job sesuai machine grant.

## Status transition yang ditemukan

| Tahap | Status yang diharapkan | Implementasi | Hasil audit |
|---|---|---|---|
| Pembuatan order | `DRAFT` | `createPrintingOrder` selalu membuat `DRAFT` | Sesuai |
| Desain dimulai | `DESIGNING` | Upload non-Makloon mengubah `DRAFT` menjadi `DESIGNING` | Sesuai |
| Menunggu pembayaran | `WAITING_PAYMENT` | Design approval penuh mengubah order sesuai DP | Sesuai untuk Walk-in/Online |
| DP terpenuhi | `CONFIRMED` | `addPayment` memeriksa DesignJob approved | Sesuai, kecuali kasus Makloon upload setelah pembayaran |
| Release produksi | Job queued/assigned | Auto-release membuat job per mesin | Sesuai bila gate lolos |
| Operator mulai | `PRODUCTION_STARTED` | Scan/start mengunci klaim atomik | Sesuai |

## Temuan prioritas tinggi

### P1 — Designer tidak dapat mencatat kontak pelanggan baru

`NewOrderModal` menyembunyikan field nomor HP untuk `designer_sales` dan `getOrderFormData()` mengirim `phone: null` untuk role tersebut. Saat customer baru dibuat, `createPrintingOrder()` menyimpan `phone: null`. Sementara `checkProductionReadiness()` sekarang mewajibkan kontak untuk order PRINTING.

**Dampak:** order baru dari Designer dapat berhenti di `CONFIRMED` dengan alasan `Kontak pemesan belum diisi`. Admin harus membuka modul customer dan memperbaiki data secara manual.

**Rekomendasi:** sediakan field kontak write-only untuk Designer: boleh diisi, tidak boleh dibaca kembali setelah disimpan. Tambahkan email atau nomor HP minimal salah satu, lalu mask nilainya pada response/query Designer.

### P1 — Makloon dapat stuck setelah DP dibayar lebih dulu

Jika Admin menerima DP ketika desain Makloon belum diunggah, `addPayment()` menaikkan order ke `DESIGNING` karena DesignJob belum approved. Ketika file Makloon terakhir diunggah, `uploadDesignVersion()` hanya mengubah order ke `WAITING_PAYMENT`; fungsi itu tidak mengecek DP yang sudah ada dan tidak memanggil `autoReleaseToProduction()`.

**Dampak:** order sudah memenuhi DP dan file sudah approved, tetapi tidak pernah menjadi `CONFIRMED` atau masuk antrean Operator tanpa aksi pembayaran tambahan.

**Rekomendasi:** pada upload Makloon yang membuat coverage lengkap, hitung ulang DP dan diskon; bila terpenuhi, ubah ke `CONFIRMED` dan panggil auto-release dalam transaksi yang sama.

### P1 — Manual assignment tidak memiliki defense-in-depth yang cukup

`assignProductionJob()` memeriksa desain approved, diskon, dan DP, tetapi tidak menjalankan `checkProductionReadiness()` penuh. Action juga hanya memastikan target user ada di tenant; tidak memeriksa role `operator`/`extra_roles`, status aktif, atau machine grant.

**Dampak:** pemanggilan server action langsung dapat mengirim order dengan kontak/material/ukuran/deadline yang belum lengkap atau menugaskan job ke akun non-Operator. UI Admin memang menonaktifkan sebagian tombol, tetapi UI bukan batas keamanan.

**Rekomendasi:** validasi readiness dan target Operator aktif di dalam transaksi server. Jika manual assignment memang dimaksudkan sebagai override, wajib minta alasan dan audit log khusus; override tidak boleh melewati syarat keselamatan produksi seperti file approved, item, dan DP.

### P1 — Slot Makloon dapat memiliki beberapa file approved

Untuk order Makloon multi-item yang belum lengkap, DesignJob masih `DESIGNING`. Upload pada slot item yang sudah memiliki file approved tetap diterima dan otomatis diberi status `APPROVED`. `getOperatorJobs()` mengambil semua versi approved, bukan hanya versi terbaru per slot.

**Dampak:** Operator dapat melihat beberapa file cetak untuk item yang sama dan berisiko memakai file lama.

**Rekomendasi:** kunci slot approved sampai ada revision request resmi, tandai file lama `SUPERSEDED`, dan query Operator hanya mengembalikan versi approved terbaru per slot.

### P1 — Jalur manual dan auto-release memiliki dua aturan handoff

Auto-release menjalankan gate lengkap, memeriksa mesin default ACTIVE, menggabungkan item per mesin, dan memilih default operator. Manual assignment menerima assignment bebas dari Admin dan hanya menjalankan pemeriksaan parsial.

**Dampak:** dua order dengan data sama dapat menerima hasil berbeda bergantung tombol yang dipakai. Ini menyulitkan audit dan membuka peluang proses berbeda antara Admin yang memakai auto-release dan Admin yang memakai assign manual.

**Rekomendasi:** satukan fungsi validasi handoff. Bedakan hanya routing (otomatis vs override), bukan syarat kesiapan produksi.

## Hal yang sudah baik

- Kedua jalur order tercatat sebagai `DRAFT` dan memiliki DesignJob.
- Designer tidak memiliki permission menerima pembayaran.
- Approval Online dibatasi Admin/Owner dan approval Walk-in memerlukan bukti.
- Upload dan claim job Designer memverifikasi tenant, PIC, serta fase order.
- Allocator versi memakai row lock.
- Auto-release idempotent dan membuat job berdasarkan mesin default.
- Klaim job Operator untuk antrean menggunakan conditional update atomik.
- Operator harus memiliki machine grant untuk mengambil job antrean.
- File desain approved disajikan melalui route tenant-scoped.

## Skenario uji wajib

1. Admin membuat Walk-in, desain disetujui, DP dibayar sebelum dan sesudah approval.
2. Admin membuat Online, Designer upload V1, Admin approve, lalu jalur revisi ke V2.
3. Admin membuat Makloon, DP dibayar lebih dulu, lalu file terakhir diunggah; pastikan order otomatis `CONFIRMED` dan job tercipta.
4. Designer membuat customer baru dengan kontak write-only; pastikan gate tidak menahan order.
5. Makloon multi-item mengunggah ulang item yang sudah approved; pastikan server menolak atau menandai versi lama superseded.
6. Pemanggilan langsung `assignProductionJob` dengan user non-Operator, mesin nonaktif, material kosong, dan deadline kosong; semua harus ditolak.
7. Dua Operator melakukan SCAN 1 pada job yang sama; hanya satu yang berhasil.
8. Auto-release dan Admin release dipanggil bersamaan; tidak boleh membuat ProductionJob ganda.

## Rekomendasi urutan perbaikan

1. Perbaiki transisi Makloon setelah pembayaran dan satukan validasi manual/auto-release.
2. Tambahkan kontak write-only Designer.
3. Kunci slot approved dan filter versi terbaru di Operator.
4. Validasi role/status Operator pada server assignment.
5. Tambahkan integration test untuk seluruh kombinasi urutan approval dan pembayaran.

## Kesimpulan

Pada kondisi sebelum perbaikan, alur dasar Admin → Designer → Admin → Operator sudah terbentuk, tetapi belum aman bila urutan tindakan berubah. Tiga risiko utama adalah Makloon dengan pembayaran lebih dulu, kontak customer baru dari Designer, dan manual assignment yang hanya dilindungi UI. Perbaikan yang diterapkan membuat workflow lebih deterministik; pengujian integrasi database tetap menjadi langkah verifikasi berikutnya.

## Status implementasi setelah persetujuan rekomendasi

Perbaikan yang disepakati sudah diterapkan:

- Designer kini dapat mengisi kontak pemesan melalui field write-only; kontak tidak dikirim kembali dari daftar customer.
- Upload Makloon yang melengkapi seluruh item menghitung ulang DP dan memanggil auto-release bila pembayaran sudah memenuhi syarat.
- `assignProductionJob()` kini mewajibkan order `CONFIRMED`, menjalankan completeness gate, dan hanya menerima Operator aktif dengan role Operator.
- Slot desain yang sudah approved tidak dapat diunggah ulang tanpa revisi resmi.
- Query Operator hanya menampilkan versi approved terbaru per slot.
- `autoReleaseToProduction()` mengunci row Order sehingga jalur pembayaran, approval, dan release Admin tidak membuat ProductionJob ganda secara paralel.

Validasi setelah perubahan: TypeScript, ESLint file terkait, `git diff --check`, dan `prisma validate` berhasil. Pengujian integrasi dengan database nyata tetap perlu dijalankan ketika PostgreSQL tersedia.
