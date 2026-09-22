import { prisma } from "@/lib/prisma";
import { SAAS_PLANS } from "@/lib/saas-catalog";

export type EntitlementKey =
  | "dashboard"
  | "kanban"
  | "pos"
  | "reports"
  | "reports_finance"
  | "qc"
  | "storage"
  | "audit_trail"
  | "hrm"
  | "inventory"
  | "layout"
  | "whatsapp_unlimited"
  | "purchase_orders"
  | "api"; // roadmap — belum ada endpoint publik; jangan dicantumkan di paket self-serve

export interface TenantEntitlements {
  plan: string;
  maxUsers: number | null;
  maxOrdersPerMonth: number | null;
  features: ReadonlySet<string>;
}

function parseFeatures(value: string | null | undefined): ReadonlySet<string> {
  if (!value) return new Set();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

const ALL_ENTITLEMENTS: EntitlementKey[] = [
  "dashboard",
  "kanban",
  "pos",
  "reports",
  "reports_finance",
  "qc",
  "storage",
  "audit_trail",
  "hrm",
  "inventory",
  "layout",
  "whatsapp_unlimited",
  "purchase_orders",
  "api",
];

/** Default per paket self-serve dibangun dari `SAAS_PLANS` agar tidak ada dua sumber kebenaran. */
const SELF_SERVE_DEFAULTS = Object.fromEntries(
  Object.values(SAAS_PLANS).map((plan) => [
    plan.tenantPlan,
    {
      maxUsers: plan.max_users as number | null,
      maxOrdersPerMonth: plan.max_orders_per_month as number | null,
      features: new Set<string>(plan.features),
    },
  ]),
) as Record<string, { maxUsers: number | null; maxOrdersPerMonth: number | null; features: ReadonlySet<string> }>;

/**
 * Fallback untuk tenant yang `Tenant.plan`-nya tidak punya baris
 * `TenantSubscription` aktif (mis. data lama / import manual). Enterprise
 * mendapat seluruh entitlement.
 */
const LEGACY_PLAN_DEFAULTS: Record<string, { maxUsers: number | null; maxOrdersPerMonth: number | null; features: ReadonlySet<string> }> = {
  ...SELF_SERVE_DEFAULTS,
  ENTERPRISE: { maxUsers: null, maxOrdersPerMonth: null, features: new Set<string>(ALL_ENTITLEMENTS) },
};

/** Sumber entitlement aktif tenant. Subscription aktif menjadi sumber utama. */
export async function getTenantEntitlements(tenantId: string): Promise<TenantEntitlements> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      plan: true,
      max_users: true,
      addon_users: true,
      subscription_plans: {
        where: { status: "ACTIVE" },
        orderBy: { started_at: "desc" },
        take: 1,
        select: { plan: { select: { max_users: true, max_orders_per_month: true, features_json: true, slug: true, active: true } } },
      },
    },
  });
  if (!tenant) throw new Error("Tenant tidak ditemukan.");
  const plan = tenant.subscription_plans[0]?.plan;
  const activePlan = plan?.active ? plan : undefined;
  const legacy = LEGACY_PLAN_DEFAULTS[tenant.plan.toUpperCase()] ?? LEGACY_PLAN_DEFAULTS.STARTER;
  // Kursi add-on menambah kuota paket tanpa mengubah fitur. `null` = unlimited.
  const baseMaxUsers = tenant.max_users ?? activePlan?.max_users ?? legacy.maxUsers;
  const addonUsers = tenant.addon_users ?? 0;
  return {
    plan: tenant.plan,
    maxUsers: baseMaxUsers == null ? null : baseMaxUsers + addonUsers,
    maxOrdersPerMonth: activePlan?.max_orders_per_month ?? legacy.maxOrdersPerMonth,
    features: activePlan ? parseFeatures(activePlan.features_json) : legacy.features,
  };
}

export async function requireEntitlement(tenantId: string, feature: EntitlementKey): Promise<TenantEntitlements> {
  const entitlements = await getTenantEntitlements(tenantId);
  if (!entitlements.features.has(feature)) {
    throw new Error(`Fitur ${feature} belum tersedia di paket ${entitlements.plan}.`);
  }
  return entitlements;
}
