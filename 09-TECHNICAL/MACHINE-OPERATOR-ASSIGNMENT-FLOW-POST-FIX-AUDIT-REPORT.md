# Audit Ulang Alur Penetapan Mesin dan Operator

**Tanggal:** 15 September 2026
**Ruang lingkup:** akses mesin Operator, Operator Default, penugasan job manual, antrean produksi, reassignment, dan handoff ke eksekusi Operator.

## Kesimpulan

Perbaikan utama sudah berjalan dan alur penetapan mesin/operator sekarang konsisten pada tiga lapisan: UI, server action, dan database relation `UserMachine`.

Penugasan manual tidak lagi dapat memilih kombinasi mesin/operator yang tidak memiliki grant. Pencabutan akses mesin juga dilindungi agar job aktif tidak kehilangan penanggung jawab. Status keseluruhan: **sesuai untuk alur assignment, dengan satu temuan kebijakan yang masih perlu ditutup pada absensi sebelum dianggap selesai sepenuhnya**.

## Alur yang telah diverifikasi

### 1. Owner memberikan akses mesin

Alur yang berjalan:

1. Owner membuka **Pegawai → Akun & Akses**.
2. Owner memilih Operator pada kolom **Akses Mesin**.
3. Owner mencentang mesin dan menyimpan.
4. Server memverifikasi actor memiliki `shop.configure`.
5. Server memverifikasi target berada pada tenant yang sama dan memiliki role Operator, baik primary maupun extra role.
6. Server menormalisasi ID, menghapus duplikat, memastikan semua mesin milik tenant yang sama, lalu menulis ulang relasi `UserMachine`.

Perubahan ini berada di [user-management.ts](</Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/user-management.ts:35>).

Perlindungan tambahan yang sudah aktif: jika akses mesin akan dicabut sementara Operator masih memiliki job `PRODUCTION_ASSIGNED`, `PRODUCTION_STARTED`, atau `PRODUCTION_PAUSED` pada mesin tersebut, perubahan ditolak dan kode job ditampilkan agar Owner melakukan reassignment terlebih dahulu.

### 2. Admin/Owner menetapkan Operator Default

Alur yang berjalan:

1. Admin atau Owner membuka **Katalog & Harga → Produk & Mesin → Mesin**.
2. Pada tambah/edit mesin, pengguna memilih **Operator Default**.
3. Server hanya menerima Operator aktif dalam tenant yang memiliki role Operator.
4. Sistem membuat atau memastikan grant `UserMachine` untuk Operator dan mesin itu tersedia.
5. Saat auto-release, sistem memeriksa kembali Operator aktif dan grant mesinnya sebelum melakukan pin job.

Dengan demikian, `default_operator_id` berfungsi sebagai aturan routing untuk job baru. Ia tidak mencabut akses mesin Operator lama dan tidak memindahkan job lama secara otomatis.

Implementasi berada di [master-data.ts](</Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/master-data.ts:661>) dan [auto-release.ts](</Users/drefan/Projects/PRINT%20PILOT/frontend/src/lib/auto-release.ts:180>).

### 3. Admin/Owner menetapkan job tertentu

Alur yang berjalan:

1. Admin membuka detail order dan memilih **Assign ke Produksi**.
2. Sistem hanya menampilkan mesin berstatus `ACTIVE`.
3. Setelah mesin dipilih, dropdown Operator hanya menampilkan Operator yang memiliki grant untuk mesin tersebut.
4. Server memverifikasi order `CONFIRMED`, desain `APPROVED`, DP, completeness gate, tenant, mesin aktif, Operator aktif, role Operator, dan pasangan `UserMachine`.
5. Job dibuat sebagai `PRODUCTION_ASSIGNED` dengan mesin, Operator, qty, prioritas, dan catatan.

Filter UI berada di [admin/page.tsx](</Users/drefan/Projects/PRINT%20PILOT/frontend/src/app/(dashboard)/admin/page.tsx:588>). Validasi server berada di [design.ts](</Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/design.ts:649>).

Kontrol server tetap diperlukan karena request browser dapat dimanipulasi. Validasi pasangan mesin/operator sekarang dilakukan pada transaksi database di [design.ts](</Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/design.ts:744>).

