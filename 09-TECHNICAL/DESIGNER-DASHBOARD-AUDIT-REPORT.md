# Laporan Audit Dashboard Designer Sales

**Tanggal audit:** 14 September 2026  
**Sumber:** Screenshot dashboard Designer Sales, source code frontend/server action, dan dokumen `03-ROLES/`, `08-UI-UX/`, `02-WORKFLOW/`  
**Ruang lingkup:** visual UI, keterbacaan, alur kerja desain, kesesuaian dokumentasi, RBAC, keamanan tenant, versi desain, approval, revisi, dan responsivitas.

## Penilaian

Dashboard ini sudah cukup layak untuk operasi dasar dengan skor **7,0/10**. Shell aplikasi, warna, kartu absensi, status desain, dan antrian order mudah dipahami pada desktop. Namun, dashboard belum dapat disebut final-profesional karena ada tiga kelompok risiko:

- **P1 keamanan/otorisasi:** beberapa server action menerima order tenant tanpa memastikan Designer adalah PIC job tersebut; `getDesignQueue` juga belum membatasi role di sisi server.
- **P1 ketepatan alur:** metrik “Sudah Disetujui” mengambil data tujuh hari terakhir, bukan “hari ini”, dan penomoran versi pertama berpotensi dimulai dari V2.
- **P2 kelengkapan kerja:** filter, riwayat versi, preview, catatan teknis untuk operator, dan penandaan deadline belum selengkap dokumen.

Tidak ada indikasi dashboard gagal dirender atau data finansial tampil pada screenshot. Temuan P1 di bawah tetap perlu ditangani sebelum akses Designer dianggap aman untuk banyak pegawai dalam satu tenant.

## Yang sudah baik

- **Shell konsisten.** Sidebar aktif, badge `Designer Sales`, header akun, dan area kerja memakai pola light theme yang sama dengan dashboard lain.
- **Hierarki halaman jelas.** Urutan absensi → KPI → antrian kerja sesuai prioritas harian designer.
- **CTA absensi kuat.** Tombol `Absen Masuk` memenuhi lebar kartu, kontras tinggi, dan disertai penjelasan bahwa lokasi/selfie serta waktu server dipakai.
- **Kartu KPI mudah dipindai.** Angka besar, ikon, dan warna biru/amber/hijau membedakan kondisi desain.
- **Antrian menggunakan konteks minimum yang tepat.** Kode order, konsumen, PIC, metode, status desain, versi, deadline, dan aksi tersedia tanpa menampilkan harga, saldo, nomor HP, atau email.
- **Aksi sudah mengikuti ownership secara visual.** Job belum diambil menampilkan `Ambil Tugas`; job milik designer menampilkan `Upload`/`ACC`; job milik orang lain hanya menampilkan `Detail`.
- **Mode mobile sudah tersedia.** Tabel desktop memiliki alternatif kartu pada breakpoint `md`.
- **Upload memiliki guardrail dasar.** Ekstensi dan batas 200 MB divalidasi di client dan server, upload langsung ke storage memakai presigned URL, serta ada progress upload.
- **Tenant isolation sudah diterapkan pada query utama.** Query order/design job dan object key upload menggunakan `tenant_id`/namespace tenant.

## Temuan prioritas tinggi

### P1 — Server action upload/revisi tidak memverifikasi PIC Designer

`createDesignUploadUrl`, `uploadDesignVersion`, dan `requestDesignRevision` hanya memeriksa bahwa actor memiliki role Designer/Admin/Owner dan order berada di tenant yang sama. Tidak ada pemeriksaan bahwa Designer adalah `designJob.designer_id` atau bahwa job masih belum diambil. Pemeriksaan ownership saat ini hanya ada di UI melalui `canUpload`, `canRevisi`, dan `isOwnedByMe` (`frontend/src/app/(dashboard)/designer/page.tsx:99-105`).

**Dampak:** Designer yang memanggil server action secara langsung dapat mengunggah versi, meminta revisi, atau mengubah alur desain pada job yang sedang ditangani Designer lain. Ini berisiko menimpa pekerjaan, membuat audit trail membingungkan, dan menimbulkan konflik antarpegawai.

**Rekomendasi:**

1. Di dalam transaction, ambil `designJob` berdasarkan `tenant_id` dan order.
2. Untuk role `designer_sales`, wajibkan `designer_id === actor.id`; pengecualian hanya untuk job yang belum diambil jika action yang dipanggil adalah claim.
3. Gunakan `can(actor, "design.upload")`, `can(actor, "design.request_revision")`, dan permission approval sebagai sumber RBAC tunggal.
4. Tambahkan test negatif: Designer A tidak boleh upload/revisi job milik Designer B, meskipun order ID valid.

