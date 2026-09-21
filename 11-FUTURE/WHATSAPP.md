# WhatsApp Integration (Future Enhancement)

Status: **DIPINDAH ke 04-MODULES/WHATSAPP-NOTIFICATION.md**

WhatsApp Notification sudah diangkat menjadi fitur inti (bukan future).
Lihat spesifikasi lengkap di: `04-MODULES/WHATSAPP-NOTIFICATION.md`

## Yang Masih Menjadi Future

- **WhatsApp Business API resmi (Meta/BSP)**: Jika saat ini menggunakan provider informal (Fonnte/Wablas), migrasi ke WABA resmi bisa dilakukan di masa depan tanpa mengubah core system karena sudah menggunakan abstraction layer.
- **WhatsApp chatbot / 2-way communication**: Konsumen bisa reply WA untuk tracking order mandiri (Phase 2+).
- **Broadcast promo**: Kirim promo ke konsumen lama via WhatsApp (butuh template approved oleh Meta).
- **Kuota `whatsapp_unlimited` (ditunda 2026-09-21)**: kunci `whatsapp_unlimited` sudah ada di katalog (Pro/Business) tetapi **belum ditegakkan** — belum ada penghitung kuota maupun gate-nya, sehingga Starter saat ini efektif mendapat WhatsApp tanpa batas. Dikerjakan bersamaan saat provider WhatsApp produksi benar-benar aktif, karena:
  - butuh sumber hitungan yang stabil (mis. jumlah `NotificationEvent` per bulan per tenant);
  - perlu keputusan produk soal angka kuota dasar Starter dan perilaku saat kuota habis (antre, tolak, atau jatuh ke email);
  - menyentuh alur kirim yang sekarang best-effort + retry, jadi gate tidak boleh menggagalkan notifikasi yang sedang berjalan.
  Rujukan penegakan entitlement: `09-TECHNICAL/ENTITLEMENT-GATING.md`.
