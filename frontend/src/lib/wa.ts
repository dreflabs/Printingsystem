/**
 * Abstraction layer pengiriman WhatsApp.
 *
 * Core workflow TIDAK PERNAH meng-import provider langsung — hanya lewat
 * `sendWhatsApp()`. Provider nyata (Fonnte / Wablas / WA Business API) dipilih
 * saat deploy via environment variable, bukan di kode.
 *
 *   WA_PROVIDER_URL    endpoint POST provider
 *   WA_PROVIDER_TOKEN  bearer token / api key provider
 *
 * Tanpa dua env itu: mode SIMULASI (dev) — pesan ditulis ke stdout dan dianggap
 * terkirim, supaya alur bisa dites end-to-end tanpa kredensial pihak ketiga.
 * Di produksi tanpa env → kembalikan gagal (tidak melempar).
 */

export interface WaMessage {
  /** Nomor tujuan (format lokal 08xx atau E.164). */
  to: string;
  /** Isi pesan yang sudah ter-render dari template. */
  body: string;
}

export interface WaSendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export async function sendWhatsApp(msg: WaMessage): Promise<WaSendResult> {
  const url = process.env.WA_PROVIDER_URL;
  const token = process.env.WA_PROVIDER_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "WA_PROVIDER_URL / WA_PROVIDER_TOKEN belum diset." };
    }
    console.log(`[WA:SIMULASI] → ${msg.to}\n${msg.body}\n`);
    return { ok: true, providerMessageId: `sim_${Date.now()}` };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ target: msg.to, message: msg.body }),
      signal: AbortSignal.timeout(15_000),
    });
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: `Provider HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}` };
    }
    const d = (data ?? {}) as Record<string, unknown>;
    const id = d.id ?? d.message_id ?? d.messageId ?? d.provider_message_id;
    return { ok: true, providerMessageId: id ? String(id) : undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghubungi provider WA." };
  }
}
