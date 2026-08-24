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
- Bahan (pilih dari daftar material yang relevan dengan produk)
- Finishing (laminasi, pemotongan, dll — opsional)
- Harga satuan
- Total harga item

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

## Langkah 5 — Konfirmasi Order

Setelah DP diterima dan dikonfirmasi Admin:
- Status berubah ke CONFIRMED
- Order masuk antrian produksi
- Admin bisa assign job ke mesin dan operator

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
- Sistem buat **Production Job terpisah** per item
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
