/**
 * Sumber kebenaran katalog SaaS untuk beta dan self-serve signup.
 * Enterprise tetap melalui Sales sehingga tidak masuk ke form registrasi.
 */
export const TRIAL_DAYS = 14;

export const SAAS_PLANS = {
  starter: {
    name: "Starter",
    slug: "starter",
    price_monthly: 299000,
    max_users: 5,
    max_orders_per_month: 200,
    // "qc" sengaja tidak diberikan ke Starter — SAAS-MODEL.md mengunci Modul QC
    // untuk paket ini. Naik ke Pro untuk membuka claimQCJob/submitQC/decideRework.
    features: ["dashboard", "kanban"],
    tenantPlan: "STARTER",
  },
  pro: {
    name: "Pro",
    slug: "pro",
    price_monthly: 599000,
    max_users: 15,
    max_orders_per_month: null,
    features: ["dashboard", "kanban", "qc", "storage", "whatsapp_unlimited", "audit_trail"],
    tenantPlan: "PRO",
  },
} as const;

export type SelfServePlanKey = keyof typeof SAAS_PLANS;

export function resolveSelfServePlan(v: unknown): SelfServePlanKey {
  return v === "pro" ? "pro" : "starter";
}

export function planFeaturesJson(plan: SelfServePlanKey): string {
  return JSON.stringify(SAAS_PLANS[plan].features);
}