### P1 — `getDesignQueue` belum memiliki guard role di server

`getDesignQueue()` memanggil `requireTenant()` dan `requireUser()`, tetapi tidak memeriksa role (`frontend/src/actions/queries.ts:269-309`). Middleware membatasi halaman `/designer`, tetapi server action tetap seharusnya menolak actor Operator/Gudang bila dipanggil di luar navigasi normal.

**Dampak:** kontrol akses bergantung pada route UI, bukan pada boundary data. Ini bertentangan dengan prinsip bahwa setiap server action harus aman bila dipanggil langsung.

**Rekomendasi:** tolak actor yang tidak memiliki `design.upload`/`design.approve_walkin` atau gunakan permission read khusus seperti `design.view_queue`. Kembalikan hanya data yang diperlukan untuk role tersebut.

### P1 — Kartu “Sudah Disetujui” tidak berarti disetujui hari ini

Dokumen Designer mendefinisikan metrik **Disetujui Hari Ini**, tetapi query mengambil semua DesignJob `APPROVED` yang `updated_at`-nya masih dalam tujuh hari terakhir (`frontend/src/actions/queries.ts:274-283`). Screenshot bertanggal 14 September masih menghitung order berdeadline 11 September sebagai `Sudah Disetujui`.

**Dampak:** designer dan supervisor dapat mengira ada approval baru hari ini padahal angka mencakup pekerjaan lama. KPI tidak dapat dipakai untuk mengukur throughput atau SLA harian.

**Rekomendasi:** hitung dari `approved_at` versi yang disetujui pada rentang awal/akhir hari zona waktu tenant. Bila ingin menampilkan pekerjaan tujuh hari terakhir, beri label terpisah seperti `Disetujui 7 Hari`.

### P1 — Penomoran versi pertama berpotensi dimulai dari V2

`DesignJob.current_version` memiliki default `1` (`frontend/prisma/schema.prisma:578-589`), sedangkan `createDesignUploadUrl` membentuk nama object dengan `current_version + 1` (`frontend/src/actions/design.ts:128-136`). Upload record sendiri menghitung `version_no` mulai dari 1 per slot (`frontend/src/actions/design.ts:190-205`).

**Dampak:** nama object storage dapat menyebut V2 ketika record adalah V1. Pada multi-item, nomor object dan nomor versi per item makin mudah berbeda. Designer dan Operator dapat salah memahami urutan file atau mengunduh file yang dianggap versi terbaru.

**Rekomendasi:** pilih satu sumber nomor versi. Pilihan aman: default `current_version = 0`, alokasikan nomor atomik di transaction, lalu gunakan nomor yang sama untuk record dan object key. Tambahkan unique constraint per `(design_job_id, order_item_id, version_no)` serta test upload paralel.

**Status:** nomor versi resmi sekarang dialokasikan pada record `DesignVersion`; object key memakai folder slot dan UUID acak agar upload paralel tidak menghasilkan label versi storage yang menyesatkan. Default baru menjadi `0`; tampilan tidak lagi menyebut `V1` pada job yang belum memiliki file; dan modal menjelaskan bahwa nomor versi otomatis mengikuti item.

## Temuan kesesuaian dokumen dan alur kerja

### P1 — Widget ringkasan tidak sesuai dokumen Designer

Dokumen `08-UI-UX/DESIGNER-DASHBOARD.md` menyebut empat widget: Job Desain Aktif, Menunggu Approval, Menunggu Revisi, dan Disetujui Hari Ini. Implementasi hanya menampilkan tiga: `Belum Ada Versi`, `Sedang Dikerjakan`, dan `Sudah Disetujui` (`designer/page.tsx:462-465`).

**Dampak:** pekerjaan yang menunggu ACC atau perlu revisi tidak memiliki hitungan terpisah. Status yang paling membutuhkan tindakan dapat tersembunyi di dalam angka `Sedang Dikerjakan`.

**Rekomendasi:** tetapkan definisi metrik dengan product owner, lalu tampilkan minimal:

- **Perlu Diambil / Belum Ada Versi**
- **Sedang Dikerjakan**
- **Menunggu ACC**
- **Perlu Revisi**
- **Disetujui Hari Ini**

Jika lima kartu terlalu padat, gunakan empat kartu inti dan satu filter cepat di header.

### P2 — Filter antrian belum sesuai dokumen

Dokumen menjanjikan filter status, tipe order, rentang tanggal order, kode order, dan rentang deadline. Implementasi hanya memiliki pencarian kode/konsumen dan filter status tidak langsung melalui klik KPI (`designer/page.tsx:437-473, 537-545`).

