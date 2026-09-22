# Laporan Audit Tombol Upload Setelah Designer Mengunggah Desain

**Tanggal audit:** 14 September 2026  
**Ruang lingkup:** perilaku tombol Upload pada dashboard Designer setelah V1/V2 diunggah, aturan per metode approval, kontrol server, dan risiko versi ganda.  
**Sumber:** `frontend/src/app/(dashboard)/designer/page.tsx`, `frontend/src/actions/design.ts`, `02-WORKFLOW/03-DESIGN-APPROVAL.md`, dan `03-ROLES/DESIGNER-SALES.md`.

## Jawaban singkat

**Ya, tombol Upload masih dapat terbuka setelah file pertama diunggah, tetapi lokasinya berubah sesuai kondisi.** Ini sebagian memang diperlukan untuk V2/V3, namun perilaku saat versi masih menunggu approval belum cukup ketat untuk operasi percetakan yang aman.

## Perilaku aktual per metode

| Kondisi | Tombol yang terlihat | Penilaian |
|---|---|---|
| Walk-in, V1 baru diunggah dan masih `PENDING` | Tombol utama `ACC`; menu `⋯` masih menyediakan `Upload versi baru` | Dapat diterima untuk koreksi sebelum approval, tetapi sebaiknya upload berikutnya dipicu oleh permintaan revisi yang tercatat. |
| Walk-in, desain sudah `APPROVED` | Tombol utama `Detail`; Upload tidak tersedia | Benar. Perubahan harus melalui `Minta revisi`, lalu upload versi berikutnya. |
| Online, V1 baru diunggah dan menunggu Admin | Tombol utama `Tunggu ACC Admin`; menu `⋯` masih menyediakan `Upload versi baru` | Terlalu longgar. Designer dapat menambah V2 sebelum Admin mencatat permintaan revisi. |
| Online, desain sudah `APPROVED` | Upload tidak tersedia; revisi harus dimulai melalui `Minta revisi` | Benar dan sesuai separation of duties. |
| Makloon, seluruh item sudah memiliki file | DesignJob menjadi `APPROVED`; Upload tidak tersedia | Benar. |
| Makloon multi-item, baru sebagian item memiliki file | Upload tetap tersedia | Diperlukan untuk item yang belum diisi, tetapi UI perlu mengarahkan upload ke item yang masih kosong. |
| Versi terakhir `REJECTED` | Upload tersedia untuk membuat versi baru | Benar dan sesuai alur V2/V3. |

## Bukti implementasi

Pada `DesignRowActions` saat ini:

- `canUpload = owned && !done`, sehingga semua job milik Designer yang belum berstatus `APPROVED` tetap dianggap dapat upload.
- Untuk Online, menu Upload secara eksplisit dirender ketika `r.method === "ONLINE"`, selama job belum `APPROVED`.
- Untuk Walk-in, tombol utama berubah menjadi `ACC` ketika ada desain non-approved, sementara Upload tetap berada di menu tindakan.
- Setelah job `APPROVED`, `canUpload` bernilai false sehingga Upload tertutup.

Server sudah memiliki perlindungan penting:

- `createDesignUploadUrl` dan `uploadDesignVersion` hanya menerima order pada fase `DRAFT`, `DESIGNING`, `WAITING_APPROVAL`, atau `WAITING_PAYMENT`.
- Designer harus menjadi PIC job; Admin/Owner dapat melakukan override sesuai role.
- Job harus berstatus `PENDING` atau `DESIGNING` untuk menerima upload.
- Setelah produksi dimulai, server menolak pembuatan URL dan penyimpanan versi baru.

Artinya, tombol yang masih terlihat karena state UI stale tidak dapat melewati kontrol server. Namun server saat ini **belum mensyaratkan adanya permintaan revisi atau penolakan versi terlebih dahulu** sebelum menerima upload tambahan pada job `DESIGNING`.

## Temuan audit

### P1 — Online dapat menerima V2 sebelum V1 diputuskan

Saat V1 Online masih `PENDING`, Designer dapat membuka `Upload versi baru` dan membuat V2. Ini memungkinkan beberapa versi pending tanpa keputusan Admin yang jelas. Admin hanya menyetujui versi terbaru per slot, sedangkan versi sebelumnya tetap tersimpan sebagai histori.

