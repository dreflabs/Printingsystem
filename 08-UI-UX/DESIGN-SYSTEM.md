# DESIGN SYSTEM — Print Pilot (Light Edition)

## Identitas Visual

**Nama Sistem:** Print Pilot  
**Tagline:** Modern SaaS Printing Management System  
**Tema:** Paper Studio Light — Clean Precision White Mode (bukan dark mode)  
**Feel:** Professional, bersih, mudah dibaca di lantai produksi/gudang dengan pencahayaan terang  

---

## Palet Warna (Color Tokens)

Hanya **5 warna kromatik** (1 accent + 4 status semantik) agar konsisten dan tidak ramai. Warna lain (orange, purple/neon) sengaja dihapus dari sistem — semua kebutuhan warna di seluruh dashboard, komponen, dan modul WAJIB memakai token di bawah ini, tidak boleh menambah hue baru.

| Token | Hex | Konsep & Peruntukan |
|-------|-----|-------------------|
| `bg-base` | `#F7F8FA` | **Off-White** — Background utama seluruh halaman (bukan putih murni, mengurangi silau) |
| `bg-card` | `#FFFFFF` | **Pure White** — Background card, kontras jelas dari base |
| `bg-elevated` | `#EEF1F5` | **Light Slate** — Area Input, Hover, dan Modal |
| `accent-teal` | `#0891B2` | **Cyan Dark** — CTA Utama, Menu Aktif, Premium/Executive Action (menggantikan accent-purple lama) |
| `status-green` | `#059669` | **Emerald** — SELESAI, SIAP AMBIL, PASS |
| `status-yellow` | `#D97706` | **Amber** — MENUNGGU, Pending Approval, DEADLINE BESOK, PARTIAL Payment (menggantikan status-orange lama) |
| `status-red` | `#E11D48` | **Rose** — OVERDUE, QC FAIL, ERROR |
| `status-blue` | `#0284C7` | **Cobalt** — PRODUKSI BERJALAN, Status Aktif |
| `text-primary` | `#0F172A` | **Near Black** — Teks utama & judul |
| `text-muted` | `#64748B` | **Slate** — Subtitle & label |
| `border` | `#E2E8F0` | **Light Border** — Garis pemisah halus |

> **Riwayat perubahan:** Versi sebelumnya (dark mode "Midnight Glassmorphism") memakai 7 warna kromatik (teal, purple, green, yellow, orange, red, blue). Disederhanakan jadi 5 warna: `accent-purple` digantikan oleh `accent-teal`, `status-orange` digantikan oleh `status-yellow`. Semua dokumen dan kode di sistem ini sudah diselaraskan ke palet baru.

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

## Status Pills (Pulse Dot Badges)

| Status | Label | Skema Warna & Indikator |
|--------|-------|-------------------------|
| DRAFT | Draft | Slate (`bg-muted/15 text-muted border-muted/30`) |
| DESIGNING | Desain | Cobalt + Pulse Dot (`bg-status-blue/15 text-status-blue border-status-blue/30`) |
| WAITING_APPROVAL | Menunggu Acc | Amber (`bg-status-yellow/15 text-status-yellow border-status-yellow/30`) |
| APPROVED | Disetujui | Emerald (`bg-status-green/15 text-status-green border-status-green/30`) |
| WAITING_PAYMENT | Menunggu DP | Amber + Pulse Dot (`bg-status-yellow/15 text-status-yellow border-status-yellow/30`) |
| CONFIRMED | Konfirmasi | Emerald (`bg-status-green/15 text-status-green border-status-green/30`) |
| PRODUCTION_STARTED | Produksi | Cobalt + Pulse Dot (`bg-status-blue/15 text-status-blue border-status-blue/30`) |
| QC_PENDING | QC | Amber (`bg-status-yellow/15 text-status-yellow border-status-yellow/30`) |
| QC_PASSED | QC Lulus | Emerald (`bg-status-green/15 text-status-green border-status-green/30`) |
| QC_FAILED | QC Gagal | Rose + Pulse Dot (`bg-status-red/15 text-status-red border-status-red/30`) |
| QC_REWORK_PENDING | Menunggu Rework | Amber (`bg-status-yellow/15 text-status-yellow border-status-yellow/30`) |
| FINISHING_STARTED | Finishing | Cyan Dark + Pulse Dot (`bg-accent-teal/15 text-accent-teal border-accent-teal/30`) |
| READY_FOR_PICKUP | Siap Diambil | Emerald + Pulse Dot (`bg-status-green/15 text-status-green border-status-green/30`) |
| PICKED_UP | Selesai | Emerald Solid (`bg-status-green/20 text-status-green border-status-green/40`) |
| OVERDUE | Terlambat | Rose + Pulse Dot (`bg-status-red/15 text-status-red border-status-red/30`) |
| ON_HOLD | Ditahan | Amber (`bg-status-yellow/15 text-status-yellow border-status-yellow/30`) |
| CANCELLED | Dibatalkan | Slate (`bg-muted/15 text-muted border-muted/30`) |
| INCIDENT | Insiden | Rose + Pulse Dot (`bg-status-red/20 text-status-red border-status-red/40`) |
| CLOSED | Ditutup | Cyan Dark (`bg-accent-teal/15 text-accent-teal border-accent-teal/30`) |

---

## Komponen UI

### Tombol
- **Primary:** Gradient Cyan Dark (`from-[#0891B2] to-[#0EA5E9]`), rounded-xl, font-bold, shadow-lg shadow-[#0891B2]/20
- **Danger:** Solid/Gradient Rose (`from-[#E11D48] to-red-700`)
- **Outline:** Border teal 40%, bg transparent, text teal

### Card (Flat White)
- Background: `bg-card` + `border border-border` + `rounded-2xl`
- Shadow: `shadow-sm` (bayangan abu-abu tipis, tanpa efek glow neon — glow tidak terlihat di background terang)
- Aktif saat Hover: `hover:border-accent-teal/40`

---

## Layout Grid

```
Desktop (1280px+):
  Sidebar: 240px fixed
  Content: flex-grow, max-width 1440px, padding 24px
```
