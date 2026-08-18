# DATA PROTECTION

## Prinsip Dasar

Least-privilege access, secure password hashing, session security,
restricted customer/financial data, backups and recovery.

---

## Proteksi Data Konsumen — WAJIB

### Field yang Diklasifikasikan Sensitif

| Field | Tabel | Klasifikasi |
|-------|-------|-------------|
| `phone` | customers | **RAHASIA** |
| `email` | customers | **RAHASIA** |
| `address` | customers | Terbatas |
| `company` | customers | Terbatas |
| `name` | customers | Dapat dilihat semua role |

### Aturan Akses Data Konsumen

**DESIGNER / DESIGNER-SALES:**
- BOLEH: lihat nama konsumen, order ID, status order, deadline, deskripsi produk
- DILARANG KERAS: akses nomor HP, email, alamat konsumen dalam bentuk apapun
- DILARANG KERAS: export atau download data konsumen
- DILARANG KERAS: akses daftar semua konsumen (hanya boleh lihat konsumen dari order yang ditanganinya)

**OPERATOR / QC / FINISHING:**
- BOLEH: lihat nama konsumen (sebatas info job), Job ID, spesifikasi produk
- DILARANG KERAS: akses phone, email, alamat konsumen

**WAREHOUSE:**
- BOLEH: lihat nama konsumen, Job ID, lokasi storage, status
- DILARANG KERAS: akses phone, email konsumen

**ADMIN SALES:**
- BOLEH: lihat semua data konsumen termasuk phone dan email
- BOLEH: kirim notifikasi manual jika WhatsApp gagal
- TIDAK BOLEH: export data konsumen tanpa log

**SUPERVISOR:**
- BOLEH: lihat semua data konsumen termasuk phone dan email
- TIDAK BOLEH: export data konsumen tanpa log

**OWNER:**
- Akses penuh ke semua data
- Setiap akses ke data sensitif tercatat di audit log

**AUDITOR:**
- Read-only, hanya bisa lihat summary laporan
- Phone/email konsumen ditampilkan dalam bentuk masked: `+6281****5678`

---

## Implementasi Teknis

### Server-Side Enforcement
- Field `phone` dan `email` HANYA di-include dalam API response jika role requester adalah: `admin_sales`, `supervisor`, `owner`
- Bukan hanya hidden di UI — field ini tidak boleh ada dalam response JSON untuk role lain
- Gunakan serializer/transformer berbasis role di setiap API endpoint yang mengembalikan data konsumen

### Masking di UI
- Untuk role yang tidak berhak (termasuk auditor): tampilkan `+6281****5678`
- Jangan hanya CSS hide — data tidak boleh ada di DOM

### WhatsApp — Nomor Tidak Boleh Dikirim Manual
- Notifikasi WhatsApp HANYA bisa dikirim oleh sistem otomatis
- Tidak ada fitur "kirim WhatsApp manual" yang mengekspos nomor HP konsumen ke user interface
- Jika gagal: sistem menampilkan peringatan ke Admin, Admin hanya melihat nama konsumen + status — bukan nomor HP-nya

### Logging Akses Data Sensitif
- Setiap akses ke `phone` atau `email` konsumen dicatat di `audit_logs`
- Format: `actor_id | action=VIEW_CUSTOMER_CONTACT | entity_type=customer | entity_id=X | timestamp`

---

## Password & Sesi

- Password di-hash menggunakan bcrypt (min cost 12) atau Argon2id
- Session token: HTTP-only cookie, Secure, SameSite=Strict
- Session expiry: 8 jam (satu shift kerja)
- Logout wajib di semua device jika password diubah

---

## Backup & Recovery

- Database backup harian (otomatis)
- Backup disimpan di lokasi terpisah dari server utama
- Retention backup: minimum 90 hari
- Recovery test: wajib diuji setiap 30 hari

---

## Enkripsi

