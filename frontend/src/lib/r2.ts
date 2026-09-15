/**
 * Cloudflare R2 (S3-compatible) — presigned URL untuk upload/unduh file desain
 * langsung dari browser, tanpa file melewati server Next.js.
 *
 * Env (set di Coolify):
 *   R2_ACCOUNT_ID          <account id Cloudflare>
 *   R2_ACCESS_KEY_ID       token R2 (Object Read & Write)
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET              nama bucket, mis. printpilot-designs
 *   DESIGN_MAX_UPLOAD_MB   opsional, default 200
 *
 * Bucket harus PRIVATE. Akses baca lewat presigned GET berumur pendek yang
 * dikeluarkan route handler setelah cek sesi (src/app/api/design/[versionId]).
 * CORS bucket wajib mengizinkan PUT & GET dari origin aplikasi (lihat DEPLOY.md).
 */

import { AwsClient } from "aws4fetch";

export const DESIGN_MAX_UPLOAD_BYTES =
  Math.max(1, Number(process.env.DESIGN_MAX_UPLOAD_MB) || 200) * 1024 * 1024;

/** Ekstensi file desain yang diterima (print-ready + gambar). */
export const DESIGN_ALLOWED_EXT = [
  "pdf", "ai", "cdr", "eps", "svg", "psd",
  "png", "jpg", "jpeg", "webp", "tif", "tiff",
];

function env() {
  return {
    accountId: process.env.R2_ACCOUNT_ID?.trim() ?? "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID?.trim() ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "",
    bucket: process.env.R2_BUCKET?.trim() ?? "",
  };
}

export function r2Configured(): boolean {
  const e = env();
  return !!(e.accountId && e.accessKeyId && e.secretAccessKey && e.bucket);
}

function client() {
  const e = env();
  return {
    aws: new AwsClient({
      accessKeyId: e.accessKeyId,
      secretAccessKey: e.secretAccessKey,
      service: "s3",
      region: "auto",
    }),
    base: `https://${e.accountId}.r2.cloudflarestorage.com/${e.bucket}`,
  };
}

/** Presigned PUT — browser meng-upload body file langsung ke URL ini. */
export async function presignPut(objectKey: string, expiresSec = 300): Promise<string> {
  const { aws, base } = client();
  const url = `${base}/${objectKey}?X-Amz-Expires=${expiresSec}`;
  const signed = await aws.sign(url, { method: "PUT", aws: { signQuery: true } });
  return signed.url;
}

/**
 * Presigned GET — dipakai route handler untuk redirect setelah cek sesi.
 * `disposition`: "inline" untuk pratinjau di browser, "attachment" untuk unduh.
 */
export async function presignGet(
  objectKey: string,
  opts: { expiresSec?: number; fileName?: string; disposition?: "inline" | "attachment" } = {}
): Promise<string> {
  const { aws, base } = client();
  const expiresSec = opts.expiresSec ?? 120;
  let qs = `X-Amz-Expires=${expiresSec}`;
  // Hanya set Content-Disposition untuk unduh paksa. Nama file dinormalkan jadi
  // token RFC 6266 tanpa spasi/tanda kutip → tak ada ambiguitas '+' vs '%20'
  // saat aws4fetch mengkanonikalkan query untuk tanda tangan.
  if (opts.disposition === "attachment") {
    const name = (opts.fileName ?? "file").replace(/[^\w.\-]+/g, "_") || "file";
    qs += `&response-content-disposition=${encodeURIComponent(`attachment;filename=${name}`)}`;
  }
  const signed = await aws.sign(`${base}/${objectKey}?${qs}`, {
    method: "GET",
    aws: { signQuery: true },
  });
  return signed.url;
}

/** Hapus objek (best-effort). Dipakai purgeTenant untuk membersihkan file tenant. */
export async function deleteR2Objects(objectKeys: string[]): Promise<{ deleted: number; failed: number }> {
  if (!r2Configured() || objectKeys.length === 0) return { deleted: 0, failed: 0 };
  const { aws, base } = client();
  let deleted = 0;
  let failed = 0;
  for (const key of objectKeys) {
    try {
      const res = await aws.fetch(`${base}/${key}`, { method: "DELETE" });
      if (res.ok || res.status === 404) deleted++;
      else failed++;
    } catch {
      failed++;
    }
  }
  return { deleted, failed };
}

/** Ekstensi lower-case dari nama file, atau "" bila tidak ada. */
export function fileExt(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1]!.toLowerCase() : "";
}
