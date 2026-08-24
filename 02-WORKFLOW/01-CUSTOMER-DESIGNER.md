# Konsumen Langsung ke Designer

Selain lewat Admin, konsumen boleh langsung menghubungi/mendatangi **Designer Sales** untuk membahas kebutuhan desain — ini wajar terjadi karena Designer sering jadi titik kontak pertama soal kebutuhan kreatif. Alur ini tetap harus mengikuti prosedur resmi di bawah, supaya tetap profesional dan aman — **tidak boleh ada transaksi yang tidak tercatat di sistem**.

## Langkah 1 — Kontak Langsung

Konsumen datang atau menghubungi Designer secara langsung, mendiskusikan kebutuhan desain (produk, referensi, gaya).

## Langkah 2 — Designer Buat Draft Order

Designer wajib input ke sistem sebelum mengerjakan apa pun, mengisi:
- Identitas konsumen (nama, no. HP, email)
- Produk + spesifikasi (ukuran, jumlah, bahan, finishing)
- Deadline
- Referensi/brief desain

Sistem simpan sebagai order berstatus **DRAFT**, dibuat oleh akun Designer yang login (tercatat di audit log).

> **Proteksi data:** begitu nomor HP/email konsumen disimpan, field tersebut langsung ter-*mask* dari tampilan Designer sendiri (write-once, no-read-back) — konsisten dengan aturan bahwa Designer dilarang melihat kontak konsumen (`03-ROLES/DESIGNER-SALES.md`).

## Langkah 3 — Proses Desain

Designer kerjakan/upload desain seperti alur normal (lihat `03-DESIGN-APPROVAL.md`) — untuk konsumen walk-in, approval bisa langsung di tempat.

## Langkah 4 — Checkpoint Wajib: Arahkan ke Admin

Status order **tidak bisa** berpindah ke `WAITING_PAYMENT` atau `CONFIRMED` oleh Designer. Setelah desain disetujui, Designer mengarahkan konsumen ke Admin/counter untuk proses DP — dibingkai sebagai "langkah terakhir sebelum order masuk produksi", bukan sebagai konsumen "dioper-oper" atau dicurigai.

**Designer tidak pernah memegang uang atau mengonfirmasi nominal pembayaran dalam kondisi apa pun.**

## Langkah 5 — Admin Konfirmasi Pembayaran

Hanya Admin yang berwenang mengubah status jadi `CONFIRMED` setelah DP diterima (lihat `04-PAYMENT.md`). Order baru resmi masuk antrian produksi setelah langkah ini.

## Kenapa Alur Ini Aman

- **Separation of duties:** Designer memegang sisi kreatif, Admin memegang sisi finansial — tidak pernah satu orang memegang keduanya untuk order yang sama.
- **Audit trail dua-aktor:** order tercatat dibuat oleh Designer, dikonfirmasi oleh Admin — dua identitas berbeda di `audit_logs`.
- **Deteksi anomali:** Draft order yang dibuat seorang Designer tapi tidak kunjung dikonfirmasi Admin dalam waktu wajar adalah sinyal yang perlu dipantau Owner — masuk kategori yang sama dengan panel "Anomali & Kecurangan" di Owner Dashboard.
- **Larangan tegas:** transaksi langsung/tunai di luar sistem antara konsumen dan Designer **tidak diperbolehkan** dalam kondisi apa pun, termasuk untuk order kecil atau konsumen langganan.
