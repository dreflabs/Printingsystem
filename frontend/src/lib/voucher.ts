import { prisma } from "@/lib/prisma";

export type VoucherDiscountType = "PERCENT" | "FIXED";

export interface VoucherRecord {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  valid_from: Date | null;
  valid_until: Date | null;
  active: boolean;
}

export type VoucherCheck =
  | { ok: true; voucher: VoucherRecord; discountAmount: number; label: string }
  | { ok: false; error: string };

export function normalizeVoucherCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Diskon tidak pernah melebihi subtotal dan selalu bilangan bulat rupiah. */
export function computeVoucherDiscount(
  voucher: { discount_type: string; discount_value: number | string },
  subtotal: number,
): number {
  const base = Math.max(0, Math.round(subtotal));
  const value = Number(voucher.discount_value);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const raw = voucher.discount_type === "PERCENT" ? (base * value) / 100 : value;
  return Math.max(0, Math.min(Math.round(raw), base));
}

export function voucherLabel(voucher: { discount_type: string; discount_value: number | string }): string {
  const value = Number(voucher.discount_value);
  if (voucher.discount_type === "PERCENT") {
    return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
  }
  return `Rp${Math.round(value).toLocaleString("id-ID")}`;
}

function windowError(voucher: { valid_from: Date | null; valid_until: Date | null }, now: Date): string | null {
  if (voucher.valid_from && voucher.valid_from > now) return "Voucher belum berlaku.";
  if (voucher.valid_until && voucher.valid_until < now) return "Voucher sudah kedaluwarsa.";
  return null;
}

/**
 * Validasi kode voucher terhadap subtotal. Sumber tunggal untuk wizard
 * pendaftaran, halaman billing Owner, dan generator invoice — supaya aturan
 * tidak berbeda antar jalur.
 */
export async function validateVoucher(
  code: string,
  subtotal: number,
  now: Date = new Date(),
): Promise<VoucherCheck> {
  const normalized = normalizeVoucherCode(code);
  if (!normalized) return { ok: false, error: "Kode voucher kosong." };

  const row = await prisma.voucher.findUnique({ where: { code: normalized } });
  if (!row) return { ok: false, error: "Kode voucher tidak ditemukan." };
  if (!row.active) return { ok: false, error: "Voucher sudah tidak aktif." };

  const expired = windowError(row, now);
  if (expired) return { ok: false, error: expired };
  if (row.max_uses != null && row.used_count >= row.max_uses) {
    return { ok: false, error: "Kuota pemakaian voucher sudah habis." };
  }

  const voucher: VoucherRecord = {
    id: row.id,
    code: row.code,
    description: row.description,
    discount_type: row.discount_type,
    discount_value: Number(row.discount_value),
    max_uses: row.max_uses,
    used_count: row.used_count,
    valid_from: row.valid_from,
    valid_until: row.valid_until,
    active: row.active,
  };

  return {
    ok: true,
    voucher,
    discountAmount: computeVoucherDiscount(voucher, subtotal),
    label: voucherLabel(voucher),
  };
}
