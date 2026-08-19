# PROJECT — Sistem Workflow Percetakan

## Tujuan

Membangun sistem manajemen workflow digital untuk percetakan yang mencakup:
- Pengelolaan order dari awal (konsumen datang) hingga akhir (barang diambil)
- Pelacakan produksi berbasis QR Code yang di-scan via kamera HP/tablet di browser
- Notifikasi otomatis ke konsumen via WhatsApp saat barang siap diambil
- Perlindungan data konsumen dari akses yang tidak berhak
- Audit trail real-time untuk mencegah kecurangan pegawai
- Laporan untuk Owner

---

## Scope Sistem

### Yang Dicakup (In-Scope)
- Order management (dari draft hingga closed)
- Manajemen desain & approval
- Produksi & QR tracking (10 titik scan)
- QC & rework workflow
- Finishing & label cetak
- Storage 2 lantai (Lantai 3 gudang, Lantai 1 counter)
- Pickup oleh konsumen (semua konsumen datang langsung ke toko)
- Notifikasi WhatsApp otomatis ke konsumen
- Inventory material
- Laporan & dashboard per role
- Audit trail real-time
- Manajemen user & RBAC (8 role)

### Yang Tidak Dicakup (Out-of-Scope)
- Pengiriman via kurir (delivery) — semua konsumen datang langsung ke toko
- Payment gateway online (pembayaran offline/manual)
- Customer portal (konsumen tidak punya login ke sistem)
- Machine integration sensor otomatis
- E-commerce / marketplace integration

---

## Alur Order Utama (Ringkasan)

```
KONSUMEN DATANG / HUBUNGI TOKO
  ↓
DESIGNER/SALES input order + data konsumen
  ↓
APPROVAL DESAIN (sesuai tipe konsumen — lihat detail di 03-DESIGN-APPROVAL.md)
  ↓
KONFIRMASI PAYMENT (DP 50%)
  ↓
PRODUKSI (scan QR di setiap titik)
  ↓
QC → PASS / FAIL (jika FAIL: rework workflow)
  ↓
FINISHING + LABEL CETAK
  ↓
SIMPAN KE GUDANG (LT3) + SCAN LOKASI
  ↓
NOTIFIKASI WHATSAPP OTOMATIS ke konsumen
  ↓
KONSUMEN DATANG → VERIFIKASI → RELEASE
  ↓
FINAL AUDIT → CLOSED
```

---

## Tipe Konsumen

| Tipe | Cara Order | Approval Desain |
|------|-----------|----------------|
| **Walk-in** | Datang langsung ke toko | Langsung di tempat — tidak perlu digital |
| **Makloon** | Bawa file desain sendiri | File langsung dicetak, tidak butuh approval |
| **WhatsApp** | Order via WA | Admin Sales konfirmasi di sistem |

---

## Modul yang Harus Dibangun

1. Authentication & User Management
2. Customer Management (dengan proteksi data sensitif)
3. Order Management
4. Design & Approval
5. Payment Management
6. Production & Job Management
7. QC & Rework
8. Finishing & Label
9. Storage (2 lantai)
10. Pickup & Release
11. WhatsApp Notification (+ Email fallback)
12. Material Inventory
13. Audit Trail
14. Reports & Dashboard
15. QR Code Generate & Scan

---

## Role yang Ada

| Role | Fungsi Utama |
|------|-------------|
| Owner | Akses penuh, laporan, approve exception |
| Supervisor | Kelola produksi, approve rework, monitor |
| Admin Sales | Order, payment, pickup, notifikasi |
| Designer Sales | Desain, versioning, approval |
| Operator | Produksi, scan QR, input qty/waste |
| QC | Inspeksi, PASS/FAIL, approve rework |
| Finishing | Packing, label, scan QR |
| Warehouse | Gudang, storage in/out, release |


---

## Catatan Implementasi

- Platform: **Web application** (bukan mobile app)
- Scan QR: via kamera HP/tablet di browser (tidak perlu install apapun)
- Semua konsumen **datang langsung ke toko** — tidak ada fitur delivery kurir
- **Frontend** (tampilan & workflow UI) dikerjakan terpisah oleh tim desain
- **Backend & database** dikerjakan terpisah oleh tim developer
- Dokumentasi ini adalah spesifikasi lengkap untuk kedua tim

---

## Status Proyek

| Fase | Status |
|------|--------|
| Dokumentasi Sistem | ✅ Selesai (folder ini) |
| Implementasi Backend | 🔜 Belum mulai |
| Implementasi Frontend | 🔜 Belum mulai |
| Testing & QA | 🔜 Belum mulai |
| Go-Live | 🔜 Belum mulai |
