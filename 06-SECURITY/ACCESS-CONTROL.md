# ACCESS CONTROL

## Prinsip Dasar

Sistem menggunakan **Role-Based Access Control (RBAC)** dengan 5 role: Owner, Admin, Designer Sales, Operator, Gudang. (User Management adalah fungsi yang hanya bisa dijalankan Owner, bukan role terpisah.)

> **Role Gudang** menggabungkan 3 tahap akhir alur produksi — inspeksi kualitas (QC), finishing & label, dan penyimpanan/gudang — menjadi satu role. Satu orang dengan role Gudang bisa mengerjakan ketiganya, cocok untuk percetakan kecil/menengah yang tidak punya staf khusus terpisah untuk tiap tahap. Detail lengkap: `03-ROLES/GUDANG.md`.
>
> **Role Supervisor sudah dihapus** — sebagian besar tugasnya (assign/reassign job, monitor produksi, laporan produksi/material) dipindahkan ke role **Admin**. Dua hal yang sengaja **tidak** ikut dipindahkan, tetap eksklusif Owner: (1) approval Final Audit hasil YELLOW — karena Admin sendiri yang submit hasil audit, kalau Admin juga jadi approver-nya tidak ada lagi pengecekan independen (self-approval); (2) approve rework (ke-1, ke-2, maupun eskalasi) — rework berdampak langsung ke biaya material & waktu produksi, jadi tetap wajib keputusan Owner. Detail: `03-ROLES/ADMIN.md`.

**RBAC diterapkan di server, bukan di UI.** Setiap API route/Server Action wajib memvalidasi `session.user.role` sebelum menjalankan logika apapun. Hidden button, disabled input, atau menu yang disembunyikan di frontend **bukan** kontrol akses — itu hanya kenyamanan tampilan. Tanpa pengecekan role di server, siapapun yang tahu endpoint-nya (via devtools, curl, script) bisa mem-bypass UI. Detail kontrak otorisasi per endpoint ada di `09-TECHNICAL/API.md`.

Rangkuman ini disusun dari definisi hak akses yang sudah tersebar di `03-ROLES/*.md` per role — bukan aturan baru. Tujuannya satu titik referensi agar tim tidak perlu membuka 10 file terpisah untuk tahu "siapa boleh apa".

---

## Matriks RBAC

Legenda: ✅ = akses penuh, 📖 = read-only / lihat saja, ❌ = tidak ada akses.

| Modul / Aksi | Owner | Admin | Designer Sales | Operator | Gudang |
|---|---|---|---|---|---|
| **Order** — buat/edit (DRAFT–CONFIRMED) | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Order** — lihat | ✅ | ✅ | 📖 (order sendiri) | 📖 (job sendiri) | 📖 (job sendiri) |
| **Order** — approve diskon | ✅ | ❌ (hanya ajukan) | ❌ | ❌ | ❌ |
| **Order** — cancel sebelum produksi | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Order** — cancel setelah produksi | ✅ | ❌ (hanya ajukan) | ❌ | ❌ | ❌ |
| **Order** — freeze (ON_HOLD) | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Design** — upload & approve walk-in/makloon | ❌ | ❌ (approve Online saja) | ✅ | ❌ | ❌ |
| **Design** — approve via Online | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Payment** — konfirmasi DP/pelunasan | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Payment** — override DP di bawah 50% | ✅ (bebas %) | ❌ (Hanya ajukan) | ❌ | ❌ | ❌ |
| **Production** — assign/reassign job | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Production** — scan mulai/selesai (job sendiri) | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Production** — approve rework (semua tingkat: ke-1, ke-2, & eskalasi) | ✅ **hanya Owner** | ❌ | ❌ | ❌ | ❌ |
| **Production** — set status mesin MAINTENANCE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Material** — input stok masuk | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Material** — tambah bahan baru | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Material** — input pemakaian per job | ❌ | ❌ | ❌ | ✅ | ❌ |
| **QC** — submit hasil (PASS/FAIL) | ❌ | 📖 | ❌ | ❌ | ✅ |
| **Finishing** — scan mulai/selesai + cetak label | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Storage** — scan simpan (Job QR + Location QR) | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Storage** — laporkan insiden | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Pickup** — release final ke konsumen | ❌ | ✅ | ❌ | ❌ | ❌ (hanya konfirmasi barang di counter) |
| **Audit** — submit hasil final audit (GREEN/YELLOW/RED) | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Audit** — approve hasil YELLOW sebelum CLOSED | ✅ | ❌ **(sengaja, lihat catatan di atas)** | ❌ | ❌ | ❌ |
| **Audit** — lihat audit log | ✅ | ✅ (scoped) | ❌ | ❌ | ❌ |
| **Audit** — hapus audit log | ✅ (panel khusus, tercatat) | ❌ | ❌ | ❌ | ❌ |
| **Reports** — keuangan | ✅ | 📖 (tanpa nominal detail) | ❌ | ❌ | ❌ |
| **Reports** — produksi | ✅ | ✅ (+ export) | ❌ | ❌ | ❌ |
| **Reports** — material | ✅ | ✅ (+ export) | ❌ | ❌ | ❌ |
| **Reports** — pegawai/absensi | ✅ | 📖 (ringkasan, tanpa detail gaji) | ❌ | ❌ | ❌ |
| **Reports** — export semua laporan | ✅ | ✅ (sesuai laporan yang diaksesnya) | ❌ | ❌ | ❌ |
| **Data konsumen** — phone/email | ✅ | ✅ | ❌ | ❌ | ❌ |
| **User Management** — buat/nonaktifkan/reset password/unlock | ✅ | ❌ | ❌ | ❌ | ❌ |
| **POS / Direct Sales** — buat transaksi RETAIL | ✅ | ✅ | ❌ | ❌ | ❌ |
| **POS / Direct Sales** — konfirmasi pembayaran RETAIL | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Retail Inventory** — lihat katalog & stok barang retail | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Retail Inventory** — tambah/edit produk retail | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Retail Inventory** — input stok masuk barang retail | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Retail Inventory** — adjustment stok barang retail | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Reports** — laporan penjualan retail | ✅ | 📖 | ❌ | ❌ | ❌ |