### Transport (Wajib)
- Seluruh traffic aplikasi wajib **HTTPS/TLS** — tidak ada endpoint yang boleh diakses via HTTP polos, termasuk di jaringan lokal internal.
- Sertifikat dikelola otomatis (mis. Let's Encrypt) dengan renewal otomatis; domain custom dengan HTTPS adalah syarat wajib deployment (lihat `09-TECHNICAL/TECH-STACK.md`).
- Koneksi aplikasi ↔ database PostgreSQL memakai SSL/TLS jika keduanya tidak berada di host yang sama.
- Kamera browser (scan QR) hanya berfungsi di konteks aman (HTTPS) — ini juga persyaratan teknis dari Web API `getUserMedia`.

### At-Rest (Kolom Sensitif)
- Field `customers.phone` dan `customers.email` disimpan di PostgreSQL yang volume disknya terenkripsi di level infrastruktur (disk encryption pada VPS/managed storage).
- Untuk lapisan tambahan, kolom `phone` dan `email` dapat dienkripsi di level aplikasi (column-level encryption, mis. `pgcrypto` atau enkripsi di application layer sebelum INSERT) — direkomendasikan jika sistem berkembang menyimpan data konsumen dalam skala besar atau ada persyaratan kepatuhan yang lebih ketat. Untuk tahap awal, kombinasi disk encryption + akses API yang dibatasi role (lihat bagian Server-Side Enforcement di atas) dianggap cukup.
- Password tidak pernah disimpan plaintext — sudah diatur di bagian "Password & Sesi" (bcrypt/Argon2id).
- Backup database (`pg_dump`) yang disimpan di object storage terpisah juga wajib terenkripsi at-rest (bucket encryption) karena berisi salinan penuh data sensitif.

---

## Rate Limiting

### Login
- Selaras dengan kebijakan lockout di `03-ROLES/USER-MANAGEMENT.md`: maksimum **5 kali** percobaan password salah berturut-turut per akun sebelum akun terkunci otomatis selama **15 menit**.
- Setelah akun terkunci **3 kali berturut-turut dalam satu hari**, unlock otomatis dihentikan — Owner wajib melakukan unlock manual (`POST /api/users/:id/unlock`).
- Selain lockout per-akun, endpoint `POST /api/auth/login` juga dibatasi per-IP (mis. maksimum 20 percobaan/menit dari satu IP) untuk mencegah credential stuffing lintas akun dari sumber yang sama.
- Semua percobaan login (berhasil maupun gagal) dicatat di `audit_logs`.

### Endpoint Publik Lain
- Sistem ini tidak memiliki endpoint publik tanpa autentikasi selain halaman login — tidak ada registrasi mandiri, tidak ada API publik untuk konsumen.
- Endpoint yang menerima input dari perangkat scan (SCAN 1–10) tetap memerlukan sesi login aktif, sehingga rate limit login di atas menjadi lini pertama; tambahan rate limit per-user pada endpoint mutasi berfrekuensi tinggi (mis. submit QC, submit scan) direkomendasikan sebagai pencegahan penyalahgunaan/skrip otomatis (mis. maksimum 60 request/menit per user pada endpoint mutasi).
- Endpoint export laporan (`POST /api/reports/:type/export`) dibatasi frekuensinya per user untuk mencegah scraping data massal, di luar pencatatan yang sudah wajib ke audit log.

---

## Retensi Data Pelanggan

- Data konsumen (`customers`) dan riwayat order (`orders`, `order_items`, `payments`, dll) **disimpan permanen** selama tidak ada permintaan penghapusan eksplisit dari pemilik data — bukan dihapus otomatis setelah order selesai atau setelah periode tidak aktif tertentu.
- Alasan: sistem memakai PostgreSQL dengan jaminan ACID justru untuk mendukung audit trail dan riwayat transaksi yang harus bisa ditelusuri (final audit, laporan keuangan, sengketa konsumen) kapan pun diperlukan — penghapusan otomatis berisiko merusak integritas laporan historis.
- Tidak ada soft-delete untuk tabel inti (`active = false` dipakai untuk menonaktifkan, bukan menghapus) — konsisten dengan aturan di `05-DATABASE/TABLES.md`.
- Jika konsumen meminta datanya dihapus (lihat bagian UU PDP di bawah), penghapusan dilakukan lewat proses khusus yang tetap meninggalkan jejak di `audit_logs` (siapa yang menghapus, kapan, atas dasar permintaan siapa) — bukan penghapusan diam-diam yang membuat riwayat transaksi bolong tanpa jejak.

---

## Kepatuhan UU PDP (Undang-Undang Pelindungan Data Pribadi)

Sistem ini berkomitmen mengikuti prinsip dasar UU PDP Indonesia dalam pemrosesan data pribadi konsumen dan pegawai: pemrosesan data (nama, telepon, email, alamat) dilakukan berdasarkan kebutuhan pelaksanaan transaksi (dasar kontraktual — memproses pesanan cetak), pemilik data berhak meminta **akses** ke datanya sendiri, **koreksi** jika data tidak akurat, dan **penghapusan** (right to erasure) jika tidak ada dasar hukum lain yang mengharuskan data tersebut tetap disimpan (mis. kewajiban pembukuan). Permintaan semacam ini ditangani lewat Admin Sales/Owner secara manual pada tahap awal sistem, dicatat di `audit_logs`, dan diproses lewat mekanisme correction/deactivation yang sudah ada — dokumen ini tidak membahas detail hukum lebih lanjut; untuk kasus kompleks (mis. permintaan hapus total riwayat transaksi yang bersinggungan dengan kewajiban pembukuan pajak) perlu konsultasi terpisah dengan pihak legal.
