/**
 * Abstraksi penyimpanan objek: Cloudflare R2 di produksi, folder lokal saat
 * dikembangkan tanpa kredensial R2.
 *
 * Pilihan mode (urutan):
 *   1. `STORAGE_DRIVER=local` → paksa lokal, walau env R2_* terisi. Dipakai saat
 *      dev: kredensial R2 produksi ada di `.env` tapi CORS bucket tidak
 *      mengizinkan origin localhost, jadi PUT langsung dari browser gagal.
 *   2. `STORAGE_DRIVER=r2`    → paksa R2 (butuh env R2_* lengkap, else "none").
 *   3. auto: R2 bila terkonfigurasi; selain itu lokal bila bukan produksi
 *      (atau `ALLOW_LOCAL_STORAGE=1`); selain itu "none".
 *
 * Mode "local" menulis/membaca file lewat route `/api/local-storage/*` ke
 * `LOCAL_STORAGE_DIR` (default `.local-storage/`). Route itu hanya aktif saat
 * mode "local", jadi tidak ada permukaan baru di produksi. "none" → upload
 * ditolak.
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import {
  r2Configured,
  presignPut as r2PresignPut,
  presignGet as r2PresignGet,
  deleteR2Objects,
} from "./r2";

export type StorageMode = "r2" | "local" | "none";

function localAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_LOCAL_STORAGE === "1"
  );
}

export function storageMode(): StorageMode {
  const forced = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (forced === "local") return "local";
  if (forced === "r2") return r2Configured() ? "r2" : "none";
  if (r2Configured()) return "r2";
  if (localAllowed()) return "local";
  return "none";
}

/** Ada backend penyimpanan yang bisa dipakai (R2 atau lokal). */
export function storageReady(): boolean {
  return storageMode() !== "none";
}

export const LOCAL_STORAGE_DIR =
  process.env.LOCAL_STORAGE_DIR?.trim() ||
  path.join(process.cwd(), ".local-storage");

const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9/_.\-]{0,300}$/;

/** Validasi object key — cegah path traversal & karakter aneh. */
export function assertSafeKey(key: string): string {
  const k = key.replace(/^\/+/, "");
  if (!KEY_RE.test(k) || k.includes("..") || k.includes("//")) {
    throw new Error("Object key tidak valid.");
  }
  return k;
}

export function localPathFor(key: string): string {
  return path.join(LOCAL_STORAGE_DIR, assertSafeKey(key));
}

/** URL yang dipakai browser untuk meng-upload (PUT) file. */
export async function presignPutUrl(key: string, expiresSec = 300): Promise<string> {
  if (storageMode() === "local") {
    const safe = assertSafeKey(key).split("/").map(encodeURIComponent).join("/");
    return `/api/local-storage/${safe}`;
  }
  return r2PresignPut(key, expiresSec);
}

/**
 * Response untuk menyajikan objek ke browser:
 * - R2   → redirect ke presigned GET berumur pendek.
 * - lokal → stream isi file dari disk.
 */
export async function serveObject(
  key: string,
  opts: {
    fileName?: string;
    disposition?: "inline" | "attachment";
    expiresSec?: number;
  } = {}
): Promise<Response> {
  if (storageMode() === "local") {
    const buf = await fs.readFile(localPathFor(key)).catch(() => null);
    if (!buf) {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
    }
    const headers = new Headers();
    headers.set("Content-Type", contentTypeFor(key));
    headers.set("Cache-Control", "private, max-age=60");
    if (opts.disposition === "attachment") {
      const name = (opts.fileName ?? "file").replace(/[^\w.\-]+/g, "_") || "file";
      headers.set("Content-Disposition", `attachment; filename="${name}"`);
    }
    return new NextResponse(new Uint8Array(buf), { headers });
  }
  const signed = await r2PresignGet(key, opts);
  return NextResponse.redirect(signed);
}

/** Tulis objek ke penyimpanan lokal. */
export async function writeLocalObject(
  key: string,
  body: ArrayBuffer | Uint8Array
): Promise<void> {
  const p = localPathFor(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, Buffer.from(body as ArrayBuffer));
}

/** Hapus objek — R2 atau lokal sesuai mode. */
export async function deleteObjects(
  keys: string[]
): Promise<{ deleted: number; failed: number }> {
  if (keys.length === 0) return { deleted: 0, failed: 0 };
  if (storageMode() === "local") {
    let deleted = 0;
    let failed = 0;
    for (const k of keys) {
      try {
        await fs.unlink(localPathFor(k));
        deleted++;
      } catch (e) {
        if ((e as NodeJS.ErrnoException)?.code === "ENOENT") deleted++;
        else failed++;
      }
    }
    return { deleted, failed };
  }
  return deleteR2Objects(keys);
}

function contentTypeFor(key: string): string {
  const ext = key.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    tif: "image/tiff",
    tiff: "image/tiff",
    ai: "application/postscript",
    eps: "application/postscript",
    psd: "image/vnd.adobe.photoshop",
    cdr: "application/octet-stream",
  };
  return map[ext] ?? "application/octet-stream";
}
