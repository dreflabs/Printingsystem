"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { getTenantEntitlements } from "@/lib/entitlements";
import { computeOrderEstimate, SAAS_PLANS, type SelfServePlanKey } from "@/lib/saas-catalog";
import { getPricingConfig } from "@/lib/pricing-config";
import { changePlanCore } from "@/lib/plan-change";
import { validateVoucher } from "@/lib/voucher";
import { getActiveBankAccounts, getAvailablePaymentMethods } from "@/lib/payment-settings";
import { presignPutUrl, storageReady, isTenantKey } from "@/lib/storage";
import { safeError } from "@/lib/safe-error";
import { ok, fail, type ActionResult } from "@/types";

const PAYMENT_PROOF_NAMESPACE = "payments";
const PAYMENT_PROOF_MAX_BYTES = 5 * 1024 * 1024;
const PAYMENT_PROOF_EXT = ["jpg", "jpeg", "png", "pdf"];

/** Katalog self-serve dibalik dari `tenantPlan` (STARTER/PRO/BUSINESS) → definisi harga & fitur. */
const PLAN_BY_TENANT_PLAN = Object.fromEntries(
  Object.values(SAAS_PLANS).map((p) => [p.tenantPlan, p]),
) as Record<string, (typeof SAAS_PLANS)[keyof typeof SAAS_PLANS]>;

const PLAN_KEY_BY_TENANT_PLAN = Object.fromEntries(
  Object.entries(SAAS_PLANS).map(([key, p]) => [p.tenantPlan, key as SelfServePlanKey]),
) as Record<string, SelfServePlanKey>;

export interface TenantBillingSummary {
  plan: string;
  planName: string;
  priceMonthly: number | null; // null = tidak self-serve (Enterprise) → hubungi Sales
  status: string;
  maxUsers: number | null;
  activeUsers: number;
  maxOrdersPerMonth: number | null;
  ordersThisMonth: number;
  addonUsers: number;
  termMonths: number;
  serviceKeys: string[];
  estimateTotal: number | null;
  voucherCode: string | null;
  canManagePlan: boolean;
  availablePlans: {
    key: SelfServePlanKey;
    name: string;
    priceMonthly: number;
    maxUsers: number | null;
    current: boolean;
  }[];
  invoices: {
    id: string;
    number: string;
    period: string;
    amount: number;
    subtotal: number;
    discount: number;
    voucherCode: string | null;
    status: string;
    dueDate: string;
    paidAt: string | null;
    lines: { description: string; amount: number }[];
    proofStatus: string | null;
  }[];
}

export interface PaymentBannerStatus {
  status: string;
  planName: string;
  invoiceNumber: string | null;
  amount: number | null;
  dueDate: string | null;
}

/**
 * Status ringan untuk banner dashboard Owner — dipanggil di setiap kunjungan
 * dashboard, jadi sengaja tidak ikut hitung kuota/invoice seperti
 * `getTenantBillingSummary` (dipakai khusus halaman "Paket & Tagihan").
 */
export async function getPaymentBannerStatus(): Promise<ActionResult<PaymentBannerStatus>> {
  try {
    const tenant = await requireTenant({ allowUnpaid: true });
    await requireUser();

    const t = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { plan: true, status: true },
    });
    if (!t) return fail("Data tenant tidak ditemukan.");

    const planDef = PLAN_BY_TENANT_PLAN[t.plan.toUpperCase()];

    // Invoice terutang pertama (kalau ada) untuk ditampilkan di banner.
    const invoice = await prisma.invoice.findFirst({
      where: { tenant_id: tenant.id, status: { in: ["PENDING", "FAILED"] } },
      orderBy: { due_date: "asc" },
      select: { invoice_number: true, amount: true, due_date: true },
    });

    return ok({
      status: t.status,
      planName: planDef?.name ?? t.plan,
      invoiceNumber: invoice?.invoice_number ?? null,
      amount: invoice ? Number(invoice.amount) : null,
      dueDate: invoice?.due_date.toISOString() ?? null,
    });
  } catch (e) {
    console.error("getPaymentBannerStatus:", e);
    return fail(safeError(e, "Gagal memuat status pembayaran."));
  }
}

