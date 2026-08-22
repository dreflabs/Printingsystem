# Print Pilot SaaS — Marketing Landing Page Specification

## 1. Tujuan & Target Audiens
- **Tujuan Utama:** Mengkonversi pengunjung (pemilik percetakan) menjadi pendaftar (Tenant baru) dengan mencoba paket Starter atau Trial.
- **Target Audiens:** Pemilik bisnis percetakan (digital printing, offset, sablon, merchandise) berskala kecil hingga menengah (UMKM) yang masih menggunakan sistem manual (Excel/kertas) dan sering mengalami masalah operasional (order terselip, stok tidak sinkron, deadline terlewat).

## 2. Struktur Halaman (Anatomi Landing Page)

Halaman marketing (`printpilot.id`) akan terdiri dari beberapa seksi yang dirancang berurutan (dari atas ke bawah) untuk membangun ketertarikan:

### Section 1: Hero (Kesan Pertama) — Product-led, bukan mockup statis
- **Layout:** Split asimetris (bukan centered-stack generik). Kiri: label kecil kapital + headline + sub-headline + CTA + baris statistik produk. Kanan: **widget kalkulator estimasi harga cetak yang benar-benar interaktif** (pilih jenis cetakan, bahan/finishing, jumlah → harga muncul live). Ini menggantikan gambar/screenshot statis — pengunjung langsung merasakan sedikit dari produknya, bukan cuma melihat gambar.
- **Headline (H1):** Kuat dan menyelesaikan masalah. *Contoh: "Kelola Percetakan Anda Tanpa Pusing."*
- **Sub-headline:** *Contoh: "Tinggalkan buku catatan dan Excel. Print Pilot membantu Anda mencegah order terselip, memantau produksi real-time, dan menghemat biaya operasional."*
- **Call-to-Action (CTA):** Tombol **"Mulai dari Rp 299rb/bln"** (primary) + **"Pelajari Fitur"** (secondary, scroll ke section fitur).
- **Elemen yang SENGAJA dihilangkan** (terlalu umum dipakai template SaaS lain): badge pill "✨ Versi baru tersedia", radial background glow, gambar mockup device 3D.
- **Statistik produk** (bukan social proof dummy): jumlah titik scan QR produksi, jumlah role akses, hari trial gratis — fakta tentang produk, ditampilkan ringkas di bawah CTA.

### Section 2: Social Proof & Trust
- **Dihapus dari versi ini:** baris logo grayscale "Dipercaya oleh 50+ percetakan" dengan nama perusahaan dummy — pola ini terlalu generik dan tidak kredibel selama belum ada logo klien asli. Digantikan oleh baris statistik produk di Section 1. Baris logo nyata boleh ditambahkan kembali begitu tersedia data klien riil.

### Section 3: Masalah vs Solusi (Agitation)
- Tampilan perbandingan:
  - ❌ **Cara Lama:** Order terselip, CS lupa info harga, stok bahan baku habis tiba-tiba, pelanggan marah karena deadline molor.
  - ✅ **Dengan Print Pilot:** Semua tercatat digital, terhubung otomatis ke produksi, stok terpotong real-time, dan ada peringatan deadline.

### Section 4: Fitur Unggulan (Core Features)
Menampilkan screenshot fitur dengan penjelasan singkat:
1. **Manajemen Order & Kasir:** POS terintegrasi, hitung harga otomatis berdasarkan ukuran dan finishing.
2. **Kanban Produksi (Real-time):** Pantau status antrean mesin dan job desainer seperti Trello.
3. **Manajemen Gudang & Stok:** Multi-lokasi rak, potong stok otomatis berdasarkan pemakaian mesin.
4. **Notifikasi WhatsApp Otomatis:** Kirim resi dan pemberitahuan pesanan selesai langsung ke WA pelanggan.

### Section 5: Harga (Pricing Table)
Tabel perbandingan paket (Sesuai dokumen `SAAS-MODEL.md`):
- **Starter (Rp 299.000/bln):** Cocok untuk percetakan baru (5 User, 200 Order).
- **Pro (Rp 599.000/bln):** Untuk percetakan berkembang (15 User, Unlimited Order).
- **Enterprise:** Untuk skala pabrik / multi-cabang (Custom SLA).
- CTA di setiap tabel paket.

### Section 6: Testimoni (Social Proof)
- Kartu review dari "pengguna awal" (Dummy saat ini) yang menceritakan bagaimana Print Pilot menyelamatkan omset mereka.

### Section 7: FAQ (Tanya Jawab)
Menjawab keraguan umum:
- *Apakah data saya aman?* (Ya, dienkripsi dan diisolasi per toko).
- *Apakah butuh alat khusus?* (Tidak, cukup browser dan internet).
- *Bisa diakses dari HP?* (Ya, desain responsif).

### Section 8: Final CTA (Penutup)
- "Siap untuk merapikan percetakan Anda? Daftar dalam 5 menit."
- Tombol **"Mulai Transformasi Sekarang"**.

### Section 9: Footer
- Tautan ke Syarat & Ketentuan, Kebijakan Privasi, Kontak Bantuan, dan Alamat Kantor.

## 3. Arah Desain — Product-led + Minimalis Kontras

Landing page versi awal memakai pola SaaS generik (hero centered + badge pill + gradient glow + gambar mockup + logo dummy + pricing card neon-glow) yang identik dengan ribuan template Next.js/Tailwind lain di luar sana. Versi ini diarahkan ulang ke dua prinsip:

1. **Product-led, bukan gambar statis:** setiap kali memungkinkan, tunjukkan bagian kecil dari produk yang benar-benar berfungsi (contoh: kalkulator estimasi harga cetak interaktif di hero) — bukan screenshot atau mockup device 3D.
2. **Minimalis kontras:** tipografi besar & tegas, dekorasi seminimal mungkin (tanpa blur-glow neon, tanpa badge pill hero, tanpa logo dummy), banyak whitespace. Memanfaatkan palet 5-warna light mode (lihat `DESIGN-SYSTEM.md`) sebagai identitas — kontras justru didapat dari kesederhanaan, bukan dari efek visual ramai, yang berbeda dari kebanyakan kompetitor SaaS bertema dark-mode neon-gradient.

## 4. Strategi Teknis (Next.js)
- **Route:** Berada di `frontend/src/app/(marketing)/page.tsx` untuk memisahkan layout dari dashboard utama (`(dashboard)`).
- **Performance:** Memanfaatkan Server Components (RSC) Next.js agar landing page memiliki skor Lighthouse 100/100 (Sangat cepat dimuat dan ramah SEO). Komponen interaktif (kalkulator harga) diisolasi sebagai Client Component kecil (`components/marketing/PriceCalculator.tsx`) agar bagian statis halaman tetap RSC.
- **Styling:** Desain flat/editorial sesuai `DESIGN-SYSTEM.md`, animasi *scroll* ringan opsional, tanpa efek glow/neon.
- **Form Pendaftaran:** Terhubung langsung ke alur registrasi multi-step yang ada di `TENANT-ONBOARDING.md`.

---
*Dokumen ini merupakan panduan arsitektur visual dan copywriting untuk saat implementasi Frontend nanti dilakukan.*
