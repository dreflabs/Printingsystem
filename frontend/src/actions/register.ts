"use server";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ok, fail, type ActionResult } from "@/types/actions";

const prisma = new PrismaClient();

const DEFAULT_ROLES = ["owner", "admin", "designer_sales", "operator", "gudang"] as const;
const TRIAL_DAYS = 14;

export type RegisterTenantInput = {
  ownerName: string;
  email: string;
  phone?: string;
  password: string;
  shopName: string;
  subdomain: string;
  address?: string;
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
 * onboarding markers in one transaction.
 *
 * NOTE: email OTP is not verified server-side (no mail provider wired yet) — the
 * wizard's OTP step is cosmetic. When a provider is added, gate this behind a
 * verified-token check.
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
    if (!shopName) return fail("Nama percetakan wajib diisi.", { shopName: "Wajib diisi." });
    if (!/^[a-z0-9]{3,30}$/.test(slug))
      return fail("Subdomain harus 3–30 karakter, huruf kecil/angka saja.", {
        subdomain: "3–30 karakter, huruf kecil/angka.",
      });

    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) return fail("Subdomain sudah dipakai. Coba yang lain.", { subdomain: "Sudah dipakai." });

    const password_hash = await bcrypt.hash(input.password, 10);
    const usernameBase = slugify(email.split("@")[0]) || "owner";

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
        where: { slug: "starter" },
        update: {},
        create: {
          name: "Starter",
          slug: "starter",
          price_monthly: 299000,
          max_users: 5,
          max_orders_per_month: 200,
          features_json: JSON.stringify(["dashboard", "kanban", "qc"]),
        },
      });

      const now = new Date();
      const trialEnds = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

      const tenant = await tx.tenant.create({
        data: {
          slug,
          name: shopName,
          plan: "STARTER",
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

      await tx.onboardingStep.createMany({
        data: [
          { tenant_id: tenant.id, step: "VERIFIED" },
          { tenant_id: tenant.id, step: "WIZARD_DONE" },
        ],
      });

      await tx.tenantAuditLog.create({
        data: {
          tenant_id: tenant.id,
          actor_type: "SYSTEM",
          action: "TENANT_SELF_SIGNUP",
          detail_json: JSON.stringify({ slug, email, plan: "STARTER", address }),
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
