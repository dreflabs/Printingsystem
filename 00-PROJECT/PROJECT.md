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
- Manajemen user & RBAC (5 role)

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
| **Online** | Konsumen menghubungi via online (WA maupun media sosial) | Admin konfirmasi di sistem |

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

### Role Tenant (5 role — dipakai oleh percetakan/pelanggan SaaS)

| Role | Fungsi Utama |
|------|-------------|
| Owner | Akses penuh, laporan, approve exception |
| Admin | Order, payment, pickup, notifikasi, **plus kelola produksi harian (eks-Supervisor)** — assign job, reassign, laporan produksi/material |
| Designer Sales | Desain, versioning, approval |
| Operator | Produksi, scan QR, input qty/waste |
| Gudang | QC (inspeksi PASS/FAIL), Finishing (packing, label), Storage (gudang, storage in/out) |

> Role **Supervisor sudah dihapus** — sebagian besar tugasnya (assign/reassign job, monitor produksi, laporan produksi/material) dipindahkan ke role **Admin**. Dua hal sengaja **tidak** ikut dipindahkan, tetap eksklusif Owner: (1) approval Final Audit hasil YELLOW — karena Admin sendiri yang submit hasil audit, self-approval tidak boleh terjadi; (2) approve rework (ke-1, ke-2, maupun eskalasi) — rework berdampak langsung ke biaya material & waktu produksi.
>
> Role **Gudang** menggabungkan 3 tahap akhir produksi (QC, Finishing, Storage) menjadi satu role — cocok untuk percetakan kecil/menengah yang tidak punya staf khusus terpisah untuk tiap tahap. Detail: `03-ROLES/GUDANG.md`.

### Role Platform (di luar 5 role tenant — dipakai oleh pengelola SaaS)

| Role | Fungsi Utama |
|------|-------------|
| Super Admin | Kelola seluruh tenant (suspend/activate/delete), monitor MRR & system health, billing override, impersonate tenant untuk debugging |

> **Penting:** Super Admin **bukan** role tambahan di dalam 5 role tenant di atas. Akunnya tersimpan di tabel terpisah (`super_admins`, bukan `users`) dan login di domain utama (`printpilot.id`), bukan di subdomain tenant manapun — supaya tidak ada jalur eskalasi privilege dari sisi tenant ke level platform. Super Admin sendiri punya 3 sub-level (SUPER_ADMIN/SUPPORT/FINANCE) dengan batasan akses berbeda — lihat `03-ROLES/SUPER-ADMIN.md` untuk definisi hak akses, `13-SAAS/SUPER-ADMIN.md` untuk spesifikasi fitur & UI.


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
