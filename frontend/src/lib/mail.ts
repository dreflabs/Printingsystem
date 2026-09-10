/**
 * Abstraction layer pengiriman email (fallback ke Admin saat WA gagal,
 * tautan reset password, dsb).
 *
 *   MAIL_PROVIDER        resend | brevo | generic
 *   MAIL_PROVIDER_URL    endpoint (punya default untuk resend & brevo)
 *   MAIL_PROVIDER_TOKEN  api key
 *   MAIL_FROM            alamat pengirim (harus domain terverifikasi di provider)
 *
 * Tanpa token: mode SIMULASI (non-produksi) — email ditulis ke stdout dan
 * dianggap terkirim. Di produksi tanpa konfigurasi → kembalikan gagal.
 *
 * Seperti pada `wa.ts`, tiap provider punya bentuk header dan badan sendiri:
 * Resend memakai `Authorization: Bearer`, Brevo memakai header `api-key` dan
 * struktur penerima bersarang. Uji lewat `POST /api/jobs/test-notification`
 * setelah mengatur env.
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

type MailProvider = "resend" | "brevo" | "generic";

const DEFAULT_URL: Partial<Record<MailProvider, string>> = {
  resend: "https://api.resend.com/emails",
  brevo: "https://api.brevo.com/v3/smtp/email",
};

function resolveProvider(): MailProvider {
  const v = (process.env.MAIL_PROVIDER ?? "").trim().toLowerCase();
  if (v === "resend" || v === "brevo" || v === "generic") return v;
  return "generic"; // kompatibilitas mundur dengan konfigurasi lama
}

function buildRequest(
  provider: MailProvider,
  url: string,
  token: string,
  from: string,
  msg: MailMessage
): { url: string; headers: Record<string, string>; body: string } {
  switch (provider) {
    case "resend":
      return {
        url,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.body }),
      };

    case "brevo":
      // Brevo memakai header `api-key`, bukan Authorization.
      return {
        url,
        headers: { "Content-Type": "application/json", accept: "application/json", "api-key": token },
        body: JSON.stringify({
          sender: { email: from },
          to: [{ email: msg.to }],
          subject: msg.subject,
          textContent: msg.body,
        }),
      };

    case "generic":
    default:
      return {
        url,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ from, to: msg.to, subject: msg.subject, text: msg.body }),
      };
  }
}

export async function sendEmail(msg: MailMessage): Promise<MailSendResult> {
  const provider = resolveProvider();
  const token = process.env.MAIL_PROVIDER_TOKEN;
  const url = process.env.MAIL_PROVIDER_URL || DEFAULT_URL[provider];
  const from = process.env.MAIL_FROM ?? "no-reply@printpilot.id";

  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "MAIL_PROVIDER_URL / MAIL_PROVIDER_TOKEN belum diset." };
    }
    console.log(`[MAIL:SIMULASI:${provider}] → ${msg.to}\nSubjek: ${msg.subject}\n${msg.body}\n`);
    return { ok: true, providerMessageId: `sim_${Date.now()}` };
  }

  const req = buildRequest(provider, url, token, from, msg);

  try {
    const res = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: req.body,
      signal: AbortSignal.timeout(15_000),
    });

    const data: unknown = await res.json().catch(() => ({}));
    const d = (data ?? {}) as Record<string, unknown>;

    if (!res.ok) {
      // Resend: { message }, Brevo: { message } / { error }.
      const detail = d.message ?? d.error ?? JSON.stringify(d).slice(0, 300);
      return { ok: false, error: `Provider HTTP ${res.status}: ${String(detail).slice(0, 300)}` };
    }

    const id = d.id ?? d.messageId ?? d.message_id;
    return { ok: true, providerMessageId: id != null ? String(id) : undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghubungi provider email." };
  }
}