/** Ringkasan paket & tagihan tenant aktif, untuk halaman Owner "Paket & Tagihan". */
export async function getTenantBillingSummary(): Promise<ActionResult<TenantBillingSummary>> {
  try {
    const tenant = await requireTenant({ allowUnpaid: true });
    const actor = await requireUser();

    const [t, entitlements, activeUsers, ordersThisMonth, invoiceRows, subscription] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenant.id },
        select: { plan: true, status: true, addon_users: true },
      }),
      getTenantEntitlements(tenant.id),
      prisma.user.count({ where: { tenant_id: tenant.id, active: true } }),
      prisma.order.count({
        where: {
          tenant_id: tenant.id,
          created_at: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      prisma.invoice.findMany({
        where: { tenant_id: tenant.id },
        orderBy: { created_at: "desc" },
        take: 12,
        select: {
          id: true,
          invoice_number: true,
          billing_period: true,
          amount: true,
          subtotal: true,
          discount: true,
          voucher_code: true,
          status: true,
          due_date: true,
          paid_at: true,
          lines: {
            select: { description: true, amount: true },
            orderBy: { created_at: "asc" },
          },
          payment_proofs: {
            select: { status: true },
            orderBy: { created_at: "desc" },
            take: 1,
          },
        },
      }),
      prisma.tenantSubscription.findFirst({
        where: { tenant_id: tenant.id, status: "ACTIVE" },
        orderBy: { started_at: "desc" },
        select: {
          term_months: true,
          service_keys: true,
          voucher_code: true,
          plan: { select: { price_monthly: true } },
        },
      }),
    ]);
    if (!t) return fail("Data tenant tidak ditemukan.");

    const planDef = PLAN_BY_TENANT_PLAN[t.plan.toUpperCase()];

    const planKey = PLAN_KEY_BY_TENANT_PLAN[t.plan.toUpperCase()];
    const termMonths = subscription?.term_months ?? 1;
    const serviceKeys = subscription?.service_keys ?? [];
    // Harga & parameter komersial dibaca dari pengaturan platform + baris
    // SubscriptionPlan, bukan konstanta katalog.
    const pricing = await getPricingConfig();
    const planPriceMonthly = subscription?.plan ? Number(subscription.plan.price_monthly) : null;
    const estimate = planKey
      ? computeOrderEstimate({
          plan: planKey,
          months: termMonths,
          addonSeats: t.addon_users ?? 0,
          services: serviceKeys,
          pricing,
          planPriceMonthly,
        })
      : null;

    return ok({
      plan: t.plan,
      planName: planDef?.name ?? t.plan,
      priceMonthly: planPriceMonthly ?? (planDef ? Number(planDef.price_monthly) : null),
      status: t.status,
      maxUsers: entitlements.maxUsers,
      activeUsers,
      maxOrdersPerMonth: entitlements.maxOrdersPerMonth,
      ordersThisMonth,
      addonUsers: t.addon_users ?? 0,
      termMonths,
      serviceKeys,
      estimateTotal: estimate ? estimate.total : null,
      voucherCode: subscription?.voucher_code ?? null,
      canManagePlan: actor.roles.includes("owner"),
      availablePlans: (Object.entries(SAAS_PLANS) as [SelfServePlanKey, (typeof SAAS_PLANS)[SelfServePlanKey]][]).map(
        ([key, def]) => ({
          key,
          name: def.name,
          priceMonthly: Number(def.price_monthly),
          maxUsers: def.max_users,
          current: def.tenantPlan === t.plan.toUpperCase(),
        }),
      ),
      invoices: invoiceRows.map((i) => ({
        id: i.id,
        number: i.invoice_number,
        period: i.billing_period,
        amount: Number(i.amount),
        subtotal: Number(i.subtotal),
        discount: Number(i.discount),
        voucherCode: i.voucher_code,
        status: i.status,
        dueDate: i.due_date.toISOString(),
        paidAt: i.paid_at?.toISOString() ?? null,
        lines: i.lines.map((l) => ({ description: l.description, amount: Number(l.amount) })),
        proofStatus: i.payment_proofs[0]?.status ?? null,
      })),
    });
  } catch (e) {
    console.error("getTenantBillingSummary:", e);
    return fail(safeError(e, "Gagal memuat data paket & tagihan."));
  }
}

