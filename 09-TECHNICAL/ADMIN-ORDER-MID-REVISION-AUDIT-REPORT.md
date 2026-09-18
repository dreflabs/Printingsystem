# Laporan Audit Skenario Revisi Desain di Tengah Order

**Tanggal audit:** 15 September 2026  
**Skenario:** pelanggan memesan melalui Admin, desain sudah dibuat, kemudian pelanggan meminta revisi sebelum order selesai.  
**Ruang lingkup:** alur Admin → Designer → approval → pembayaran → pelepasan ke produksi → Operator, termasuk dampak perubahan spesifikasi dan bukti audit.

## Kesimpulan eksekutif

Prinsip bisnis yang tertulis sudah benar: desain yang berubah harus dibuat sebagai versi baru, versi baru harus disetujui kembali, dan file yang sudah pernah disetujui tetap disimpan untuk audit. Jalur revisi yang ada cukup untuk order yang masih berada pada fase desain atau menunggu pembayaran.

Ada satu celah proses utama yang perlu diprioritaskan. Ketika order sudah **CONFIRMED** karena DP terpenuhi tetapi produksi belum dimulai, pelanggan masih dapat meminta revisi secara bisnis, tetapi action `requestDesignRevision()` menolak status tersebut dan Admin belum memiliki tombol khusus untuk mencatat permintaan revisi. Tanpa jalur khusus, staf bisa tergoda mengganti file secara manual atau menghubungi Designer di luar sistem. Itu berisiko membuat file yang dicetak berbeda dari bukti persetujuan dan status pembayaran.

**Penilaian keseluruhan: 7/10.** Jalur normal aman; skenario perubahan setelah approval dan sebelum cetak memerlukan state transition serta UI Admin yang eksplisit.

## Sumber pemeriksaan

- `02-WORKFLOW/02-ORDER.md` — status order, DP, completeness gate, dan aturan edit.
- `02-WORKFLOW/03-DESIGN-APPROVAL.md` — approval Walk-in, Makloon, Online, versioning, dan re-approval.
- `02-WORKFLOW/05-PRODUCTION.md` — job produksi, assignment, dan kapan produksi dimulai.
- `02-WORKFLOW/14-CANCEL-REFUND.md` — pembatalan dan dampak DP menurut fase produksi.
- `02-WORKFLOW/15-CORRECTION-ADJUSTMENT.md` — correction setelah `CLOSED`.
- `frontend/src/actions/design.ts` — upload, approval, dan request revisi.
- `frontend/src/actions/production.ts` — pengembalian file dari job pra-mulai dan batas QC/rework.
- `frontend/src/actions/orders.ts` dan `frontend/src/lib/auto-release.ts` — pembayaran, readiness gate, dan auto-release.
- Dashboard Admin dan Designer yang berjalan pada `http://127.0.0.1:3000`.

## Alur yang seharusnya terjadi

```text
Admin membuat order + brief + harga + deadline
  → Designer membuat V1
  → Admin mengirim preview ke pelanggan (untuk Online)
  → pelanggan meminta revisi
  → Admin mencatat alasan, kanal, dan bukti permintaan
  → sistem membuka revisi pada slot yang dipilih
  → Designer membuat V2/V3
  → approval ulang sesuai tipe order
  → sistem menjalankan ulang pemeriksaan DP, quote, coverage, dan readiness
  → jika semua lolos: release ke produksi
  → Operator hanya menerima versi APPROVED terbaru
```

Revisi harus diperlakukan sebagai perubahan terkontrol, bukan edit langsung terhadap V1. V1 tetap immutable dan diberi status `REJECTED` atau `SUPERSEDED` dengan alasan yang dapat ditelusuri.

## Hasil audit menurut fase order