**Dampak:** pada tenant dengan banyak job, Designer sulit memprioritaskan Walk-in/Online/Makloon atau pekerjaan dengan deadline paling dekat.

**Rekomendasi:** tambahkan filter `Metode`, `Deadline`, dan `Status`; tampilkan chip filter aktif dan tombol reset. Default-kan urutan ke deadline terdekat, lalu updated time.

### P2 — Detail belum menyediakan riwayat versi lengkap

Dokumen meminta daftar V1, V2, V3 dengan preview, uploader, timestamp, dan status approval per versi. `DesignDetailModal` hanya menampilkan brief, spesifikasi, file desain efektif, dan alasan penolakan (`designer/page.tsx:352-425`). Data `getDesignQueue` juga hanya mengirim versi terbaru untuk list (`queries.ts:304-360`).

**Dampak:** Designer tidak dapat membandingkan perubahan, mengetahui siapa pengunggah versi, atau menelusuri kapan approval/revisi terjadi dari dashboard kerja.

**Rekomendasi:** sediakan endpoint/detail query khusus yang mengembalikan riwayat versi terurut, preview aman, uploader, timestamp, status, catatan, dan alasan revisi. Jangan gunakan URL storage mentah; tetap melalui route `/api/design/[versionId]` dengan pemeriksaan tenant dan hak akses.

### P2 — Catatan teknis untuk Operator belum mengalir ke dashboard produksi

Upload modal menyimpan input sebagai `approval_notes` (`designer/page.tsx:290-294`, `design.ts:200-216`) dan melabelinya `Catatan Revisi / Perubahan`. Query Operator hanya memilih `id`, `order_item_id`, `file_name`, dan `file_path` untuk versi approved (`queries.ts:71-79`), sehingga catatan tersebut tidak muncul di job produksi.

**Dampak:** informasi seperti profil warna, mesin target, bleed, atau instruksi finishing dapat hilang saat pekerjaan berpindah dari Designer ke Operator.

**Rekomendasi:** pisahkan `catatan revisi` dan `catatan teknis produksi`; kirim catatan teknis yang sudah approved ke kartu job Operator, dan simpan perubahan sebagai audit log versi.

### P2 — Status UI bercampur antara istilah teknis dan bahasa operasional

Screenshot menampilkan `PENDING`, `APPROVED`, dan `WALK_IN`, sementara KPI memakai bahasa Indonesia. Ini membuat status yang sama memiliki dua kosakata. `StatusPill` juga tidak menampilkan konteks seperti `Menunggu ACC Admin` sebagai status utama.

**Rekomendasi:** tampilkan label pengguna seperti `Belum Ada Versi`, `Menunggu ACC`, `Disetujui`, `Walk-in`, dan simpan kode teknis hanya di detail/audit. Untuk ONLINE, tampilkan badge `Menunggu ACC Admin` dekat status.

### P2 — Deadline belum menunjukkan urgensi

Kolom deadline hanya menampilkan `15 Sep`/`11 Sep` (`designer/page.tsx:81-82, 695`). Tidak ada tahun, jam, indikator terlambat, atau warna urgensi seperti pada dashboard Admin.

**Dampak:** antrian desain tidak otomatis mengarahkan perhatian ke job yang hampir jatuh tempo atau sudah terlambat.

**Rekomendasi:** gunakan formatter bersama: `Hari ini`, `Besok`, `Terlambat N hari`, lalu beri warna amber/merah sesuai sisa waktu. Tampilkan tanggal lengkap pada detail.

## Audit visual dan UX screenshot

### Kekuatan visual

- Palet teal pada CTA dan ikon memberi identitas merek yang jelas.
- Surface putih, border tipis, dan shadow-card terasa lebih profesional daripada gaya glassmorphism lama.
- Tiga KPI memiliki lebar seimbang dan angka menjadi fokus yang tepat.
- Tabel memiliki header berkontras baik serta status pill yang mudah dibedakan.
- Tombol `Ambil Tugas`, `Upload`, dan `Detail` menggunakan progressive disclosure sehingga kolom aksi tidak terlalu penuh.

### Polesan yang disarankan

