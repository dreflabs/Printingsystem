import { assertJobAuth } from "@/lib/jobs";
import { sendWhatsApp, normalizePhone } from "@/lib/wa";
import { sendEmail } from "@/lib/mail";

export const dynamic = "force-dynamic";

/**
 * POST /api/jobs/test-notification
 *
 * Kirim SATU pesan uji untuk memastikan konfigurasi provider benar, sebelum
 * mengandalkannya untuk notifikasi pelanggan sungguhan. Tanpa ini, konfigurasi
 * yang salah baru ketahuan saat notifikasi pertama diam-diam gagal.
 *
 * Auth: header `Authorization: Bearer <JOBS_SECRET>` — sama dengan job lain.
 *
 *   curl -X POST -H "Authorization: Bearer $JOBS_SECRET" \
 *        -H "Content-Type: application/json" \
 *        -d '{"wa":"08123456789"}' \
 *        http://127.0.0.1:3000/api/jobs/test-notification
 *
 * Body (minimal salah satu):
 *   { "wa": "08123456789" }        kirim WhatsApp uji
 *   { "mail": "kamu@contoh.id" }   kirim email uji
 *
 * Balasannya memuat hasil per kanal beserta pesan error provider apa adanya,
 * supaya penyebabnya kelihatan (token salah, nomor belum terdaftar, domain
 * pengirim belum diverifikasi, dsb).
 *
 * Sengaja hanya menerima tujuan eksplisit dari badan permintaan — endpoint ini
 * tidak bisa dipakai untuk mengirim massal.
 */

type Body = { wa?: unknown; mail?: unknown };

export async function POST(req: Request) {
  const denied = assertJobAuth(req);
  if (denied) return denied;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json(
      { ok: false, error: 'Badan permintaan harus JSON, mis. {"wa":"08123456789"}.' },
      { status: 400 }
    );
  }

  const wa = typeof body.wa === "string" ? body.wa.trim() : "";
  const mail = typeof body.mail === "string" ? body.mail.trim() : "";

  if (!wa && !mail) {
    return Response.json(
      { ok: false, error: 'Sertakan "wa" dan/atau "mail" sebagai tujuan uji.' },
      { status: 400 }
    );
  }

  const stamp = new Date().toISOString();
  const results: Record<string, unknown> = {};

  if (wa) {
    const res = await sendWhatsApp({
      to: wa,
      body:
        `[UJI COBA] Print Pilot\n\n` +
        `Ini pesan uji untuk memastikan konfigurasi WhatsApp sudah benar. ` +
        `Tidak perlu dibalas.\n\n${stamp}`,
    });
    results.wa = {
      provider: process.env.WA_PROVIDER || "generic",
      tujuanDinormalkan: normalizePhone(wa),
      ...res,
    };
  }

  if (mail) {
    const res = await sendEmail({
      to: mail,
      subject: "[UJI COBA] Print Pilot — tes konfigurasi email",
      body:
        `Ini email uji untuk memastikan konfigurasi provider sudah benar. ` +
        `Tidak perlu dibalas.\n\n${stamp}`,
    });
    results.mail = {
      provider: process.env.MAIL_PROVIDER || "generic",
      from: process.env.MAIL_FROM ?? "no-reply@printpilot.id",
      ...res,
    };
  }

  const allOk = Object.values(results).every((r) => (r as { ok?: boolean }).ok === true);
  return Response.json({ ok: allOk, results }, { status: allOk ? 200 : 502 });
}
