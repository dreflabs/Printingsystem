"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail, type ActionResult } from "@/types/actions";

const DEFAULT_ROLES = ["owner", "admin", "designer_sales", "operator", "gudang"] as const;
const TRIAL_DAYS = 14;
const BCRYPT_ROUNDS = 12;

/** Katalog paket yang bisa dipilih sendiri lewat form pendaftaran (Enterprise = via Sales, bukan self-serve). */
const PLAN_CATALOG = {
  starter: {
    name: "Starter",
    slug: "starter",
    price_monthly: 299000,
    max_users: 5,
    max_orders_per_month: 200,
    features_json: JSON.stringify(["dashboard", "kanban", "qc"]),
    tenantPlan: "STARTER",
  },
  pro: {
    name: "Pro",
    slug: "pro",
    price_monthly: 599000,
    max_users: 15,
    max_orders_per_month: null,
    features_json: JSON.stringify(["dashboard", "kanban", "qc", "storage", "whatsapp_unlimited", "audit_trail"]),
    tenantPlan: "PRO",
  },
} as const;
type PlanKey = keyof typeof PLAN_CATALOG;
function resolvePlanKey(v: unknown): PlanKey {
  return v === "pro" ? "pro" : "starter";
}

export type RegisterTenantInput = {
  ownerName: string;
  email: string;
  phone?: string;
  password: string;
  shopName: string;
  subdomain: string;
  address?: string;
  /** Paket yang diklik di landing page ("starter" default, "pro" opsional). Enterprise tidak self-serve. */
  plan?: string;
};

export type RegisterTenantResult = {
  slug: string;
  ownerUsername: string;
  tenantId: string;
};

function slugify(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Public self-serve signup. Creates Tenant + owner User + trial subscription +
 * onboarding marker in one transaction.
 *
 * NOTE: email is NOT verified (no mail provider wired yet). When one is added,
 * gate this behind a verified-token check and re-add the VERIFIED onboarding step.
 */
export async function registerTenant(
  input: RegisterTenantInput
): Promise<ActionResult<RegisterTenantResult>> {
  try {
    const ownerName = input.ownerName?.trim();
    const email = input.email?.trim().toLowerCase();
    const shopName = input.shopName?.trim();
    const slug = slugify(input.subdomain || "");
    const phone = input.phone?.trim() || null;
    const address = input.address?.trim() || null;

    if (!ownerName) return fail("Nama lengkap wajib diisi.", { ownerName: "Wajib diisi." });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return fail("Alamat email tidak valid.", { email: "Email tidak valid." });
    if (!input.password || input.password.length < 8)
      return fail("Kata sandi minimal 8 karakter.", { password: "Minimal 8 karakter." });
    if (!/[a-zA-Z]/.test(input.password) || !/[0-9]/.test(input.password))
      return fail("Kata sandi harus mengandung huruf dan angka.", { password: "Gabungkan huruf dan angka." });
    if (!shopName) return fail("Nama percetakan wajib diisi.", { shopName: "Wajib diisi." });
    if (!/^[a-z0-9]{3,30}$/.test(slug))
      return fail("Subdomain harus 3–30 karakter, huruf kecil/angka saja.", {
        subdomain: "3–30 karakter, huruf kecil/angka.",
      });

    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) return fail("Subdomain sudah dipakai. Coba yang lain.", { subdomain: "Sudah dipakai." });

    const password_hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const usernameBase = slugify(email.split("@")[0]) || "owner";
    const planKey = resolvePlanKey(input.plan);
    const planDef = PLAN_CATALOG[planKey];

    const result = await prisma.$transaction(async (tx) => {
      // Roles are global (no tenant_id) — ensure the standard set exists.
      const roleIds: Record<string, string> = {};
      for (const name of DEFAULT_ROLES) {
        const role = await tx.role.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        roleIds[name] = role.id;
      }

      const plan = await tx.subscriptionPlan.upsert({
        where: { slug: planDef.slug },
        update: {},
        create: {
          name: planDef.name,
          slug: planDef.slug,
          price_monthly: planDef.price_monthly,
          max_users: planDef.max_users,
          max_orders_per_month: planDef.max_orders_per_month,
          features_json: planDef.features_json,
        },
      });

      const now = new Date();
      const trialEnds = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

      const tenant = await tx.tenant.create({
        data: {
          slug,
          name: shopName,
          plan: planDef.tenantPlan,
          status: "TRIAL",
          trial_ends_at: trialEnds,
          billing_email: email,
          owner_name: ownerName,
          owner_phone: phone,
          max_users: plan.max_users,
        },
      });

      await tx.tenantSubscription.create({
        data: {
          tenant_id: tenant.id,
          plan_id: plan.id,
          status: "ACTIVE",
          started_at: now,
          ends_at: trialEnds,
        },
      });

      await tx.user.create({
        data: {
          tenant_id: tenant.id,
          name: ownerName,
          username: usernameBase,
          email,
          password_hash,
          role_id: roleIds["owner"],
          phone,
          active: true,
        },
      });

      // Catatan: email belum diverifikasi (belum ada provider email) — jangan
      // tandai VERIFIED. Tambahkan langkah itu saat verifikasi email diaktifkan.
      await tx.onboardingStep.create({
        data: { tenant_id: tenant.id, step: "WIZARD_DONE" },
      });

      await tx.tenantAuditLog.create({
        data: {
          tenant_id: tenant.id,
          actor_type: "SYSTEM",
          action: "TENANT_SELF_SIGNUP",
          detail_json: JSON.stringify({ slug, email, plan: planDef.tenantPlan, address }),
        },
      });

      return { slug, ownerUsername: usernameBase, tenantId: tenant.id };
    });

    return ok(result);
  } catch (e) {
    console.error("registerTenant failed:", e);
    return fail("Gagal membuat workspace. Silakan coba lagi.");
  }
}