### 4. Job antrean dan reassignment

Job tanpa Operator tetap berada pada `PRODUCTION_QUEUED`. Operator hanya melihat queue mesin yang tercatat di `UserMachine`. `getOperatorJobs()` memiliki role/permission guard dan filter tenant.

Saat Operator mengambil job antrean:

- server memeriksa grant mesin;
- klaim memakai update atomik berdasarkan status dan `operator_id = null`;
- hanya satu Operator yang menang jika terjadi klaim bersamaan.

Untuk job yang sudah ada, Admin atau Owner dapat menggunakan **Admin → Produksi → Reassign**. Target harus aktif, ber-role Operator, memiliki grant mesin target, dan alasan reassignment wajib diisi. Batas reassignment Admin dua kali per 24 jam masih berlaku; Owner menjadi override setelah batas tersebut.

Implementasi queue ada di [queries.ts](</Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/queries.ts:40>), klaim ada di [production.ts](</Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/production.ts:215>), dan reassignment ada di [production.ts](</Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/production.ts:429>).

## Temuan yang masih tersisa

### P1 — Aturan wajib absen belum menjadi gate saat mulai produksi

Dokumen role Operator menyatakan Operator wajib absen masuk sebelum mengambil job. Namun `startProduction()` saat ini memeriksa permission produksi dan grant mesin, tetapi belum memanggil `requireAttendanceEligible()` atau memeriksa check-in hari berjalan.

Dampaknya, Operator yang diwajibkan absen masih dapat memulai job tanpa check-in. Ini adalah perbedaan antara kebijakan dokumen dan enforcement server.

Rekomendasi: tambahkan guard absensi pada jalur Operator sebelum claim atau start. Admin/Owner yang memiliki override operasional dapat tetap diproses melalui jalur override yang dicatat di audit log.

### P2 — Operator Default bukan akses eksklusif

Mengganti Operator Default hanya memengaruhi routing job baru. Grant `UserMachine` Operator sebelumnya tetap ada sehingga Operator lama tetap bisa melihat queue mesin tersebut.

Perilaku ini aman bila `Operator Default` dipahami sebagai preferensi routing. Jika bisnis menginginkan satu mesin hanya boleh dikerjakan Operator tertentu, diperlukan tindakan terpisah untuk mencabut grant lama setelah job aktif ditangani.

### P2 — Penghapusan akses dan perubahan status mesin perlu tetap dipantau

Pencabutan akses sudah diblokir untuk job aktif. Namun job yang sudah selesai produksi tidak ikut menjadi alasan pemblokiran, sehingga Owner tetap perlu memastikan tahap QC/finishing sudah memiliki penanggung jawabnya sendiri. Ini bukan kegagalan assignment, tetapi perlu dipahami saat melakukan offboarding Operator.

## Perubahan dokumentasi

Dokumen workflow sudah diselaraskan dengan implementasi: jalur manual memilih mesin `ACTIVE` pengganti jika mesin default tidak routable. Penugasan manual juga secara eksplisit mensyaratkan grant `UserMachine`.

- [05-PRODUCTION.md](</Users/drefan/Projects/PRINT%20PILOT/02-WORKFLOW/05-PRODUCTION.md:1>)
- [17-AUTO-RELEASE-PRODUKSI.md](</Users/drefan/Projects/PRINT%20PILOT/02-WORKFLOW/17-AUTO-RELEASE-PRODUKSI.md:70>)

## Validasi teknis

- `npx tsc --noEmit`: berhasil.
- ESLint pada file yang diubah: berhasil.
- `npx prisma validate`: berhasil.
- `npx next build --webpack`: berhasil sampai optimasi dan pembuatan seluruh route.
- `git diff --check`: tidak menemukan whitespace error.

Full lint repository masih memiliki error lama pada file di luar perubahan ini. Build default Turbopack juga gagal karena batasan proses/port lingkungan lokal; build webpack production berhasil.

## Rekomendasi urutan tindak lanjut

1. Terapkan attendance gate pada `startProduction()`.
2. Tentukan secara eksplisit apakah Operator Default bersifat routing saja atau juga eksklusif.
3. Tambahkan notifikasi Owner ketika perubahan akses tertahan oleh job aktif.
