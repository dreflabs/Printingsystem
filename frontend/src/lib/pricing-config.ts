import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PRICING_CONFIG,
  SAAS_PLANS,
  SERVICE_OPTIONS,
  SUBSCRIPTION_TERMS,
  type PricingConfig,
  type PricingServiceConfig,
  type PricingTermConfig,
} from "@/lib/saas-catalog";

/**
 * Pengaturan harga & add-on tingkat platform — dapat diubah Super Admin tanpa
 * deploy. Disimpan sebagai `PlatformSetting` (key `billing.pricing`) dengan
 * fallback ke `DEFAULT_PRICING_CONFIG` di kode, jadi deployment tanpa baris
 * pengaturan tetap berjalan normal.
 *
 * Dipakai bersama oleh wizard pendaftaran, `registerTenant()`, generator
 * invoice, dan perhitungan di halaman billing tenant — satu sumber angka.
 */
const PRICING_SETTINGS_KEY = "billing.pricing";

function asInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/** Normalisasi input mentah → konfigurasi valid (selalu ada nilai default). */
export function normalizePricingConfig(raw: unknown): PricingConfig {
  const parsed = (raw && typeof raw === "object" ? raw : {}) as Partial<PricingConfig>;

  const terms: PricingTermConfig[] = SUBSCRIPTION_TERMS.map((t) => {
    const override = Array.isArray(parsed.terms)
      ? parsed.terms.find((x) => Number(x?.months) === t.months)
      : undefined;
    return {
      months: t.months,
      paidMonths: asInt(override?.paidMonths, t.paidMonths, 1, t.months),
    };
  });

  const services: PricingServiceConfig[] = SERVICE_OPTIONS.map((s) => {
    const override = Array.isArray(parsed.services)
      ? parsed.services.find((x) => x?.key === s.key)
      : undefined;
    return {
      key: s.key,
      listPrice: asInt(override?.listPrice, s.listPrice, 0, 1_000_000_000),
      promoFree: typeof override?.promoFree === "boolean" ? override.promoFree : s.promoFree,
    };
  });

  return {
    seatPriceMonthly: asInt(parsed.seatPriceMonthly, DEFAULT_PRICING_CONFIG.seatPriceMonthly, 0, 100_000_000),
    maxSeats: asInt(parsed.maxSeats, DEFAULT_PRICING_CONFIG.maxSeats, 1, 500),
    paymentDueDays: asInt(parsed.paymentDueDays, DEFAULT_PRICING_CONFIG.paymentDueDays, 1, 90),
    terms,
    services,
    servicePromoActive:
      typeof parsed.servicePromoActive === "boolean"
        ? parsed.servicePromoActive
        : DEFAULT_PRICING_CONFIG.servicePromoActive,
  };
}

/** Validasi tambahan yang tidak bisa ditangani normalisasi (mis. peringatan kanibalisasi). */
export function pricingConfigWarnings(cfg: PricingConfig): string[] {
  const warnings: string[] = [];
  const deltaPerSeat = Math.round(
    (SAAS_PLANS.business.price_monthly - SAAS_PLANS.pro.price_monthly) /
      Math.max(1, SAAS_PLANS.business.max_users - SAAS_PLANS.pro.max_users),
  );
  if (cfg.seatPriceMonthly > 0 && cfg.seatPriceMonthly < deltaPerSeat) {
    warnings.push(
      `Harga kursi Rp${cfg.seatPriceMonthly.toLocaleString("id-ID")} lebih murah dari selisih upgrade paket (≈Rp${deltaPerSeat.toLocaleString("id-ID")}/kursi). Bisa mengkanibalisasi upgrade paket.`,
    );
  }
  const annual = cfg.terms.find((t) => t.months === 12);
  if (annual && annual.paidMonths > annual.months) {
    warnings.push("Diskon termin 12 bulan tidak valid: bulan dibayar melebihi durasi.");
  }
  return warnings;
}

export async function getPricingConfig(): Promise<PricingConfig> {
  const row = await prisma.platformSetting.findUnique({ where: { key: PRICING_SETTINGS_KEY } });
  if (!row) return normalizePricingConfig(null);
  try {
    return normalizePricingConfig(JSON.parse(row.value_json));
  } catch {
    return normalizePricingConfig(null);
  }
}

export async function savePricingConfig(input: unknown): Promise<PricingConfig> {
  const normalized = normalizePricingConfig(input);
  await prisma.platformSetting.upsert({
    where: { key: PRICING_SETTINGS_KEY },
    create: { key: PRICING_SETTINGS_KEY, value_json: JSON.stringify(normalized) },
    update: { value_json: JSON.stringify(normalized) },
  });
  return normalized;
}
