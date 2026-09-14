import { prisma } from "@/lib/prisma";

export type EntitlementKey =
  | "dashboard"
  | "kanban"
  | "qc"
  | "storage"
  | "whatsapp_unlimited"
  | "audit_trail";

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

const LEGACY_PLAN_DEFAULTS: Record<string, { maxUsers: number | null; maxOrdersPerMonth: number | null; features: ReadonlySet<string> }> = {
  STARTER: { maxUsers: 5, maxOrdersPerMonth: 200, features: new Set(["dashboard", "kanban", "qc"]) },
  PRO: { maxUsers: 15, maxOrdersPerMonth: null, features: new Set(["dashboard", "kanban", "qc", "storage", "whatsapp_unlimited", "audit_trail"]) },
  ENTERPRISE: { maxUsers: null, maxOrdersPerMonth: null, features: new Set(["dashboard", "kanban", "qc", "storage", "whatsapp_unlimited", "audit_trail"]) },
};

/** Sumber entitlement aktif tenant. Subscription aktif menjadi sumber utama. */
export async function getTenantEntitlements(tenantId: string): Promise<TenantEntitlements> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      plan: true,
      max_users: true,
      subscription_plans: {
        where: { status: "ACTIVE" },
        orderBy: { started_at: "desc" },
        take: 1,
        select: { plan: { select: { max_users: true, max_orders_per_month: true, features_json: true, slug: true } } },
      },
    },
  });
  if (!tenant) throw new Error("Tenant tidak ditemukan.");
  const plan = tenant.subscription_plans[0]?.plan;
  const legacy = LEGACY_PLAN_DEFAULTS[tenant.plan.toUpperCase()] ?? LEGACY_PLAN_DEFAULTS.STARTER;
  return {
    plan: tenant.plan,
    maxUsers: tenant.max_users ?? plan?.max_users ?? legacy.maxUsers,
    maxOrdersPerMonth: plan?.max_orders_per_month ?? legacy.maxOrdersPerMonth,
    features: plan ? parseFeatures(plan.features_json) : legacy.features,
  };
}

export async function requireEntitlement(tenantId: string, feature: EntitlementKey): Promise<TenantEntitlements> {
  const entitlements = await getTenantEntitlements(tenantId);
  if (!entitlements.features.has(feature)) {
    throw new Error(`Fitur ${feature} belum tersedia di paket ${entitlements.plan}.`);
  }
  return entitlements;
}
