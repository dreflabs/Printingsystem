# DESIGN SYSTEM — PrintFlow

## Identitas Visual

**Nama Sistem:** PrintFlow  
**Tagline:** Sistem Manajemen Percetakan Digital  
**Tema:** Dark Mode Premium (tidak ada light mode)  
**Feel:** Professional, modern, industrial — cocok untuk lingkungan percetakan

---

## Palet Warna

| Token | Hex | Digunakan untuk |
|-------|-----|----------------|
| `bg-base` | `#0F172A` | Background utama semua halaman |
| `bg-card` | `#1E293B` | Card, sidebar, panel |
| `bg-elevated` | `#2D3748` | Input, hover state |
| `accent-teal` | `#0EA5E9` | Aksi utama, CTA, menu aktif |
| `accent-purple` | `#7C3AED` | Highlight Owner, badge premium |
| `status-green` | `#10B981` | SELESAI, SIAP AMBIL, PASS |
| `status-yellow` | `#F59E0B` | MENUNGGU, peringatan |
| `status-orange` | `#F97316` | DEADLINE BESOK, PARTIAL |
| `status-red` | `#EF4444` | OVERDUE, FAIL, ERROR |
| `status-blue` | `#3B82F6` | PRODUKSI, AKTIF |
| `text-primary` | `#F8FAFC` | Teks utama |
| `text-muted` | `#94A3B8` | Label, placeholder |
| `border` | `#334155` | Garis pemisah |

---

## Tipografi

**Font:** Inter (Google Fonts)

| Elemen | Ukuran | Berat |
|--------|--------|-------|
| Logo/Nama Sistem | 24px | 700 |
| Judul Halaman | 28px | 700 |
| Judul Card | 18px | 600 |
| Body | 14px | 400 |
| Teks Kecil | 12px | 400 |
| Angka KPI | 36px | 700 |
| Badge/Pill | 11px | 600 |

---

## Status Pills

| Status | Label | Warna |
|--------|-------|-------|
| DRAFT | 📝 Draft | Abu-abu |
| DESIGNING | 🎨 Desain | Biru muda |
| WAITING_APPROVAL | ⏳ Menunggu Acc | Kuning |
| APPROVED | ✅ Disetujui | Hijau |
| WAITING_PAYMENT | 💳 Menunggu DP | Oranye |
| CONFIRMED | ✅ Konfirmasi | Hijau |
| PRODUCTION_STARTED | 🔵 Produksi | Biru |
| QC_PENDING | 🔍 QC | Kuning |
| QC_PASSED | ✅ QC Lulus | Hijau |
| QC_FAILED | ❌ QC Gagal | Merah |
| QC_REWORK_PENDING | 🔄 Menunggu Rework | Oranye gelap |
| FINISHING_STARTED | 🔧 Finishing | Ungu muda |
| READY_FOR_PICKUP | 📦 Siap Diambil | Hijau terang |
| PICKED_UP | ✅ Selesai | Hijau solid |
| OVERDUE | 🔴 Terlambat | Merah |
| ON_HOLD | ⏸️ Ditahan | Kuning gelap |
| CANCELLED | ✖️ Dibatalkan | Abu-abu gelap |
| INCIDENT | ⚠️ Insiden | Merah tua |
| CLOSED | 🔒 Ditutup | Ungu |

---

## Komponen UI

### Tombol
- **Primary:** Gradient teal-blue, rounded-full, tinggi 48px
- **Danger:** Gradient orange-red
- **Outline:** Border teal, bg transparent
- **Ghost:** Teks teal tanpa border

### Card
- Glassmorphism: `rgba(30,41,59,0.7)` + blur 12px + border `rgba(51,65,85,0.8)` + radius 16px
- Glow aktif: border teal 40% opacity
- Shadow: `0 4px 24px rgba(0,0,0,0.4)`

### Input
- Background: `bg-elevated`
- Border: `border` default, teal saat focused
- Error: border merah + teks error kecil

---

## Layout Grid

```
Desktop (1280px+):
  Sidebar: 240px fixed
  Content: flex-grow, max-width 1440px, padding 24px

Tablet (768px–1279px):
  Sidebar: 64px (icon only)
  Content: full width

Mobile (< 768px):
  Sidebar: hidden (hamburger menu)
  Content: full width, padding 16px
```

---

## Aturan UI Global

| Aturan | Ketentuan |
|--------|-----------|
| Nomor HP konsumen | Tidak pernah tampil kecuali di halaman khusus Admin |
| Tombol berbahaya | Selalu ada popup konfirmasi |
| Error message | Harus spesifik dan jelas dalam Bahasa Indonesia |
| Loading state | Wajib ada spinner/skeleton untuk setiap request |
| Tombol tidak diizinkan | Jangan tampilkan sama sekali (bukan disabled) |
| Mobile scan halaman | Responsif, minimum button height 56px |
| Feedback sukses | Toast hijau pojok kanan bawah |
| Sesi berakhir | Redirect login dengan pesan jelas |
| Bahasa | Semua Bahasa Indonesia natural |

---

## Breakpoints

| Perangkat | Lebar | Utama untuk |
|-----------|-------|------------|
| Mobile | 360–430px | Scan QR, Operator |
| Tablet | 768–1024px | Warehouse, QC |
| Desktop | 1280px+ | Owner, Admin, Designer |