- Screenshot berada pada posisi scroll yang membuat judul halaman dan sebagian CTA tampak tertutup header. Pastikan posisi awal route selalu menampilkan `Dashboard Designer Sales` dan `Buat Order Baru`; uji refresh, back navigation, dan anchor restoration.
- CTA `Buat Order Baru` dan tombol submit upload masih memakai gradient (`designer/page.tsx:498-500, 309-314`), sedangkan sistem visual yang sudah dinormalisasi memakai solid teal. Samakan dengan Button primary global.
- Ukuran aksi tabel sekitar 32–36px secara visual. Pertahankan target sentuh minimal 44px pada mobile, khususnya `Detail`, menu tiga titik, dan `Upload`.
- Baris konsumen/produk memakai truncation. Pastikan tooltip atau detail selalu mudah dibuka agar ukuran/material/jumlah tidak hilang dari konteks kerja.
- Tabel memiliki overflow horizontal pada tablet. Pertahankan kolom `Aksi` tetap terlihat atau sediakan kartu pada breakpoint yang lebih lebar dari `md` bila perangkat kerja utama memakai tablet.
- Empty state saat pencarian sudah ada, tetapi perlu state khusus ketika queue gagal dimuat, sedang refresh, atau tidak ada job sama sekali.
- Gunakan ikon Lucide dan label teks secara konsisten; simbol `⚠` pada alasan penolakan sebaiknya diganti ikon dengan label aksesibel.

## Audit keamanan data desain

**Sudah benar:** query utama menyertakan `tenant_id`, kontak konsumen tidak dipilih oleh `getDesignQueue`, file upload memakai namespace tenant, ekstensi/ukuran divalidasi, dan approval ONLINE dibatasi Admin/Owner di server (`design.ts:287-290`).

**Yang perlu diperketat:** ownership job harus diperiksa pada setiap mutasi; `getDesignQueue` harus memiliki role guard; route file `/api/design/[versionId]` harus memastikan actor boleh melihat versi job tersebut, bukan hanya tenant; link preview tidak boleh membocorkan object key atau URL storage yang dapat dipakai lintas tenant.

## Urutan perbaikan

### Gelombang 1 — keamanan dan ketepatan data

1. Tambahkan ownership/RBAC server-side pada upload, revisi, claim, approval, dan query queue.
2. Perbaiki sumber nomor versi agar V1 benar-benar versi pertama dan aman terhadap upload paralel.
3. Ubah KPI approval menjadi rentang hari tenant yang benar.
4. Tambahkan test otorisasi lintas Designer dan test isolasi tenant untuk file desain.

### Gelombang 2 — kelengkapan operasi Designer

1. Tambahkan KPI Menunggu ACC dan Perlu Revisi.
2. Tambahkan filter metode/status/deadline dan urutan deadline.
3. Bangun panel riwayat versi lengkap dengan preview, uploader, timestamp, catatan, dan status.
4. Pisahkan serta teruskan catatan teknis ke Operator.

### Gelombang 3 — polish visual dan verifikasi

1. Samakan CTA gradient menjadi solid teal dan konsolidasikan label status ke bahasa operasional.
2. Tambahkan deadline urgency, tooltip untuk teks terpotong, dan target sentuh 44px.
3. Uji screenshot regression pada 360, 768, 1024, dan 1440px; uji juga queue kosong, error, job multi-item, file besar, revisi, dan ONLINE.

## Status implementasi koreksi versi

Koreksi versi yang disetujui sudah diterapkan:

- Upload URL menerima `orderItemId`, sehingga organisasi object storage mengikuti slot item atau seluruh order.
- Object key memakai UUID acak; nomor V1/V2/V3 resmi hanya berasal dari `DesignVersion`, sehingga tidak ada lagi label storage yang berbeda dari nomor record.
- Allocator `version_no` dikunci pada baris `DesignJob` selama transaction agar dua upload paralel tidak membaca nomor terakhir yang sama.
- `current_version` untuk DesignJob baru diubah menjadi default `0`; job pertama yang memiliki file akan menjadi V1.
- List Designer tidak lagi menampilkan `V1` pada job yang belum memiliki file, dan modal menjelaskan bahwa nomor versi ditentukan otomatis.

`npx tsc --noEmit`, `prisma validate`, dan `git diff --check` berhasil. Migration sudah dibuat di `frontend/prisma/migrations/20260914220000_fix_design_version_default/`, tetapi belum dapat diterapkan ke database lokal karena PostgreSQL `localhost:5432` sedang tidak merespons. Jalankan `npx prisma migrate deploy` setelah database aktif.

## Kesimpulan

Dashboard Designer Sales sudah memiliki fondasi visual yang baik dan alur dasar upload/claim/ACC yang dapat dipahami. Risiko terpenting berada pada boundary server action dan ketepatan data versi/KPI. Setelah tiga P1 tersebut diperbaiki, dashboard dapat dilanjutkan ke penyempurnaan filter, riwayat versi, catatan teknis, dan polish responsif agar benar-benar siap digunakan oleh tim Designer yang jumlahnya berubah-ubah per tenant.
