# WhatsApp Customer Notification Workflow

## Objective

Automatically notify the customer when the physical order has been completed, stored, and is genuinely ready for pickup/delivery.

## Trigger

The notification must NOT trigger merely because production or finishing is marked complete.

Correct trigger:

QC PASS
-> FINISHING COMPLETE
-> JOB QR/BARCODE SCANNED
-> STORAGE LOCATION QR SCANNED
-> STORAGE SUCCESS
-> STATUS READY_FOR_PICKUP / READY_FOR_DELIVERY
-> NOTIFICATION TRIGGER

## Pickup message

Example:

Halo Kak Ahmad 👋

Pesanan Anda dengan nomor ORD-260814-001 sudah selesai dan sudah siap diambil.

📦 Pesanan: Banner 3×1 Meter
🔢 Jumlah: 10 pcs
📍 Status: SIAP DIAMBIL

Silakan datang ke percetakan untuk pengambilan pesanan.

Terima kasih 🙏

## Outstanding payment message

If the order is ready but still has an outstanding balance, use a different message:

Halo Kak Ahmad 👋

Pesanan ORD-260814-001 sudah selesai dan sudah tersimpan di percetakan.

📦 Pesanan: Banner 3×1 Meter
💰 Status pembayaran: MENUNGGU PELUNASAN

Pesanan dapat diambil setelah proses pembayaran sesuai ketentuan percetakan.

## Delivery message

For delivery:

Pesanan ORD-260814-001 sudah selesai dan sedang diproses untuk pengiriman.

Kurir: [nama]
Resi/Tracking: [nomor]

## Notification rules

- Store notification event in database.
- Store sent_at, recipient, template, provider response, and status.
- Prevent duplicate messages unless a resend is explicitly requested.
- Failed notification must be visible to admin.
- Notification failure must NOT change physical storage status.
- Do not expose sensitive internal cost or audit information to customer.

## Future integration

WhatsApp Business API/provider should be connected in a separate integration layer.
The core workflow must remain functional even if WhatsApp is temporarily unavailable.
