# Laporan Audit Handoff Designer ke Operator Cetak

**Tanggal audit:** 15 September 2026  
**Ruang lingkup:** setelah Designer menyelesaikan/upload desain sampai file dan ProductionJob diterima Operator; mencakup approval, completeness gate, auto-release, manual assignment, routing mesin, queue, file cetak, claim, SCAN 1, dan pengembalian file bermasalah.  
**Sumber:** `02-WORKFLOW/03-DESIGN-APPROVAL.md`, `02-WORKFLOW/05-PRODUCTION.md`, `02-WORKFLOW/17-AUTO-RELEASE-PRODUKSI.md`, `03-ROLES/OPERATOR.md`, `frontend/src/actions/design.ts`, `frontend/src/lib/auto-release.ts`, `frontend/src/actions/queries.ts`, `frontend/src/actions/production.ts`, dan dashboard Designer/Operator/Admin.

## Kesimpulan

Alur handoff utama sudah mengikuti prinsip yang benar:

`Desain approved → DP terpenuhi → completeness gate → routing mesin → ProductionJob → queue Operator → claim/SCAN 1`.

Versi terbaru sudah menutup beberapa celah sebelumnya: slot approved tidak dapat di-upload ulang tanpa revisi, Online menunggu approval Admin, Operator menerima versi approved terbaru per slot, assignment manual memeriksa readiness dan Operator aktif, serta auto-release dikunci dari race condition.

Namun masih ada **dua risiko P1** dan **tiga risiko P2** yang perlu diselesaikan sebelum handoff dianggap matang:

- Queue Operator belum memiliki role guard server-side.
- Pengembalian file bermasalah pada order multi-item dapat menolak hanya satu versi desain.
- Catatan yang diteruskan ke Operator masih bercampur antara evidence approval dan instruksi teknis.
- Dokumentasi menyebut satu ProductionJob per item, sedangkan implementasi menggabungkan item per mesin.
- Jalur Admin/Owner yang dapat memulai produksi belum dijelaskan konsisten dalam dokumen role Operator.

## Alur aktual

### 1. Designer menyelesaikan desain

- Walk-in: Designer dapat melakukan approval dengan bukti nama konsumen dan catatan.
- Online: Designer mengunggah preview; Admin melakukan approval.
- Makloon: file konsumen otomatis approved setelah coverage item lengkap.
- File disimpan tenant-scoped dan versioned per slot order atau item.

### 2. Sistem mengevaluasi kesiapan

`autoReleaseToProduction()` hanya bekerja ketika order `CONFIRMED`. Gate memeriksa:

- DP terpenuhi.
- DesignJob approved.
- File approved mencakup seluruh item non-retail.
- Diskon tidak menggantung.
- Customer memiliki nama dan kontak.
- Deadline terisi.
- Item memiliki produk/deskripsi, jumlah, material, harga, dan ukuran bila diperlukan.
- Produk memiliki mesin default untuk auto-routing.

### 3. Sistem membuat ProductionJob

- Item dengan mesin default yang sama digabung menjadi satu job per mesin.
- Mesin harus `ACTIVE`.
- Default operator yang aktif akan dipin ke job dengan status `PRODUCTION_ASSIGNED`.
- Tanpa default operator, job dibuat `PRODUCTION_QUEUED` dan `operator_id` kosong.
- Order berubah ke `PRODUCTION_ASSIGNED` setelah job dibuat.

### 4. Operator menerima dan memulai job

- Dashboard Operator menampilkan job miliknya dan queue mesin yang diberi akses melalui `UserMachine`.
- Job queued dapat diambil melalui tombol mulai atau SCAN 1.
- Claim queued menggunakan conditional update atomik.
- Operator yang tidak memiliki machine grant ditolak.
- Job assigned hanya dapat dimulai oleh operator yang dipin.
- Saat mulai, job menjadi `PRODUCTION_STARTED` dan order ikut maju dari `CONFIRMED`/`PRODUCTION_ASSIGNED`.

## Kontrol yang sudah baik

- Tidak ada ProductionJob sebelum desain approved, DP, dan readiness terpenuhi pada jalur otomatis.
- Assignment manual sekarang mewajibkan order `CONFIRMED`, completeness gate lulus, mesin valid/aktif, dan Operator aktif.
- Operator hanya menerima file approved terbaru per slot.
- File desain lama tidak dapat diganti langsung ketika slot sudah approved.
- Auto-release memakai lock row Order untuk mencegah pembayaran, approval, dan release paralel membuat job ganda.
- Queue hanya mengembalikan job pada mesin yang terdaftar untuk Operator.
- Claim Operator atomic sehingga dua Operator tidak dapat memenangkan job yang sama.
- Operator tidak menerima akses nomor HP/email konsumen.
- File bermasalah sebelum produksi dapat dikembalikan ke Designer melalui jalur bounce.

## Temuan prioritas tinggi

### P1 — `getOperatorJobs()` belum memeriksa role Operator

`getOperatorJobs()` memanggil `requireTenant()` dan `requireUser()`, lalu langsung membaca job berdasarkan user dan machine grant. Tidak ada pemeriksaan `can(actor, "production.execute")` atau role Operator di dalam action.

Middleware halaman memang membatasi akses normal, tetapi pemanggilan server action langsung oleh Designer atau role lain tetap dapat mengembalikan data job jika user tersebut memiliki machine grant.

