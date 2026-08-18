# AUDIT TRAIL

## Prinsip Dasar

Audit trail adalah catatan permanen dan tidak dapat diubah dari semua aksi kritis di sistem.
Setiap perubahan status, aksi sensitif, dan keputusan penting harus tercatat secara otomatis.

---

## Real-Time

- Audit log ditulis **secara sinkron** bersamaan dengan setiap transaksi database
- Jika audit log gagal ditulis, transaksi utamanya juga harus di-rollback
- Tidak ada batch atau delay — setiap aksi langsung tercatat

---

## Siapa yang Bisa Menghapus

| Role | Hapus Audit Log |
|------|----------------|
| Owner | **YA, dengan konfirmasi 2 langkah** (hanya dalam keadaan sangat khusus, seperti data PII yang harus dihapus karena regulasi) |
| Supervisor | TIDAK BISA |
| Admin Sales | TIDAK BISA |
| Designer | TIDAK BISA |
| Operator | TIDAK BISA |
| Auditor | TIDAK BISA (read-only) |
| Sistem/API | TIDAK BISA (tidak ada endpoint DELETE) |

> Penghapusan oleh Owner pun harus mengisi alasan dan dikonfirmasi ulang.
> Aksi penghapusan itu sendiri dicatat di audit log terpisah yang tidak bisa dihapus.

---

## Dimana Menyimpan Audit Log

### Rekomendasi: Database Utama + Proteksi Berlapis

**Opsi yang direkomendasikan (paling praktis untuk skala ini):**

```
PostgreSQL (database utama)
  └── tabel: audit_logs
       ├── Tidak ada endpoint DELETE di API
       ├── PostgreSQL Role khusus: audit_writer (INSERT only, no UPDATE/DELETE)
       ├── Aplikasi menggunakan audit_writer untuk menulis log
       └── Hanya Owner via panel khusus yang bisa trigger DELETE (dengan logging)
```

**Mengapa bukan database terpisah?**
- Untuk percetakan skala ini, database terpisah menambah kompleksitas operasional yang tidak perlu
- Selama akses API-nya dikunci (tidak ada DELETE endpoint kecuali Owner), risiko sudah sangat rendah
- Cukup amankan dengan: Role PostgreSQL + tidak ada endpoint hapus + monitor akses database langsung

**Jika di masa depan butuh level keamanan lebih tinggi:**
- Pertimbangkan replikasi audit_logs ke object storage (S3/MinIO) sebagai cold backup
- Setiap baris audit_logs bisa diberi hash dari konten sebelumnya (blockchain-style) untuk deteksi tampering

---

## Retention Period

- Audit log disimpan minimal **2 tahun** (24 bulan)
- Setelah 2 tahun: arsip ke cold storage, tidak dihapus
- Log terkait kasus sengketa: disimpan selama kasus berlangsung + 1 tahun setelahnya

---

## Aksi yang Wajib Dicatat

| Kategori | Aksi |
|----------|------|
| **User Management** | Login, logout, gagal login, ubah password, buat user, nonaktifkan user |
| **Order** | Buat order, ubah harga, ubah deadline, cancel order, close order |
| **Payment** | Konfirmasi payment, override DP, ubah status payment |
| **Design** | Upload file, minta approval, approve/reject desain |
| **Production** | Buat Job, mulai produksi, selesai produksi, rework |
| **QC** | QC PASS, QC FAIL, approve rework, reject rework |
| **Storage** | Scan masuk storage, scan keluar storage, barang tidak ditemukan |
| **Pickup/Delivery** | Release barang, override release, konfirmasi delivery |
| **Audit** | Buat audit, beri hasil PASS/FAIL/HOLD, close order setelah audit |
| **Data Sensitif** | Akses data phone/email konsumen (siapapun yang mengaksesnya) |

---

## Format Pencatatan

Setiap baris di `audit_logs`:
```
id            : UUID
actor_id      : user_id yang melakukan aksi
action        : string aksi (e.g., ORDER_CREATED, QC_FAIL_REWORK_APPROVED)
entity_type   : jenis objek (order, production_job, payment, dll)
entity_id     : ID objek yang diubah
old_value_json: nilai sebelum perubahan (JSON)
new_value_json: nilai setelah perubahan (JSON)
ip_address    : IP address actor
user_agent    : browser/device info
notes         : keterangan tambahan (alasan override, dll)
created_at    : timestamp (UTC, tidak bisa diubah)
```

---

## Akses ke Audit Log

- **Owner**: Lihat semua, filter semua, export CSV/PDF
- **Supervisor**: Lihat log terkait area mereka, tidak bisa export
- **Auditor**: Read-only, bisa filter by date/order/actor
- **Admin Sales**: Hanya lihat log terkait order dan notifikasi mereka sendiri
- **Role lain**: Tidak bisa akses audit log