| Fase saat pelanggan meminta revisi | Perilaku implementasi saat ini | Risiko | Keputusan yang disarankan |
|---|---|---|---|
| `DRAFT`, `DESIGNING`, `WAITING_APPROVAL` | `requestDesignRevision()` dapat dipakai oleh Admin/Owner atau PIC Designer. Versi terbaru per slot ditandai `REJECTED`, DesignJob kembali `DESIGNING`. | Rendah. Perlu memastikan Admin mencatat permintaan pelanggan, bukan hanya Designer. | Lanjutkan alur; tambahkan form Admin dengan alasan, kanal, dan lampiran bukti opsional. |
| `WAITING_PAYMENT` | Revisi dapat dibuka; upload berikutnya membuat versi baru dan approval harus diulang. Status pembayaran tetap ditinjau terpisah. | Sedang jika spesifikasi/harga berubah tetapi quote tidak dihitung ulang. | Kunci quote lama, buat perubahan harga/DP eksplisit, lalu minta persetujuan komersial bila nilai berubah. |
| `CONFIRMED`, belum ada job produksi | Action revisi saat ini menolak karena `CONFIRMED` tidak termasuk status mutable. UI Admin belum menyediakan action “Catat Permintaan Revisi”. | **P1.** Staf dapat mengganti file di luar workflow atau order tetap memakai desain lama. | Buat action Admin khusus yang mengunci order, membuka revisi, mengembalikan status ke `DESIGNING`/`WAITING_PAYMENT`, lalu menjalankan approval dan gate ulang. |
| `PRODUCTION_QUEUED` atau `PRODUCTION_ASSIGNED`, belum scan mulai | `bounceDesignFromProduction()` dapat menghapus job pra-mulai dan mengembalikan order ke `DESIGNING`. | **P1.** Implementasi hanya menolak satu versi berdasarkan `current_version` global pada order multi-item. | Gunakan action revisi pelanggan yang membatalkan semua job pra-mulai dan merekonsiliasi setiap slot item. Simpan alasan dan actor. |
| `PRODUCTION_STARTED` atau lebih jauh | Bounce ditolak dan diarahkan ke QC/rework. | Tinggi jika perubahan dipaksakan dengan overwrite file; material dan waktu sudah terpakai. | Jangan ubah file produksi asli. Owner memilih reprint/order baru atau correction/rework dengan biaya dan persetujuan yang jelas. |
| `CLOSED` | Correction/Adjustment adalah record baru dan bukan edit order asli. | Rendah bila aturan dipatuhi; correction tidak cocok untuk revisi desain sebelum order selesai. | Pertahankan correction hanya untuk komplain atau koreksi setelah closing. |

## Pemeriksaan implementasi

### Yang sudah benar

- `uploadDesignVersion()` menolak upload pada order yang sudah masuk produksi.
- Slot yang sudah `APPROVED` tidak dapat ditimpa tanpa permintaan revisi resmi.
- Untuk Online, versi `PENDING` tidak dapat diganti sebelum ada keputusan atau revisi resmi.
- Nomor versi dialokasikan per slot item dengan row lock, sehingga V1/V2 tidak tertukar pada upload paralel.
- `approveDesign()` menyetujui versi terbaru per slot dan menghitung ulang coverage seluruh item non-retail.
- Setelah approval lengkap, sistem menghitung ulang DP dan menjalankan auto-release hanya bila order benar-benar siap.
- File yang dikembalikan dari produksi pra-mulai tidak langsung dapat dicetak lagi sebelum Designer mengunggah dan approval ulang.

### Temuan P1 — Tidak ada jalur Admin untuk revisi pada `CONFIRMED`

Dokumen menyatakan order `CONFIRMED` ke atas tidak dapat diedit langsung, tetapi kebutuhan bisnis pelanggan tetap dapat muncul setelah DP dibayar dan sebelum mesin mulai. `requestDesignRevision()` hanya menerima `DRAFT`, `DESIGNING`, `WAITING_APPROVAL`, dan `WAITING_PAYMENT`. `approveDesign()` masih mengenal `CONFIRMED`, sehingga aturan state menjadi tidak simetris: approval dapat dilakukan, tetapi revisi resmi tidak dapat dibuka.

**Dampak:** versi approved lama berpotensi tetap menjadi sumber produksi, sementara permintaan pelanggan hanya tersimpan di chat atau catatan informal. Ini melemahkan audit trail dan kontrol perubahan.

**Perbaikan:** sediakan `requestOrderDesignRevision()` yang hanya dapat dijalankan Admin/Owner untuk order `CONFIRMED` yang belum dimulai. Action tersebut harus memakai transaction lock dan melakukan langkah berikut:

1. Pastikan tidak ada ProductionJob yang sudah `PRODUCTION_STARTED`.
2. Jika ada job `PRODUCTION_QUEUED`/`PRODUCTION_ASSIGNED`, batalkan atau hapus seluruh job pra-mulai order.
3. Tandai versi terbaru **pada setiap slot** sebagai `REJECTED`/`SUPERSEDED`.
4. Simpan alasan pelanggan, kanal permintaan, actor Admin, timestamp, dan bukti opsional.
5. Set `DesignJob = DESIGNING` dan order menjadi `DESIGNING` atau `WAITING_PAYMENT` sesuai status DP setelah quote dihitung ulang.
6. Wajibkan V2/V3, approval ulang, readiness gate, dan release ulang.