**Dampak:** batas akses queue hanya bergantung pada routing UI, bukan authorization server-side yang lengkap.

**Rekomendasi:** tambahkan role/permission guard di awal `getOperatorJobs()`. Gunakan permission `production.execute` atau permission read khusus Operator; Admin/Owner hanya boleh melihat queue melalui query Admin yang memang ditujukan untuk mereka.

### P1 — Bounce multi-item dapat menolak satu versi saja

`bounceDesignFromProduction()` menghapus seluruh ProductionJob pra-mulai, tetapi mencari satu `DesignVersion` menggunakan `version_no === design.current_version` lalu menandainya `REJECTED`. Pada order multi-item, beberapa slot dapat memiliki nomor versi yang sama, misalnya item A V1 dan item B V1. Hanya satu record yang akan ditemukan.

**Dampak:** sebagian file tetap `APPROVED` walaupun seluruh order dikembalikan ke Designer. Setelah reupload, coverage lama dapat ikut membuat order tampak siap atau membuat Operator melihat kombinasi file lama dan baru.

**Rekomendasi:** saat bounce, tandai versi approved/pending terbaru pada **setiap slot** sebagai `REJECTED` atau `SUPERSEDED`, bukan berdasarkan satu `current_version` global. Jalankan coverage ulang sebelum order dapat kembali `CONFIRMED`.

## Temuan prioritas menengah

### P2 — Catatan handoff belum dipisahkan

Operator menerima `approval_notes` dari DesignVersion. Field ini dapat berisi evidence persetujuan seperti nama konsumen dan kanal komunikasi, sedangkan kebutuhan Operator adalah instruksi teknis: profil warna, bleed, ukuran final, finishing, atau catatan RIP.

**Dampak:** informasi audit approval dan instruksi kerja bercampur, sehingga Operator dapat melewatkan catatan teknis atau melihat data yang tidak relevan.

**Rekomendasi:** pisahkan `technical_notes` dan `approval_evidence`, tampilkan hanya `technical_notes` pada kartu Operator, dan simpan evidence untuk Admin/Owner.

### P2 — Dokumentasi dan implementasi berbeda soal granularitas job

Dokumen produksi menyebut satu ProductionJob per item, sedangkan `autoReleaseToProduction()` menggabungkan item dengan mesin default sama menjadi satu job per mesin. UI Operator sudah menampilkan daftar item yang relevan ke mesin, tetapi label dan laporan perlu mengikuti model per mesin.

**Dampak:** pengguna dapat mengira satu job selalu mewakili satu item; rekonsiliasi qty dan file menjadi membingungkan ketika satu mesin mengerjakan beberapa item.

**Rekomendasi:** ubah dokumen dan label UI menjadi “satu job per mesin” serta tampilkan mapping item → job secara eksplisit.

### P2 — Hak Admin/Owner memulai job tidak konsisten dengan dokumen Operator

`startProduction()` menerima permission `production.execute` atau `production.assign`, sehingga Admin/Owner dapat memulai job tertentu. Dokumen role Operator hanya menjelaskan Operator sebagai pelaksana SCAN 1.

**Dampak:** audit log dapat menunjukkan Admin memulai produksi, tetapi aturan operasionalnya tidak jelas apakah ini override darurat atau perilaku normal.

**Rekomendasi:** dokumentasikan Admin/Owner sebagai override terbatas dengan alasan wajib, atau batasi `startProduction()` pada Operator dan sediakan action override terpisah yang tercatat.

## Skenario uji handoff wajib

1. Walk-in approved + DP terpenuhi + mesin default aktif → job muncul di queue.
2. Online V1 menunggu Admin → tidak ada job produksi sampai Admin approve.
3. Makloon DP dibayar lebih dulu → upload file terakhir membuat order `CONFIRMED` dan job tercipta.
4. Multi-item dengan dua mesin → setiap job hanya menampilkan item dan file yang relevan.
5. Default operator aktif → job assigned; default operator nonaktif → job queued.
6. Dua Operator SCAN 1 bersamaan → hanya satu berhasil.
7. User non-Operator memanggil `getOperatorJobs()` langsung → ditolak.
8. Operator bounce order multi-item → seluruh slot desain terbaru ditolak dan tidak ada file lama yang menutup coverage.
9. Manual assignment dengan user non-Operator, order belum CONFIRMED, atau gate gagal → ditolak server.
10. Auto-release dan Admin release bersamaan → tidak ada ProductionJob ganda.

## Prioritas perbaikan

1. Tambahkan role guard pada `getOperatorJobs()`.
2. Perbaiki bounce multi-item agar seluruh slot direkonsiliasi.
3. Pisahkan catatan teknis dari evidence approval.
4. Selaraskan dokumentasi “per item” menjadi “per mesin” atau ubah model job bila bisnis memang membutuhkan job per item.
5. Tegaskan kebijakan Admin/Owner sebagai override start produksi.

## Kesimpulan akhir

Handoff Designer ke Operator sudah aman pada jalur normal dan memiliki kontrol server yang cukup baik untuk approval, readiness, routing, dan claim. Risiko yang tersisa berada pada authorization query Operator dan rekonsiliasi multi-item ketika file dikembalikan. Dua hal tersebut perlu diperbaiki sebelum sistem dianggap siap untuk operasi percetakan dengan banyak Designer, mesin, dan Operator.

Audit ini tidak mengubah kode aplikasi; laporan berisi hasil pemeriksaan dan rekomendasi implementasi.
