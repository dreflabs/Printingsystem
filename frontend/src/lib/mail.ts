/**
 * Abstraction layer pengiriman email (fallback ke Admin saat WA gagal, dsb).
 *
 *   MAIL_PROVIDER_URL    endpoint POST provider (mis. Resend / SMTP-bridge)
 *   MAIL_PROVIDER_TOKEN  bearer token / api key
 *   MAIL_FROM            alamat pengirim
 *
 * Tanpa env: mode SIMULASI (dev) — email ditulis ke stdout, dianggap terkirim.
 * Di produksi tanpa env → kembalikan gagal (tidak melempar).
 */

export interface MailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface MailSendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export async function sendEmail(msg: MailMessage): Promise<MailSendResult> {
  const url = process.env.MAIL_PROVIDER_URL;
  const token = process.env.MAIL_PROVIDER_TOKEN;
  const from = process.env.MAIL_FROM ?? "no-reply@printpilot.id";

  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "MAIL_PROVIDER_URL / MAIL_PROVIDER_TOKEN belum diset." };
    }
    console.log(`[MAIL:SIMULASI] → ${msg.to}\nSubjek: ${msg.subject}\n${msg.body}\n`);
    return { ok: true, providerMessageId: `sim_${Date.now()}` };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ from, to: msg.to, subject: msg.subject, text: msg.body }),
      signal: AbortSignal.timeout(15_000),
    });
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: `Provider HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}` };
    }
    const d = (data ?? {}) as Record<string, unknown>;
    const id = d.id ?? d.message_id ?? d.messageId;
    return { ok: true, providerMessageId: id ? String(id) : undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghubungi provider email." };
  }
}
