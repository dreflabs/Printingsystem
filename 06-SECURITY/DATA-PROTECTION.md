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
