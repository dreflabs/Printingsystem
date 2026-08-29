/**
 * Render `template_code` NotificationEvent → isi pesan WhatsApp.
 *
 * Teks mengikuti `04-MODULES/WHATSAPP-NOTIFICATION.md`. Tidak boleh memuat data
 * internal (biaya produksi, nama pegawai, lokasi rak, temuan audit).
 */

export interface TemplateContext {
  customerName: string;
  orderCode: string;
  /** Deskripsi produk yang aman ditampilkan ke konsumen. */
  productDesc: string;
  quantity: number;
}

export function renderNotificationTemplate(code: string, ctx: TemplateContext): string | null {
  const nama = ctx.customerName || "Kak";
  switch (code) {
    case "READY_FOR_PICKUP_PAID":
      return [
        `Halo Kak ${nama} 👋`,
        ``,
        `Pesanan Anda dengan nomor ${ctx.orderCode} sudah selesai dan siap diambil.`,
        ``,
        `🖨️ Pesanan: ${ctx.productDesc}`,
        `📦 Jumlah: ${ctx.quantity} pcs`,
        `✅ Status: SIAP DIAMBIL`,
        ``,
        `Silakan datang ke percetakan dan sebutkan Nomor Order ${ctx.orderCode} atau Nomor HP Anda kepada petugas kami untuk pengambilan pesanan.`,
        ``,
        `Terima kasih 🙏`,
      ].join("\n");
    case "READY_FOR_PICKUP_UNPAID":
      return [
        `Halo Kak ${nama} 👋`,
        ``,
        `Pesanan ${ctx.orderCode} sudah selesai dan tersimpan di percetakan.`,
        ``,
        `🖨️ Pesanan: ${ctx.productDesc}`,
        `💳 Status pembayaran: MENUNGGU PELUNASAN`,
        ``,
        `Pesanan dapat diambil setelah pelunasan sesuai ketentuan percetakan. Saat pengambilan, sebutkan Nomor Order ${ctx.orderCode} atau Nomor HP Anda.`,
      ].join("\n");
    default:
      return null;
  }
}