### Temuan P1 — Pengembalian multi-item tidak merekonsiliasi semua slot

`bounceDesignFromProduction()` menghapus semua job pra-mulai, tetapi mencari satu `DesignVersion` dengan `version_no === design.current_version`. `current_version` adalah ringkasan global, sedangkan versi sebenarnya disimpan per slot item. Pada order Banner + Sticker, misalnya, V1 dapat ada pada dua slot. Hanya satu record yang akan ditolak.

**Dampak:** satu slot dapat tetap `APPROVED`; coverage lama dan file baru dapat tercampur saat order dirilis kembali.

**Perbaikan:** gunakan `design_job_id` dan `order_item_id` untuk memilih versi terbaru setiap slot. Tandai seluruh target yang relevan, hitung ulang coverage, dan buat order tidak dapat kembali `CONFIRMED` sebelum seluruh slot memiliki file baru yang approved.

### Temuan P2 — Permintaan pelanggan belum memiliki data terstruktur

Action saat ini menyimpan alasan pada `rejection_reason` dan audit log generik, tetapi belum membedakan apakah permintaan berasal dari pelanggan, Operator, Designer, atau pemeriksaan internal. Untuk order Admin, data minimal yang perlu dicatat adalah:

- `requested_by_user_id` — akun yang memasukkan permintaan.
- `request_source` — `WA`, `PHONE`, `IN_PERSON`, `EMAIL`, atau `INTERNAL`.
- `customer_request_at` — waktu permintaan diterima.
- `customer_reference` — nomor chat/tiket atau catatan yang aman.
- `reason` dan item/slot yang diminta direvisi.
- versi sebelum dan sesudah revisi.

Lampiran screenshot chat boleh opsional, tetapi jangan menyimpan data pribadi lebih banyak dari kebutuhan operasional.

### Temuan P2 — Perubahan spesifikasi dan harga belum terikat pada revisi

Mengubah desain visual saja tidak selalu mengubah harga. Namun jika pelanggan sekaligus mengubah ukuran, bahan, jumlah, finishing, deadline, atau diskon, total order dan `dp_required` harus dihitung ulang. Implementasi revisi desain saat ini tidak otomatis membuat quote revision.

Aturan aman:

- Total naik: order kembali `WAITING_PAYMENT` bila DP baru belum terpenuhi.
- Total turun: Admin mencatat kredit/refund sesuai kebijakan; jangan mengurangi saldo secara diam-diam.
- Diskon berubah: Owner approval tetap wajib.
- Perubahan spesifikasi setelah job pra-mulai dibatalkan harus mengulang readiness dan routing mesin.

## SOP target yang profesional

### A. Revisi sebelum desain disetujui

Admin menerima permintaan pelanggan dan mencatat alasan. Designer mengerjakan V2 pada slot yang dipilih. V1 tetap tersimpan sebagai `REJECTED`/`SUPERSEDED`. Setelah pelanggan menyetujui preview, Admin atau Designer sesuai tipe order melakukan approval. Order baru dapat maju setelah coverage, DP, dan data produksi lengkap.

### B. Revisi setelah disetujui, tetapi sebelum produksi dimulai

Admin menekan **Catat Permintaan Revisi**. Sistem menampilkan dampak: status order, job produksi yang akan dihentikan, saldo DP, dan perubahan quote. Setelah Admin mengonfirmasi:

`CONFIRMED` → batalkan job pra-mulai → `DESIGNING` → upload V2 → approval ulang → quote/DP check → completeness gate → release ulang.

Designer tidak boleh menghapus atau mengganti V1 secara langsung. Jika ada job yang sudah di-pin ke Operator, job tersebut harus berstatus dibatalkan/released dari queue agar tidak bisa di-scan oleh Operator lama.

### C. Revisi setelah produksi dimulai

Admin mencatat permintaan, tetapi sistem tidak membuka overwrite. Owner memilih salah satu:

- melanjutkan job asli dan membuat order/reprint baru untuk desain baru;
- menghentikan job dan mencatat material yang terpakai, lalu membuat reprint dengan approval Owner;
- memakai alur QC/rework bila perubahan merupakan akibat masalah kualitas internal.

ProductionJob asli, file yang dipakai, waktu mulai, material, dan biaya harus tetap immutable.

## Matriks tanggung jawab

