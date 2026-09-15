# Order Workflow — Pembuatan hingga Konfirmasi

## Langkah 1 — Buat Order Baru

**Siapa:** Admin atau Designer Sales

**Data yang wajib diisi:**
- Konsumen (pilih dari database atau buat baru)
- Tipe order: Walk-in / Makloon / Online
- Produk + spesifikasi (ukuran, jumlah, bahan)
- Deadline
- Catatan khusus (opsional)

**Data yang otomatis terisi sistem:**
- Kode order: `ORD-YYYYMMDD-XXXX` (auto-increment per hari)
- Tanggal pembuatan
- Dibuat oleh (akun yang login)
- Status: DRAFT

---

## Langkah 2 — Tambah Item Order

Satu order bisa memiliki **lebih dari satu item produk** (combo order):

Contoh: Banner 3x1m (10 pcs) + Sticker A4 (50 pcs) dalam satu order.

Setiap item mengisi:
- Jenis produk
- Deskripsi tambahan
- Ukuran/dimensi
- Jumlah
- Bahan (pilih hanya dari allowlist material yang dikonfigurasi untuk produk)
- Finishing (laminasi, pemotongan, dll — opsional)
- Harga satuan
- Total harga item

### Aturan material per produk

Setiap produk cetak memiliki daftar **Material yang Diizinkan** pada Katalog Produk.
Saat Admin atau Designer memilih produk, form hanya menampilkan material aktif yang
terdaftar pada allowlist tersebut. Material default terpilih otomatis. Jika produk
belum memiliki mapping material, order ditahan dan tidak menggunakan daftar semua
material tenant sebagai fallback.

Server mengulang validasi pasangan `product_id` + `material_id` sebelum membuat
`OrderItem`. Perubahan material setelah order masuk produksi memakai alur override
material dengan alasan dan audit log.

**Harga total order** = jumlah semua item + dikurangi diskon (jika ada, harus approval Owner).

---

## Langkah 3 — Upload File Desain (jika ada)

- Walk-in: Designer buat desain di hadapan konsumen, upload ke sistem
- Makloon: Admin upload file dari konsumen
- Online: Designer upload preview desain, menunggu konfirmasi Admin

Lihat detail di: `02-WORKFLOW/03-DESIGN-APPROVAL.md`

---

## Langkah 4 — Penetapan DP

Sistem otomatis hitung DP minimum berdasarkan total order:
- Walk-in: **50% dari total**
- Makloon / Online: minimal 50%, bisa di-override dengan approval

Status order berubah ke WAITING_PAYMENT setelah desain APPROVED.

---

## Langkah 5 — Konfirmasi Order → Auto-Release ke Produksi

Setelah DP diterima dan dikonfirmasi Admin:
- Status berubah ke CONFIRMED
- Sistem langsung menjalankan **Completeness Gate**. Kalau semua syarat wajib
  terpenuhi (DP, desain APPROVED + file final, diskon tidak menggantung, identitas
  pemesan, deadline, tiap item lengkap, tiap produk punya mesin default) → sistem
  **otomatis** membuat Production Job per mesin (status `PRODUCTION_QUEUED`) tanpa
  approval Admin.
- **Admin tidak perlu menekan tombol apa pun** untuk meneruskan order ke Operator.
- Kalau gate belum lolos, order tetap CONFIRMED dan alasannya tampil di dashboard
  Admin; tombol **"Assign ke Produksi"** manual tetap tersedia sebagai jalur
  fallback (mis. item custom tanpa mesin default, atau mesin default MAINTENANCE).
- Operator mengambil job dari antrian mesinnya sendiri melalui **Ambil & Mulai Produksi** (kode internal SCAN 1 = klaim + mulai).

Detail: `02-WORKFLOW/17-AUTO-RELEASE-PRODUKSI.md`.

---

## Edit Order

| Kondisi | Bisa Edit? | Oleh Siapa |
|---------|-----------|-----------|
| Status DRAFT | ✅ Ya | Admin, Designer |
| Status DESIGNING / WAITING_APPROVAL | ✅ Ya (terbatas) | Admin |
| Status CONFIRMED ke atas | ❌ Tidak bisa edit langsung | — |
| Status CLOSED | ❌ Tidak | Hanya Correction/Adjustment |

---

## Multiple Job per Order

Jika satu order punya beberapa item produk yang butuh mesin berbeda:
- Sistem buat **Production Job terpisah** per mesin
- Item yang memakai mesin default sama digabung dalam satu job dan jumlah rencananya dijumlahkan
- Masing-masing job berjalan di mesin yang sesuai secara paralel atau berurutan
- Semua job dalam satu order harus selesai sebelum order bisa masuk ke Pickup

---

## Pencarian & Filter Order

Filter yang tersedia di halaman daftar order:
- Status (dropdown multi-select)
- Tanggal order (dari–sampai)
- Nama konsumen (search)
- Kode order (search exact)
- Deadline (dari–sampai)
- Overdue only (toggle)
- Designer yang handle
