/**
 * Abstraction layer pengiriman WhatsApp.
 *
 * Core workflow TIDAK PERNAH meng-import provider langsung — hanya lewat
 * `sendWhatsApp()`. Provider nyata dipilih saat deploy lewat environment
 * variable, bukan di kode.
 *
 *   WA_PROVIDER        fonnte | wablas | meta | generic
 *   WA_PROVIDER_URL    endpoint (punya default untuk fonnte)
 *   WA_PROVIDER_TOKEN  token / api key provider
 *
 * Tanpa token: mode SIMULASI (non-produksi) — pesan ditulis ke stdout dan
 * dianggap terkirim, supaya alur bisa dites tanpa kredensial pihak ketiga.
 * Di produksi tanpa konfigurasi → kembalikan gagal (tidak melempar).
 *
 * CATATAN PENTING — kenapa tiap provider butuh adapter sendiri:
 * bentuk header, badan permintaan, dan cara melaporkan gagal berbeda-beda.
 * Fonnte dan Wablas memakai `Authorization: <token>` TANPA prefiks "Bearer",
 * dan keduanya membalas **HTTP 200 walaupun pengiriman gagal** dengan
 * `{"status": false, "reason": "..."}` di badan respons. Memakai satu bentuk
 * generik untuk semuanya akan menghasilkan 401 diam-diam atau, lebih buruk,
 * kegagalan yang tercatat sebagai sukses.
 *
 * API pihak ketiga bisa berubah. Setelah mengatur env, kirim satu pesan uji
 * lewat `POST /api/jobs/test-notification` sebelum mengandalkannya.
 */

export interface WaMessage {
  /** Nomor tujuan, format lokal (08xx) maupun E.164 — dinormalkan di sini. */
  to: string;
  /** Isi pesan yang sudah ter-render dari template. */
  body: string;
}

export interface WaSendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

type WaProvider = "fonnte" | "wablas" | "meta" | "generic";

const DEFAULT_URL: Partial<Record<WaProvider, string>> = {
  fonnte: "https://api.fonnte.com/send",
};

function resolveProvider(): WaProvider {
  const v = (process.env.WA_PROVIDER ?? "").trim().toLowerCase();
  if (v === "fonnte" || v === "wablas" || v === "meta" || v === "generic") return v;
  // Kompatibilitas mundur: konfigurasi lama hanya punya URL + token.
  return "generic";
}

/**
 * Normalkan nomor Indonesia ke bentuk `628…` tanpa tanda plus.
 *
 * Nomor di database tersimpan apa adanya dari input pengguna (`08123…`,
 * `+62 812-3456`, dst). Fonnte dan Wablas memang menerima `08xx`, tapi Meta
 * Cloud API mewajibkan kode negara — jadi satu bentuk yang aman untuk semua.
 */
export function normalizePhone(raw: string): string {
  const digits = (raw ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

/** Ambil id pesan dari bentuk respons yang berbeda-beda antar provider. */
function pickId(d: Record<string, unknown>): string | undefined {
  const direct = d.id ?? d.message_id ?? d.messageId ?? d.provider_message_id;
  if (direct != null && !Array.isArray(direct)) return String(direct);
  // Fonnte membalas `id` sebagai array.
  if (Array.isArray(direct) && direct.length > 0) return String(direct[0]);
  // Meta: { messages: [{ id }] }
  const messages = d.messages;
  if (Array.isArray(messages) && messages.length > 0) {
    const first = messages[0] as Record<string, unknown> | undefined;
    if (first?.id != null) return String(first.id);
  }
  return undefined;
}

interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

function buildRequest(
  provider: WaProvider,
  url: string,
  token: string,
  to: string,
  body: string
): ProviderRequest {
  switch (provider) {
    case "fonnte":
      // Fonnte: token polos di Authorization, tanpa "Bearer".
      return {
        url,
        headers: { "Content-Type": "application/json", Authorization: token },
        body: JSON.stringify({ target: to, message: body }),
      };

    case "wablas":
      // Wablas: token polos juga, tapi field-nya `phone`, bukan `target`.
      return {
        url,
        headers: { "Content-Type": "application/json", Authorization: token },
        body: JSON.stringify({ phone: to, message: body }),
      };

    case "meta":
      // WhatsApp Cloud API: Bearer, dan badan bersarang.
      // URL memuat phone number id, mis.
      // https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages
      return {
        url,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: false, body },
        }),
      };

    case "generic":
    default:
      return {
        url,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ target: to, message: body }),
      };
  }
}

/**
 * Sebagian provider membalas HTTP 200 untuk kegagalan logis. Kembalikan
 * alasannya bila respons sebenarnya gagal, atau null bila benar sukses.
 */
function logicalFailure(provider: WaProvider, d: Record<string, unknown>): string | null {
  if (provider === "fonnte" || provider === "wablas" || provider === "generic") {
    // `status: false` = gagal. Sebagian versi Wablas mengirim string "false".
    const status = d.status;
    if (status === false || status === "false") {
      const reason = d.reason ?? d.message ?? d.detail;
      return reason ? String(reason) : "Provider menolak pesan (status: false).";
    }
  }
  if (d.error != null) {
    const err = d.error as Record<string, unknown> | string;
    if (typeof err === "string") return err;
    return String(err.message ?? JSON.stringify(err).slice(0, 200));
  }
  return null;
}

export async function sendWhatsApp(msg: WaMessage): Promise<WaSendResult> {
  const provider = resolveProvider();
  const token = process.env.WA_PROVIDER_TOKEN;
  const url = process.env.WA_PROVIDER_URL || DEFAULT_URL[provider];

  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        error: "WA_PROVIDER_URL / WA_PROVIDER_TOKEN belum diset.",
      };
    }
    console.log(`[WA:SIMULASI:${provider}] → ${normalizePhone(msg.to)}\n${msg.body}\n`);
    return { ok: true, providerMessageId: `sim_${Date.now()}` };
  }

  const to = normalizePhone(msg.to);
  if (!to) return { ok: false, error: `Nomor tujuan tidak valid: "${msg.to}".` };

  const req = buildRequest(provider, url, token, to, msg.body);

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
      const detail = logicalFailure(provider, d) ?? JSON.stringify(d).slice(0, 300);
      return { ok: false, error: `Provider HTTP ${res.status}: ${detail}` };
    }

    // HTTP 200 belum tentu terkirim — periksa badan responsnya.
    const failure = logicalFailure(provider, d);
    if (failure) return { ok: false, error: `Provider menolak: ${failure}` };

    return { ok: true, providerMessageId: pickId(d) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghubungi provider WA." };
  }
}
