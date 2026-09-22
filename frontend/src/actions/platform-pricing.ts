"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin, requireSubLevel } from "@/lib/platform";
import { logPlatform, headerMeta } from "@/lib/platform-audit";
import { getPricingConfig, savePricingConfig, pricingConfigWarnings } from "@/lib/pricing-config";
import { DEFAULT_PRICING_CONFIG, SAAS_PLANS, SERVICE_OPTIONS, SUBSCRIPTION_TERMS, type PricingConfig } from "@/lib/saas-catalog";
import { safeError } from "@/lib/safe-error";
import { ok, fail } from "@/types";

/**
 * Pengaturan harga & add-on tingkat platform. Satu sumber angka untuk wizard
 * pendaftaran, invoice, dan halaman billing tenant — jadi Super Admin bisa
 * mengubah harga kursi, diskon termin, harga layanan, dan jatuh tempo tanpa
 * deploy.
 */
export async function getPricingSettingsAdmin() {
  try {
    await requireSuperAdmin();
    const config = await getPricingConfig();
    return ok({
      config,
      warnings: pricingConfigWarnings(config),
      defaults: DEFAULT_PRICING_CONFIG,
      terms: SUBSCRIPTION_TERMS.map((t) => ({ months: t.months, label: t.label, badge: t.badge })),
      services: SERVICE_OPTIONS.map((s) => ({ key: s.key, name: s.name, description: s.description })),
      plans: Object.values(SAAS_PLANS).map((p) => ({ name: p.name, slug: p.slug, maxUsers: p.max_users, priceMonthly: p.price_monthly })),
    });
  } catch (e) {
    console.error("getPricingSettingsAdmin:", e);
    return fail(safeError(e, "Gagal memuat pengaturan harga."));
  }
}

export async function updatePricingSettings(input: PricingConfig) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN", "FINANCE");
    const before = await getPricingConfig();
    const saved = await savePricingConfig(input);

    const meta = await headerMeta();
    await logPlatform({
      actorId: actor.id,
      actorName: actor.name,
      actorSubLevel: actor.subLevel,
      action: "PRICING_SETTINGS_UPDATED",
      targetType: "PlatformSetting",
      targetLabel: "billing.pricing",
      detail: {
        before: {
          seatPriceMonthly: before.seatPriceMonthly,
          maxSeats: before.maxSeats,
          paymentDueDays: before.paymentDueDays,
          terms: before.terms,
          services: before.services,
          servicePromoActive: before.servicePromoActive,
        },
        after: {
          seatPriceMonthly: saved.seatPriceMonthly,
          maxSeats: saved.maxSeats,
          paymentDueDays: saved.paymentDueDays,
          terms: saved.terms,
          services: saved.services,
          servicePromoActive: saved.servicePromoActive,
        },
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    revalidatePath("/platform/pricing");
    return ok({ config: saved, warnings: pricingConfigWarnings(saved) });
  } catch (e) {
    console.error("updatePricingSettings:", e);
    return fail(safeError(e, "Gagal menyimpan pengaturan harga."));
  }
}
