import { prisma } from "@/lib/prisma";
import { assertJobAuth, runJob } from "@/lib/jobs";
import { sendWhatsApp } from "@/lib/wa";
import { sendEmail } from "@/lib/mail";
import { renderNotificationTemplate } from "@/lib/notification-templates";

export const dynamic = "force-dynamic";

/**
 * POST/GET /api/jobs/dispatch-notifications
 *
 * Memproses antrian `NotificationEvent` (status PENDING / RETRY) → kirim WhatsApp
 * lewat provider abstraction. Retry otomatis maks. 3x dengan jeda >= 5 menit
 * (`04-MODULES/WHATSAPP-NOTIFICATION.md`). Setelah gagal permanen: status FAILED
 * + email fallback ke Admin/Owner (nomor HP konsumen hanya untuk Admin).
 *
 * Auth: header `Authorization: Bearer <JOBS_SECRET>`.
 */

const BATCH_LIMIT = 50;
const MAX_ATTEMPTS = 4; // 1 kirim awal + 3 retry
const RETRY_DELAY_MS = 5 * 60 * 1000;

async function handle(): Promise<Response> {
  return runJob("dispatch-notifications", async () => {
    const now = new Date();
    const retryCutoff = new Date(now.getTime() - RETRY_DELAY_MS);

    const events = await prisma.notificationEvent.findMany({
      where: {
        channel: "WHATSAPP",
        OR: [
          { status: "PENDING" },
          {
            status: "RETRY",
            retry_count: { lt: MAX_ATTEMPTS },
            OR: [{ last_attempt_at: null }, { last_attempt_at: { lte: retryCutoff } }],
          },
        ],
      },
      orderBy: { created_at: "asc" },
      take: BATCH_LIMIT,
      include: {
        order: { include: { items: { include: { product: true } } } },
        customer: true,
      },
    });

    let sent = 0;
    let retried = 0;
    let failed = 0;
    let skipped = 0;

    for (const evt of events) {
      const items = evt.order.items;
      const productDesc =
        items
          .map((it) => it.description || it.product?.name)
          .filter(Boolean)
          .slice(0, 2)
          .join(", ") || "Pesanan cetak";
      const quantity = items.reduce((s, it) => s + (it.quantity ?? 0), 0) || 0;

      const body = renderNotificationTemplate(evt.template_code, {
        customerName: evt.customer?.name ?? "",
        orderCode: evt.order.order_code,
        productDesc,
        quantity,
      });

      if (!body) {
        // Template tidak dikenal — jangan retry selamanya.
        await prisma.notificationEvent.update({
          where: { id: evt.id },
          data: {
            status: "FAILED",
            error_message: `Template tidak dikenal: ${evt.template_code}`,
            last_attempt_at: now,
          },
        });
        skipped++;
        continue;
      }

      const res = await sendWhatsApp({ to: evt.recipient, body });
      const attempts = evt.retry_count + 1;

      if (res.ok) {
        await prisma.notificationEvent.update({
          where: { id: evt.id },
          data: {
            status: "SENT",
            provider_message_id: res.providerMessageId ?? null,
            error_message: null,
            sent_at: now,
            last_attempt_at: now,
            retry_count: attempts,
          },
        });
        sent++;
        continue;
      }

      const permanent = attempts >= MAX_ATTEMPTS;
      await prisma.notificationEvent.update({
        where: { id: evt.id },
        data: {
          status: permanent ? "FAILED" : "RETRY",
          error_message: res.error ?? "Gagal tanpa pesan error.",
          last_attempt_at: now,
          retry_count: attempts,
        },
      });

      if (permanent) {
        failed++;
        await emailAdminFallback(evt.tenant_id, {
          customerName: evt.customer?.name ?? "-",
          orderCode: evt.order.order_code,
          customerPhone: evt.recipient,
          error: res.error ?? "-",
          body,
        });
      } else {
        retried++;
      }
    }

    return { scanned: events.length, sent, retried, failed, skipped };
  });
}

async function emailAdminFallback(
  tenantId: string,
  info: { customerName: string; orderCode: string; customerPhone: string; error: string; body: string }
) {
  try {
    const admins = await prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        active: true,
        role: { name: { in: ["owner", "admin"] } },
      },
      select: { email: true },
    });
    const recipients = [...new Set(admins.map((a) => a.email).filter((e) => !!e && e.includes("@")))];
    if (recipients.length === 0) return;

    const subject = `[PrintPilot] Notifikasi WA gagal — Order ${info.orderCode}`;
    const text = [
      `Notifikasi WhatsApp otomatis gagal terkirim setelah beberapa percobaan.`,
      ``,
      `Konsumen  : ${info.customerName}`,
      `Order     : ${info.orderCode}`,
      `Nomor HP  : ${info.customerPhone}`,
      `Error     : ${info.error}`,
      ``,
      `Isi pesan yang gagal:`,
      info.body,
      ``,
      `Silakan kirim ulang lewat tombol "Kirim Ulang" di dashboard.`,
    ].join("\n");

    for (const to of recipients) {
      await sendEmail({ to, subject, body: text });
    }
  } catch (e) {
    console.error("[JOB:dispatch-notifications] email fallback gagal:", e);
  }
}

export async function POST(req: Request) {
  const denied = assertJobAuth(req);
  if (denied) return denied;
  return handle();
}

export async function GET(req: Request) {
  const denied = assertJobAuth(req);
  if (denied) return denied;
  return handle();
}