| Aktivitas | Admin | Designer | Operator | Owner |
|---|---|---|---|---|
| Menerima dan mencatat permintaan pelanggan | **Boleh, wajib untuk order Admin/Online** | Dapat memberi catatan teknis | Dapat melaporkan file bermasalah | Dapat mengawasi |
| Membuat V2/V3 | Dapat membantu upload | **PIC utama** | Tidak boleh | Dapat override |
| Approval Online | **Wajib** | Tidak boleh | Tidak boleh | Boleh sebagai override |
| Membuka revisi `CONFIRMED` pra-produksi | Boleh dengan alasan wajib | Tidak boleh sendiri | Tidak boleh atas permintaan pelanggan | Boleh |
| Menghentikan job pra-mulai | Boleh dengan audit log | Tidak boleh | Boleh melaporkan/bounce file | Boleh |
| Mengubah harga/DP/diskon | Admin sesuai policy | Tidak boleh | Tidak boleh | **Approval diskon/override** |
| Memutuskan perubahan setelah produksi mulai | Ajukan dan dokumentasikan | Memberi estimasi desain | Laporkan status fisik | **Keputusan akhir** |

## Audit log minimum

Event yang direkomendasikan:

- `CUSTOMER_DESIGN_REVISION_REQUESTED`
- `DESIGN_REVISION_OPENED`
- `PRESTART_PRODUCTION_CANCELLED_FOR_REVISION`
- `DESIGN_VERSION_SUPERSEDED`
- `DESIGN_VERSION_UPLOADED`
- `DESIGN_REAPPROVED`
- `QUOTE_RECALCULATED_AFTER_REVISION`
- `DP_RECHECKED_AFTER_REVISION`
- `ORDER_RELEASED_AFTER_REVISION`
- `REVISION_ESCALATED_AFTER_PRODUCTION_STARTED`

Setiap event menyimpan `order_id`, `order_code`, actor, role, timestamp, slot/item, versi lama, versi baru, alasan, status sebelum/sesudah, dan perubahan nilai finansial.

## Acceptance test yang wajib ada

1. Admin order Online: V1 `PENDING`, pelanggan minta revisi, Admin mencatat request, Designer upload V2, Admin approve V2.
2. Order `WAITING_PAYMENT`: revisi tidak menghapus pembayaran; DP dihitung ulang jika total berubah.
3. Order `CONFIRMED` tanpa ProductionJob: Admin dapat membuka revisi; Designer tidak dapat meng-upload sebelum request resmi.
4. Order `CONFIRMED` dengan job `PRODUCTION_ASSIGNED`: semua job pra-mulai dibatalkan dan tidak dapat di-scan Operator.
5. Order multi-item: revisi seluruh order menolak versi terbaru di setiap slot, bukan hanya satu `current_version`.
6. Revisi satu item: slot lain tetap approved dan coverage dihitung dengan benar.
7. Dua Admin mencoba membuka revisi bersamaan: hanya satu transaksi berhasil; tidak ada job ganda atau versi ganda.
8. Job `PRODUCTION_STARTED`: request revisi langsung diarahkan ke Owner/reprint/QC; file asli tidak berubah.
9. Quote naik: order menunggu tambahan DP sebelum auto-release.
10. User Designer mencoba action Admin untuk `CONFIRMED`: ditolak server-side.

## Rencana perbaikan berurutan

1. Tambahkan action server-side dan tombol Admin **Catat Permintaan Revisi** untuk `CONFIRMED` pra-produksi.
2. Perbaiki rekonsiliasi bounce per slot multi-item dan gunakan status job yang eksplisit (`CANCELLED_FOR_REVISION` bila model status mendukung).
3. Tambahkan metadata kanal/bukti permintaan pelanggan dan event audit khusus.
4. Hubungkan revisi dengan quote, DP, diskon, readiness, dan auto-release.
5. Tambahkan integration test untuk sepuluh skenario di atas.
6. Selaraskan SOP, label UI, dan laporan agar istilah V1/V2/V3, `REJECTED`, `SUPERSEDED`, serta `CANCELLED_FOR_REVISION` konsisten.

## Keputusan audit

Skenario pelanggan meminta revisi **dapat dilayani secara aman** bila permintaan terjadi sebelum produksi dimulai, tetapi implementasi perlu menambahkan jalur Admin untuk order `CONFIRMED` dan memperbaiki multi-item. Setelah produksi dimulai, revisi tidak boleh dilakukan dengan mengganti file; gunakan keputusan Owner untuk reprint/order baru atau jalur QC/rework. Dengan dua perbaikan P1 tersebut dan pencatatan finansial yang eksplisit, alur ini layak dijadikan SOP SaaS percetakan yang profesional.

**Catatan:** audit ini hanya menyimpan hasil pemeriksaan dan rekomendasi; tidak ada perubahan kode yang dilakukan pada turn ini.
