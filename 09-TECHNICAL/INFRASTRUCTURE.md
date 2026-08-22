# INFRASTRUKTUR FISIK — Kebutuhan Hardware & Jaringan

## Perangkat yang Dibutuhkan per Area

### Area Desain & Sales (Meja Depan / Office)
| Perangkat | Jumlah | Keterangan |
|-----------|--------|-----------|
| Komputer/Laptop | 2 unit | Untuk Admin + Designer |
| Monitor | 2 unit | Minimal 22 inci untuk kerja desain |
| WiFi / LAN | ✅ | Harus terhubung ke server/internet |

### Area Produksi — Lantai 3
| Perangkat | Jumlah | Keterangan |
|-----------|--------|-----------|
| HP/Tablet per operator | 1 per operator | Untuk scan QR Job, minimal Android 10 / iOS 14 |
| Charger/Holder tablet | 1 per stasiun | Agar tidak kehabisan baterai saat shift |
| WiFi Access Point LT3 | Min 1 AP | Harus cover seluruh area mesin |
| Printer Label QR | 1 unit | Terhubung ke jaringan — lihat spesifikasi di bawah |

### Area QC
| Perangkat | Jumlah | Keterangan |
|-----------|--------|-----------|
| Tablet/HP | 1 unit | Untuk input hasil inspeksi + upload foto defect |
| WiFi | ✅ | Harus ada coverage di area QC |

### Area Finishing
| Perangkat | Jumlah | Keterangan |
|-----------|--------|-----------|
| Tablet/HP | 1 unit | Untuk scan QR + konfirmasi finishing |
| Printer Label QR | Bisa berbagi dengan area produksi | Jika lokasi berdekatan |
| WiFi | ✅ | |

### Counter Penyerahan — Lantai 1
| Perangkat | Jumlah | Keterangan |
|-----------|--------|-----------|
| Komputer/Tablet | 1 unit | Untuk Admin proses pickup |
| WiFi / LAN | ✅ | |

---

## Printer Label QR

Printer label digunakan untuk cetak label QR yang ditempel di setiap produk selesai finishing.

### Spesifikasi Minimum
- **Tipe**: Thermal label printer (rekomendasi: Zebra, Epson TM, atau Brother QL)
- **Koneksi**: WiFi / LAN (bukan USB — harus bisa dikirim dari server web)
- **Ukuran label**: Fleksibel, minimal bisa print 6×4 cm
- **Sistem print**: Melalui network print server atau browser print API

### Yang Dicetak di Label
```
┌─────────────────────────┐
│  [QR CODE]              │
│                         │
│  ORD-20260814-0001      │
│  Banner 3x1m — 10 pcs  │
│  Ahmad                  │
│  Slot: LT3-A-01-01     │
└─────────────────────────┘
```

---

## Jaringan

| Lokasi | Kebutuhan |
|--------|----------|
| Semua area kerja | WiFi stabil, minimal 10 Mbps upload |
| Server | VPS/Cloud dengan uptime 99%+ |
| Backup koneksi | Disarankan ada koneksi cadangan (hotspot) jika WiFi utama mati |

> **Catatan penting:** Jika WiFi mati di area produksi, operator tidak bisa scan QR dan tidak bisa input pemakaian material. Harus ada prosedur manual jika terjadi downtime jaringan.

---

## Server / Hosting

| Komponen | Rekomendasi |
|----------|------------|
| Hosting | VPS Cloud (DigitalOcean, Vultr, atau AWS Lightsail) |
| OS | Ubuntu 22.04 LTS |
| RAM | Minimum 2GB (rekomendasi 4GB) |
| Storage | Minimum 50GB SSD (untuk file desain + backup) |
| Database | PostgreSQL 15+ |
| SSL | Wajib HTTPS (Let's Encrypt) |
| Backup | Otomatis harian, simpan 30 hari terakhir |
| Domain | Diperlukan domain atau subdomain untuk akses |

---

## Browser yang Didukung

| Browser | Versi Minimum | Keterangan |
|---------|--------------|-----------|
| Google Chrome | 100+ | ✅ Direkomendasikan |
| Mozilla Firefox | 100+ | ✅ |
| Safari (iOS) | 15+ | ✅ Untuk HP Apple |
| Samsung Internet | 18+ | ✅ Untuk HP Samsung |
| Microsoft Edge | 100+ | ✅ |
| Internet Explorer | Semua versi | ❌ Tidak didukung |

---

## Prosedur Darurat Jika Sistem Down

1. Operator mencatat job secara manual di kertas (formulir cadangan)
2. Admin menandai job yang belum diinput ke sistem
3. Setelah sistem kembali online, Admin input data manual
4. Semua input manual wajib ada keterangan "input manual — sistem down [tanggal]"
5. Dicatat di audit log sebagai input tertunda