<!-- perlu klarifikasi: 03-ROLES/OWNER.md tidak eksplisit menyebut Owner bisa submit QC atau scan produksi langsung — mengikuti prinsip "Owner akses penuh ke semua data" secara umum, tapi aksi operasional harian (scan QR, submit QC) di file per-role hanya didefinisikan untuk role eksekutor terkait (Operator/Gudang). Matriks di atas menandai kolom Owner ❌ untuk aksi operasional harian tersebut karena tidak disebut eksplisit sebagai hak Owner di file manapun, meski secara praktik Owner mungkin bisa override lewat panel admin. -->

---

## Prinsip Least Privilege

- Setiap role hanya diberi akses **minimum yang dibutuhkan** untuk menjalankan tugasnya — bukan akses default luas yang dipersempit belakangan.
- Operator dan Gudang hanya melihat job yang relevan dengan tugasnya (job yang di-assign / dalam antrian tahap masing-masing), bukan seluruh data order.
- Data sensitif konsumen (`phone`, `email`) hanya terbuka untuk role yang memang berinteraksi langsung dengan konsumen atau butuh data finansial (Admin, Owner). Data konsumen difilter berdasarkan role.
- Penambahan hak akses baru ke suatu role harus eksplisit didokumentasikan di `03-ROLES/<ROLE>.md` dan direfleksikan ke matriks ini — tidak ada hak akses implisit "karena role tersebut senior".

---

## Audit atas Perubahan Permission

- Perubahan role user (`PATCH /api/users/:id` yang mengubah `role_id`) hanya bisa dilakukan Owner, dan setiap perubahan dicatat di `audit_logs` (`action=USER_ROLE_CHANGED`, dengan `old_value_json`/`new_value_json`).
- Role tidak boleh diubah selagi user memiliki job/order aktif berstatus IN_PROGRESS — job aktif harus di-reassign dulu sebelum perubahan role diterapkan (lihat `03-ROLES/USER-MANAGEMENT.md`).
- Nonaktifkan user, reset password, dan unlock akun terkunci — ketiganya aksi Owner-only dan seluruhnya tercatat di `audit_logs` dengan actor, target user, dan timestamp.
- Karena matriks RBAC di atas menentukan otorisasi server, setiap perubahan pada matriks ini (menambah/mengurangi hak suatu role) berarti perubahan pada validasi server yang mengacunya — perubahan seperti ini wajib direview seperti perubahan kode keamanan lain, bukan sekadar edit dokumentasi.
