# USER MANAGEMENT

## Prinsip Dasar

- Hanya **Owner** yang bisa membuat user baru dan mengubah role
- Sistem menggunakan RBAC (Role-Based Access Control)
- Setiap aksi user management dicatat di audit log

---

## Buat User Baru

**Siapa:** Hanya Owner

**Data yang diinput:**
- Nama lengkap
- Username (unik, untuk login)
- Email (opsional, untuk notifikasi sistem)
- Role (pilih dari daftar role yang ada)
- Status: Aktif / Nonaktif

**Setelah dibuat:**
- Sistem generate password sementara
- Owner memberikan password sementara ke pegawai secara langsung
- Pegawai wajib ganti password saat login pertama kali

---

## Ubah Role User

**Siapa:** Hanya Owner

**Aturan:**
- Role tidak bisa diubah jika user punya job/order yang sedang aktif (status IN_PROGRESS)
- Jika terpaksa ubah, Owner harus reassign job yang aktif dulu

---

## Nonaktifkan User

**Siapa:** Hanya Owner

**Yang terjadi saat nonaktifkan:**
- User tidak bisa login lagi
- Job yang sedang dikerjakan user tersebut muncul di dashboard Admin sebagai "Perlu Reassign"
- Semua data historis user tetap tersimpan (tidak dihapus)
- Nama user tetap muncul di riwayat job yang sudah selesai

**Aturan:** User tidak bisa dihapus permanen — hanya bisa dinonaktifkan.

---

## Reset Password

- **Untuk Owner:** Memiliki akses alur *self-service* "Lupa Password" via verifikasi tautan email (lihat `06-SECURITY/FORGOT-PASSWORD.md`).
- **Untuk Pegawai:** Tidak ada opsi lupa password mandiri. Jika lupa:
  - Owner reset password dari panel user management
  - Password baru diberikan langsung (offline), bukan via email
  - Pegawai wajib ganti password setelah login

---

## Keamanan Login

- Batas salah password: **5 kali** sebelum akun terkunci sementara
- Terkunci selama: **15 menit** (otomatis, tidak perlu Owner unlock)
- Setelah 3 kali terkunci berturut-turut dalam sehari: Owner harus unlock manual
- Semua percobaan login dicatat di audit log (berhasil maupun gagal)

---

## Dashboard Admin — Tambahan (Produksi)

Admin melihat:
- Semua job yang sedang dalam antrian produksi
- Job yang belum di-assign ke operator
- Job yang overdue (melebihi deadline)
- Notifikasi QC FAIL yang butuh penjelasan
- Job yang perlu reassign (karena operator nonaktif)
- Tombol approve/reject rework dari Owner
- Summary produksi harian: target vs aktual

---

## Database

Tambahan field di tabel `users`:
```
failed_login_count     (reset setiap sukses login)
locked_until           (timestamp jika akun terkunci)
must_change_password   (boolean, true untuk user baru)
deactivated_at
deactivated_by
```
