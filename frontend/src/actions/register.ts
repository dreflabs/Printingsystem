"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { ok, fail, type ActionResult } from "@/types/actions";
import {
  buildStarterMaterials,
} from "@/lib/starter-data";
import { validateTenantPassword } from "@/lib/password-policy";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/mail";

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
  /**
   * Jawaban wizard "berapa orang yang menjalankan percetakan ini?".
   * "solo" (default) → 1 orang · "small" → 2–5 · "full" → 6+.
   * Menentukan `Tenant.workspace_mode` (tampilan navigasi/beranda, bukan izin).
   * Pemberian peran operasional ke Owner tetap seperti sekarang di Tahap 1;
   * pengaturannya per-mode menyusul di Tahap 2.
   */
  teamSize?: "solo" | "small" | "full";
};

/** Map jawaban wizard ukuran tim → nilai kolom `Tenant.workspace_mode`. */
function resolveWorkspaceMode(v: unknown): "SOLO" | "TEAM_SMALL" | "TEAM_FULL" {
  return v === "full" ? "TEAM_FULL" : v === "small" ? "TEAM_SMALL" : "SOLO";
}

export type RegisterTenantResult = {
  slug: string;
  ownerUsername: string;
  tenantId: string;
  verificationRequired: boolean;
};

function slugify(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Public self-serve signup. Creates Tenant + owner User + trial subscription +
 * onboarding marker in one transaction.
 *
 * New production signups must verify the owner email before the first login.
 * Existing tenants are backfilled as verified by the migration so this does not
 * interrupt established workspaces.
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

    const signupLimit = rateLimit(`signup:${email || "unknown"}:${slug || "unknown"}`, 5, 60 * 60_000);
    if (!signupLimit.ok) return fail("Terlalu banyak percobaan pendaftaran. Coba lagi nanti.");

    if (!ownerName) return fail("Nama lengkap wajib diisi.", { ownerName: "Wajib diisi." });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return fail("Alamat email tidak valid.", { email: "Email tidak valid." });
    const passwordError = validateTenantPassword(input.password ?? "");
    if (passwordError) return fail(passwordError, { password: passwordError });
    if (!shopName) return fail("Nama percetakan wajib diisi.", { shopName: "Wajib diisi." });
    if (!/^[a-z0-9]{3,30}$/.test(slug))
      return fail("Subdomain harus 3–30 karakter, huruf kecil/angka saja.", {
        subdomain: "3–30 karakter, huruf kecil/angka.",
      });

    // Selama beta/trial verifikasi email sengaja dimatikan. Aktifkan eksplisit
    // saat product release melalui REQUIRE_EMAIL_VERIFICATION=true agar deploy
    // staging/production awal tidak tiba-tiba menahan akun baru.
    const verificationRequired = process.env.REQUIRE_EMAIL_VERIFICATION === "true";
    if (verificationRequired && !process.env.MAIL_PROVIDER_TOKEN) {
      return fail("Pendaftaran sementara belum tersedia karena provider email belum dikonfigurasi.");
    }

    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) return fail("Subdomain sudah dipakai. Coba yang lain.", { subdomain: "Sudah dipakai." });

    const password_hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const usernameBase = slugify(email.split("@")[0]) || "owner";
    const planKey = resolvePlanKey(input.plan);
    const planDef = PLAN_CATALOG[planKey];
    const workspaceMode = resolveWorkspaceMode(input.teamSize);
    const verificationRaw = verificationRequired ? crypto.randomBytes(32).toString("hex") : null;
    const verificationHash = verificationRaw
      ? crypto.createHash("sha256").update(verificationRaw).digest("hex")
      : null;

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
          workspace_mode: workspaceMode,
          // Tim per-divisi: default minta Admin merilis order ke produksi &
          // wajib konfirmasi counter sebelum serah terima. SOLO / tim kecil:
          // langsung (bisa diubah Owner di /owner/toko).
          require_admin_production_release: workspaceMode === "TEAM_FULL",
          require_counter_confirmation: workspaceMode === "TEAM_FULL",
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

      const owner = await tx.user.create({
        data: {
          tenant_id: tenant.id,
          name: ownerName,
          username: usernameBase,
          email,
          email_verified_at: verificationRequired ? null : new Date(),
          password_hash,
          role_id: roleIds["owner"],
          phone,
          active: true,
          attendance_eligible: true,
        },
      });

      // Owner diberi SEMUA peran operasional sebagai extra_roles supaya bisa
      // menyelesaikan alur (kasir → desain → produksi → QC → finishing → rak →
      // serah) sendiri tanpa akun kedua — berlaku untuk SEMUA workspace_mode,
      // termasuk TEAM_FULL: saat baru daftar belum ada satu pun pegawai, jadi
      // Owner tetap butuh akses penuh untuk menyiapkan & menjalankan toko.
      // `workspace_mode` hanya mengubah TAMPILAN (menu + beranda). Pencabutan
      // peran Owner yang sudah ada penggantinya dituntun terpisah begitu Owner
      // menambah pegawai (rencana Tahap 5), dan selalu bisa dibatalkan.
      await tx.userRole.createMany({
        data: DEFAULT_ROLES.filter((r) => r !== "owner").map((name) => ({
          user_id: owner.id,
          role_id: roleIds[name],
        })),
      });

      // Hanya bahan yang di-seed (daftar bahan umum percetakan, stok 0 — Owner
      // isi angkanya). Mesin & lokasi penyimpanan TIDAK diisi: tiap percetakan
      // beda. Owner menambahnya sendiri (Katalog & Harga → Mesin; Gudang &
      // Finishing → Kelola Lokasi). Checklist penyiapan menuntun keduanya.
      await tx.material.createMany({ data: buildStarterMaterials(tenant.id, owner.id) });

      // Pengaturan absensi default (jam kerja 09:00, batas telat 09:15, dst.).
      // Owner menyesuaikan di /owner/attendance-settings.
      await tx.tenantAttendanceSetting.create({ data: { tenant_id: tenant.id } });

      await tx.onboardingStep.create({
        data: { tenant_id: tenant.id, step: "WIZARD_DONE" },
      });

      await tx.tenantAuditLog.create({
        data: {
          tenant_id: tenant.id,
          actor_type: "SYSTEM",
          action: "TENANT_SELF_SIGNUP",
          detail_json: JSON.stringify({ slug, email, plan: planDef.tenantPlan, address, workspace_mode: workspaceMode }),
        },
      });

      if (verificationHash && verificationRaw) {
        await tx.emailVerificationToken.create({
          data: {
            user_id: owner.id,
            token_hash: verificationHash,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }

      return { slug, ownerUsername: usernameBase, tenantId: tenant.id, verificationRequired, verificationRaw };
    });

    if (result.verificationRequired && result.verificationRaw) {
      const link = `${process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000"}/verify-email?token=${result.verificationRaw}`;
      const mailed = await sendEmail({
        to: email,
        subject: "Verifikasi email Print Pilot",
        body: `Klik tautan berikut untuk mengaktifkan akun Print Pilot Anda (berlaku 24 jam):\n\n${link}\n\nJika Anda tidak membuat akun ini, abaikan email ini.`,
      });
      if (!mailed.ok) {
        console.error("register email verification delivery failed:", mailed.error);
        return fail("Workspace berhasil dibuat, tetapi email verifikasi belum dapat dikirim. Hubungi dukungan untuk mengirim ulang.");
      }
    }

    return ok({ slug: result.slug, ownerUsername: result.ownerUsername, tenantId: result.tenantId, verificationRequired: result.verificationRequired });
  } catch (e) {
    console.error("registerTenant failed:", e);
    return fail("Gagal membuat workspace. Silakan coba lagi.");
  }
}