/**
 * Ganti paket sendiri (Starter↔Pro↔Business) tanpa Super Admin — hanya Owner. Enterprise
 * sengaja tidak self-serve di sini (sama seperti pendaftaran, lihat
 * `saas-catalog.ts`) karena harganya khusus lewat Sales.
 */
export async function changeTenantPlan(planKey: SelfServePlanKey): Promise<ActionResult<{ plan: string; maxUsers: number | null }>> {
  try {
    // Ganti paket TIDAK diizinkan saat UNPAID: invoice periode ini sudah terbit
    // dengan komposisi lama, jadi perubahan paket harus setelah pembayaran.
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!actor.roles.includes("owner")) return fail("Hanya Owner yang boleh mengubah paket.");

    const def = SAAS_PLANS[planKey];
    if (!def) return fail("Paket tidak dikenal.");

    const result = await changePlanCore({
      tenantId: tenant.id,
      targetPlan: def.tenantPlan,
      maxUsers: def.max_users,
      actor: { type: "owner", userId: actor.id },
    });
    if (!result.success) return result;

    revalidatePath("/owner/billing");
    return ok({ plan: result.data.plan, maxUsers: result.data.maxUsers });
  } catch (e) {
    console.error("changeTenantPlan:", e);
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return fail("Perubahan paket sedang diproses. Muat ulang halaman dan coba lagi.");
    }
    return fail(safeError(e, "Gagal mengubah paket."));
  }
}

/**
 * Pasang kode voucher untuk invoice berikutnya. Divalidasi terhadap subtotal
 * termin berjalan, lalu disimpan di langganan aktif dan dipakai SEKALI oleh
 * generator invoice (lihat lib/billing.ts).
 */
export async function applyVoucher(code: string): Promise<ActionResult<{ code: string; label: string; discountAmount: number }>> {
  try {
    const tenant = await requireTenant({ allowUnpaid: true });
    const actor = await requireUser();
    if (!actor.roles.includes("owner")) return fail("Hanya Owner yang boleh memasang voucher.");

    const [t, sub] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenant.id }, select: { plan: true, addon_users: true } }),
      prisma.tenantSubscription.findFirst({
        where: { tenant_id: tenant.id, status: "ACTIVE" },
        orderBy: { started_at: "desc" },
        select: { id: true, term_months: true, service_keys: true, plan: { select: { price_monthly: true } } },
      }),
    ]);
    if (!t || !sub) return fail("Langganan aktif tidak ditemukan.");

    const planKey = PLAN_KEY_BY_TENANT_PLAN[t.plan.toUpperCase()];
    const pricing = await getPricingConfig();
    const estimate = planKey
      ? computeOrderEstimate({
          plan: planKey,
          months: sub.term_months ?? 1,
          addonSeats: t.addon_users ?? 0,
          services: sub.service_keys ?? [],
          pricing,
          planPriceMonthly: Number(sub.plan.price_monthly),
        })
      : null;
    const subtotal = estimate
      ? estimate.total
      : Number(sub.plan.price_monthly) || Number(PLAN_BY_TENANT_PLAN[t.plan.toUpperCase()]?.price_monthly ?? 0);
    if (subtotal <= 0) return fail("Belum ada tagihan yang bisa diberi voucher.");

    const check = await validateVoucher(code, subtotal);
    if (!check.ok) return fail(check.error);

    await prisma.tenantSubscription.update({
      where: { id: sub.id },
      data: { voucher_code: check.voucher.code },
    });

    revalidatePath("/owner/billing");
    return ok({ code: check.voucher.code, label: check.label, discountAmount: check.discountAmount });
  } catch (e) {
    console.error("applyVoucher:", e);
    return fail(safeError(e, "Gagal memasang voucher."));
  }
}