**Dampak:** jejak approval menjadi ambigu; Admin harus memastikan file mana yang dikirim ke konsumen; risiko salah versi meningkat.

### P1 — Makloon multi-item dapat mengunggah ulang slot yang sudah approved

Pada order Makloon yang belum lengkap seluruh itemnya, job masih `DESIGNING` sehingga Upload tetap tersedia. Server menerima upload baru pada slot yang sama dan otomatis memberi status `APPROVED`. Akibatnya satu item dapat memiliki beberapa file approved.

**Dampak:** query Operator mengambil seluruh versi approved, sehingga file lama dan file baru dapat sama-sama muncul sebagai file cetak. Ini adalah risiko operasional paling serius dalam audit ini.

### P2 — Label Upload belum menjelaskan tujuan tindakan

Menu menggunakan teks `Upload versi baru` atau `Upload / ganti per item`, tetapi tidak menjelaskan apakah Designer sedang mengisi item kosong, mengganti file karena revisi, atau menambah versi sebelum approval.

### P2 — Tidak ada guard UI berbasis status versi terbaru

UI memakai status job global (`APPROVED` atau belum) dan `hasAnyDesign`. UI belum membedakan `PENDING`, `REJECTED`, dan item yang sudah `APPROVED` ketika menentukan apakah Upload boleh dibuka.

## Rekomendasi

1. **Online:** tutup Upload ketika versi terbaru masih `PENDING`. Buka Upload kembali hanya setelah Admin mencatat `Minta revisi` dan versi terakhir berubah `REJECTED`.
2. **Walk-in:** pertahankan Upload sebagai tindakan lanjutan hanya setelah revisi tercatat; tombol utama tetap `ACC` untuk versi pending.
3. **Makloon multi-item:** izinkan upload hanya untuk item yang belum memiliki file approved. Jika perlu mengganti file approved, wajib melalui alur revisi Admin agar file lama ditandai superseded/rejected.
4. **Server:** tambahkan aturan bahwa slot yang sudah memiliki versi `APPROVED` tidak boleh menerima upload baru kecuali ada revision request yang tercatat. Untuk Online, batasi satu versi `PENDING` aktif per slot.
5. **Operator:** tampilkan hanya versi approved terbaru per slot, atau tambahkan status `SUPERSEDED` pada versi lama. Jangan kirim semua file approved ke antrian produksi.
6. Ubah label kontekstual menjadi `Isi item belum ada`, `Upload setelah revisi`, atau `Ganti file setelah revisi` agar tindakan tidak disalahpahami.

## Matriks hasil yang diharapkan setelah perbaikan

| Status versi terbaru | Online | Walk-in | Makloon |
|---|---|---|---|
| Belum ada versi | Upload | Upload | Upload |
| `PENDING` | Upload ditutup, tunggu Admin | ACC + Upload hanya jika kebijakan mengizinkan | Tidak berlaku |
| `REJECTED` | Upload V2/V3 | Upload V2/V3 | Upload pengganti melalui revisi |
| `APPROVED` | Upload ditutup sampai revisi | Upload ditutup sampai revisi | Upload ditutup; item kosong tetap boleh diisi |

## Kesimpulan

Perilaku sekarang **tidak sepenuhnya salah**: Upload tetap dibutuhkan untuk membuat V2/V3 dan mengisi item multi-item. Namun aturan `canUpload = owned && !done` terlalu umum. Risiko utama adalah upload tambahan sebelum revisi resmi dan kemungkinan beberapa file approved pada slot Makloon. Prioritas perbaikan adalah memperketat aturan slot/version di server dan membuat Operator hanya menerima file approved terbaru.

## Status implementasi setelah persetujuan rekomendasi

Perbaikan terkait audit ini sudah diterapkan: slot yang sudah memiliki versi `APPROVED` kini ditolak untuk upload baru tanpa revisi resmi, Online tidak lagi membuka Upload ketika seluruh slot masih menunggu approval Admin, dan query Operator hanya mengembalikan versi approved terbaru per slot. Kontrol UI tetap mengizinkan item multi-item yang masih kosong untuk diisi; pembatasan utama tetap ditegakkan di server.