/** Hapus voucher yang menunggu dipakai pada invoice berikutnya. */
export async function removeVoucher(): Promise<ActionResult<null>> {
  try {
    const tenant = await requireTenant({ allowUnpaid: true });
    const actor = await requireUser();
    if (!actor.roles.includes("owner")) return fail("Hanya Owner yang boleh menghapus voucher.");

    await prisma.tenantSubscription.updateMany({
      where: { tenant_id: tenant.id, status: "ACTIVE" },
      data: { voucher_code: null },
    });

    revalidatePath("/owner/billing");
    return ok(null);
  } catch (e) {
    console.error("removeVoucher:", e);
    return fail(safeError(e, "Gagal menghapus voucher."));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pembayaran invoice: detail + transfer manual + bukti bayar
// ─────────────────────────────────────────────────────────────────────────────

export interface TenantInvoiceDetail {
  id: string;
  number: string;
  period: string;
  periodStart: string | null;
  periodEnd: string | null;
  subtotal: number;
  discount: number;
  voucherCode: string | null;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  lines: { description: string; amount: number }[];
  planName: string;
  tenantName: string;
  bankAccounts: { id: string; bankName: string; accountNumber: string; accountHolder: string; label: string | null; notes: string | null }[];
  manualEnabled: boolean;
  gatewayEnabled: boolean;
  gatewayReady: boolean;
  manualInstructions: string;
  proofs: { id: string; fileName: string | null; note: string | null; status: string; reviewNote: string | null; createdAt: string }[];
}

/** Detail satu invoice milik tenant aktif + instruksi pembayaran yang berlaku. */
export async function getTenantInvoiceDetail(invoiceId: string): Promise<ActionResult<TenantInvoiceDetail>> {
  try {
    const tenant = await requireTenant({ allowUnpaid: true });
    await requireUser();

    const inv = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenant_id: tenant.id },
      include: {
        lines: { orderBy: { created_at: "asc" } },
        subscription: { select: { plan: { select: { name: true } } } },
        payment_proofs: { orderBy: { created_at: "desc" } },
      },
    });
    if (!inv) return fail("Invoice tidak ditemukan.");

    const [{ settings, gatewayReady, manualReady }, bankAccounts] = await Promise.all([
      getAvailablePaymentMethods(),
      getActiveBankAccounts(),
    ]);

    return ok({
      id: inv.id,
      number: inv.invoice_number,
      period: inv.billing_period,
      periodStart: inv.period_start?.toISOString() ?? null,
      periodEnd: inv.period_end?.toISOString() ?? null,
      subtotal: Number(inv.subtotal),
      discount: Number(inv.discount),
      voucherCode: inv.voucher_code,
      amount: Number(inv.amount),
      status: inv.status,
      dueDate: inv.due_date.toISOString(),
      paidAt: inv.paid_at?.toISOString() ?? null,
      paymentMethod: inv.payment_method,
      paymentReference: inv.payment_reference,
      lines: inv.lines.map((l) => ({ description: l.description, amount: Number(l.amount) })),
      planName: inv.subscription.plan.name,
      tenantName: tenant.name,
      bankAccounts,
      manualEnabled: manualReady,
      gatewayEnabled: settings.gatewayEnabled,
      gatewayReady,
      manualInstructions: settings.manualInstructions,
      proofs: inv.payment_proofs.map((p) => ({
        id: p.id,
        fileName: p.file_name,
        note: p.note,
        status: p.status,
        reviewNote: p.review_note,
        createdAt: p.created_at.toISOString(),
      })),
    });
  } catch (e) {
    console.error("getTenantInvoiceDetail:", e);
    return fail(safeError(e, "Gagal memuat invoice."));
  }
}

function fileExt(name: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

/** Presigned URL untuk mengunggah bukti transfer invoice (maks 5 MB, JPG/PNG/PDF). */
export async function createPaymentProofUploadUrl(
  invoiceId: string,
  input: { fileName: string; size: number },
): Promise<ActionResult<{ uploadUrl: string; objectKey: string }>> {
  try {
    const tenant = await requireTenant({ allowUnpaid: true });
    await requireUser();
    if (!storageReady()) return fail("Penyimpanan file belum dikonfigurasi. Hubungi admin sistem.");

    const { manualReady } = await getAvailablePaymentMethods();
    if (!manualReady) return fail("Pembayaran manual sedang tidak tersedia.");

    const inv = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenant_id: tenant.id },
      select: { id: true, status: true },
    });
    if (!inv) return fail("Invoice tidak ditemukan.");
    if (inv.status === "PAID") return fail("Invoice ini sudah lunas.");
    if (inv.status === "WAIVED") return fail("Invoice ini dibebaskan — tidak perlu dibayar.");

    const ext = fileExt(input.fileName ?? "");
    if (!ext || !PAYMENT_PROOF_EXT.includes(ext)) {
      return fail("Format file harus JPG, PNG, atau PDF.");
    }
    if (!Number.isFinite(input.size) || input.size <= 0) return fail("Ukuran file tidak valid.");
    if (input.size > PAYMENT_PROOF_MAX_BYTES) {
      return fail(`File terlalu besar. Maksimum ${Math.round(PAYMENT_PROOF_MAX_BYTES / 1024 / 1024)} MB.`);
    }

    const objectKey = `${PAYMENT_PROOF_NAMESPACE}/${tenant.id}/${invoiceId}/${crypto.randomUUID()}.${ext}`;
    const uploadUrl = await presignPutUrl(objectKey);
    return ok({ uploadUrl, objectKey });
  } catch (e) {
    console.error("createPaymentProofUploadUrl:", e);
    return fail(safeError(e, "Gagal menyiapkan upload bukti pembayaran."));
  }
}

/** Catat bukti transfer yang sudah diunggah agar direview Super Admin. */
export async function submitPaymentProof(
  invoiceId: string,
  input: { fileKey: string; fileName?: string; note?: string },
): Promise<ActionResult<null>> {
  try {
    const tenant = await requireTenant({ allowUnpaid: true });
    const actor = await requireUser();

    const inv = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenant_id: tenant.id },
      select: { id: true, status: true },
    });
    if (!inv) return fail("Invoice tidak ditemukan.");
    if (inv.status === "PAID") return fail("Invoice ini sudah lunas.");
    if (inv.status === "WAIVED") return fail("Invoice ini dibebaskan — tidak perlu dibayar.");

    if (!isTenantKey(input.fileKey, tenant.id, [PAYMENT_PROOF_NAMESPACE])) {
      return fail("File bukti pembayaran tidak valid.");
    }

    const pending = await prisma.paymentProof.findFirst({
      where: { invoice_id: invoiceId, tenant_id: tenant.id, status: "PENDING" },
      select: { id: true },
    });
    if (pending) return fail("Bukti pembayaran Anda sedang direview. Tunggu keputusan tim kami.");

    await prisma.paymentProof.create({
      data: {
        tenant_id: tenant.id,
        invoice_id: invoiceId,
        file_key: input.fileKey,
        file_name: input.fileName?.trim() || null,
        note: input.note?.trim() || null,
        status: "PENDING",
        uploaded_by: actor.id,
      },
    });

    revalidatePath(`/owner/billing/invoice/${invoiceId}`);
    revalidatePath("/owner/billing");
    return ok(null);
  } catch (e) {
    console.error("submitPaymentProof:", e);
    return fail(safeError(e, "Gagal mengirim bukti pembayaran."));
  }
}
