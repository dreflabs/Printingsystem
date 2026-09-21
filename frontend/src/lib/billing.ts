import { prisma } from "@/lib/prisma";
import { logPlatform, headerMeta } from "@/lib/platform-audit";
import type { PlatformActor } from "@/lib/platform";
import { computeOrderEstimate, PAYMENT_DUE_DAYS, SAAS_PLANS, type SelfServePlanKey } from "@/lib/saas-catalog";
import { validateVoucher } from "@/lib/voucher";

const num = (v: unknown) => Number(v ?? 0);

export type InvoiceStatus = "PENDING" | "PAID" | "FAILED" | "WAIVED";
export const INVOICE_STATUSES: InvoiceStatus[] = ["PENDING", "PAID", "FAILED", "WAIVED"];
/** Invoice yang masih menagih uang. */
export const UNPAID_STATUSES: InvoiceStatus[] = ["PENDING", "FAILED"];

const PLAN_KEY_BY_SLUG = Object.fromEntries(
  Object.entries(SAAS_PLANS).map(([key, p]) => [p.slug, key as SelfServePlanKey]),
) as Record<string, SelfServePlanKey>;

/** "2026-09" → {start, end, yyyymm, label}. Tanpa argumen = bulan berjalan. */
export function resolvePeriod(period?: string): { start: Date; end: Date; yyyymm: string; label: string } {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth(); // 0-indexed
  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [ys, ms] = period.split("-");
    y = Number(ys);
    m = Number(ms) - 1;
  }
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 1);
  const yyyymm = `${y}${String(m + 1).padStart(2, "0")}`;
  const label = start.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  return { start, end, yyyymm, label };
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + Math.max(1, months));
  return d;
}

export type GenerateResult = {
  period: string;
  yyyymm: string;
  dueDate: Date;
  created: { slug: string; number: string; amount: number; discount: number }[];
  skipped: { slug: string; reason: string }[];
};

export type CreatedInvoice = {
  id: string;
  number: string;
  amount: number;
  discount: number;
  subtotal: number;
  dueDate: Date;
};

/**
 * Susun baris invoice dari pilihan langganan tenant (paket + termin + kursi
 * add-on + layanan). Kalau paket tidak ada di katalog self-serve (mis. paket
 * kustom dari panel platform), jatuh ke satu baris harga bulanan.
 */
function buildLines(input: {
  tenantId: string;
  planSlug: string;
  planName: string;
  planPriceMonthly: number;
  termMonths: number;
  addonUsers: number;
  serviceKeys: string[];
}) {
  const planKey = PLAN_KEY_BY_SLUG[input.planSlug];
  if (!planKey) {
    const months = Math.max(1, input.termMonths);
    const amount = input.planPriceMonthly * months;
    return {
      subtotal: amount,
      lines: [
        {
          tenant_id: input.tenantId,
          kind: "PLAN",
          description: `${input.planName} — ${months} bulan`,
          quantity: months,
          unit_price: input.planPriceMonthly,
          amount,
        },
      ],
    };
  }

  const estimate = computeOrderEstimate({
    plan: planKey,
    months: input.termMonths,
    addonSeats: input.addonUsers,
    services: input.serviceKeys,
  });

  const lines = estimate.lines.map((l) => ({
    tenant_id: input.tenantId,
    kind: l.kind,
    description: l.detail ? `${l.label} — ${l.detail}` : l.label,
    quantity: l.quantity,
    unit_price: l.unitPrice,
    amount: l.amount,
  }));

  return { subtotal: estimate.total, lines };
}

/** Nomor invoice berikutnya untuk periode YYYYMM (INV-YYYYMM-XXXXX). */
async function nextInvoiceNumber(yyyymm: string): Promise<string> {
  const prefix = `INV-${yyyymm}-`;
  const rows = await prisma.invoice.findMany({
    where: { invoice_number: { startsWith: prefix } },
    select: { invoice_number: true },
  });
  let max = 0;
  for (const r of rows) {
    const n = parseInt(r.invoice_number.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return prefix + String(max + 1).padStart(5, "0");
}

/**
 * Terbitkan satu invoice untuk sebuah langganan: baris rinci (paket/termin,
 * kursi add-on, layanan) + voucher sekali pakai. Dipakai bersama oleh
 * generator periodik dan pendaftaran tenant baru (invoice pertama).
 *
 * Idempoten lewat unique (tenant_id, billing_period) dan pemeriksaan invoice
 * yang masih mencakup periode berjalan.
 */
export async function createInvoiceForSubscription(input: {
  tenantId: string;
  subscriptionId: string;
  period?: string;
  dueInDays?: number;
  /** Jatuh tempo eksplisit (mis. invoice pertama = 3 hari sejak daftar). */
  dueDate?: Date;
}): Promise<{ ok: true; invoice: CreatedInvoice } | { ok: false; reason: string }> {
  const { start, yyyymm } = resolvePeriod(input.period);
  const dueDays = input.dueInDays && input.dueInDays > 0 ? Math.round(input.dueInDays) : PAYMENT_DUE_DAYS;
  const dueDate = input.dueDate ?? new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);

  const sub = await prisma.tenantSubscription.findFirst({
    where: { id: input.subscriptionId, tenant_id: input.tenantId, status: "ACTIVE" },
    include: {
      plan: { select: { price_monthly: true, slug: true, name: true } },
      tenant: { select: { id: true, slug: true, addon_users: true } },
    },
  });
  if (!sub) return { ok: false, reason: "langganan tidak aktif" };

  const covering = await prisma.invoice.findFirst({
    where: {
      tenant_id: input.tenantId,
      status: { in: ["PENDING", "PAID"] },
      period_end: { gt: start },
    },
    select: { invoice_number: true },
  });
  if (covering) return { ok: false, reason: `masih tercakup ${covering.invoice_number}` };

  const { subtotal, lines } = buildLines({
    tenantId: sub.tenant.id,
    planSlug: sub.plan.slug,
    planName: sub.plan.name,
    planPriceMonthly: num(sub.plan.price_monthly),
    termMonths: sub.term_months ?? 1,
    addonUsers: sub.tenant.addon_users ?? 0,
    serviceKeys: sub.service_keys ?? [],
  });
  if (subtotal <= 0) return { ok: false, reason: "harga paket 0" };

  let discount = 0;
  let voucherId: string | null = null;
  let voucherCode: string | null = null;
  if (sub.voucher_code) {
    const check = await validateVoucher(sub.voucher_code, subtotal);
    if (check.ok) {
      discount = check.discountAmount;
      voucherId = check.voucher.id;
      voucherCode = check.voucher.code;
    }
  }

  const amount = subtotal - discount;
  const periodEnd = new Date(start.getFullYear(), start.getMonth() + Math.max(1, sub.term_months ?? 1), 1);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const number = await nextInvoiceNumber(yyyymm);
    try {
      const created = await prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.create({
          data: {
            tenant_id: sub.tenant.id,
            subscription_id: sub.id,
            invoice_number: number,
            billing_period: yyyymm,
            period_start: start,
            period_end: periodEnd,
            subtotal,
            discount,
            voucher_code: voucherCode,
            amount,
            currency: "IDR",
            status: "PENDING",
            due_date: dueDate,
            idempotency_key: `manual:${sub.tenant.id}:${yyyymm}`,
            lines: {
              create: [
                ...lines,
                ...(discount > 0
                  ? [
                      {
                        tenant_id: sub.tenant.id,
                        kind: "DISCOUNT",
                        description: `Voucher ${voucherCode}`,
                        quantity: 1,
                        unit_price: -discount,
                        amount: -discount,
                      },
                    ]
                  : []),
              ],
            },
          },
        });

        if (voucherId && voucherCode) {
          await tx.voucher.update({ where: { id: voucherId }, data: { used_count: { increment: 1 } } });
          await tx.voucherRedemption.create({
            data: {
              voucher_id: voucherId,
              tenant_id: sub.tenant.id,
              invoice_id: invoice.id,
              code: voucherCode,
              discount_amount: discount,
            },
          });
          await tx.tenantSubscription.update({ where: { id: sub.id }, data: { voucher_code: null } });
        }

        return invoice;
      });

      return {
        ok: true,
        invoice: { id: created.id, number, amount, discount, subtotal, dueDate },
      };
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "P2002") throw e;
      // Nomor bentrok (race) → coba nomor berikutnya. Kalau yang bentrok adalah
      // unique (tenant, periode), berarti invoice periode ini sudah ada.
      if (attempt === 2) return { ok: false, reason: "sudah ada invoice periode ini" };
    }
  }
  return { ok: false, reason: "gagal membuat invoice" };
}

/**
 * Saat invoice pertama dibayar, tenant UNPAID diaktifkan: status → ACTIVE dan
 * periode langganan diisi sesuai termin. Idempoten — tenant yang sudah ACTIVE
 * tidak disentuh.
 */
export async function activateTenantForPaidInvoice(
  tx: PrismaTransaction,
  tenantId: string,
): Promise<void> {
  const tenant = await tx.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, status: true },
  });
  if (!tenant || tenant.status !== "UNPAID") return;

  const sub = await tx.tenantSubscription.findFirst({
    where: { tenant_id: tenantId, status: "ACTIVE" },
    orderBy: { started_at: "desc" },
    select: { id: true, term_months: true },
  });
  const now = new Date();
  const periodEnd = addMonths(now, sub?.term_months ?? 1);

  await tx.tenant.update({
    where: { id: tenantId },
    data: {
      status: "ACTIVE",
      subscription_started_at: now,
      current_period_start: now,
      current_period_end: periodEnd,
      trial_ends_at: null,
    },
  });
  if (sub) {
    await tx.tenantSubscription.update({ where: { id: sub.id }, data: { ends_at: periodEnd } });
  }
}

type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Terbitkan invoice PENDING untuk tiap tenant ACTIVE dengan langganan ACTIVE
 * yang belum punya invoice periode ini. Idempoten. `actor` null = dipicu cron
 * (tidak menulis PlatformAuditLog aktor).
 */
export async function generateInvoicesForPeriod(opts: {
  period?: string;
  dueInDays?: number;
  actor: PlatformActor | null;
}): Promise<GenerateResult> {
  const { yyyymm, label } = resolvePeriod(opts.period);
  const dueDays = opts.dueInDays && opts.dueInDays > 0 ? Math.round(opts.dueInDays) : PAYMENT_DUE_DAYS;
  const dueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);

  const subs = await prisma.tenantSubscription.findMany({
    where: { status: "ACTIVE", tenant: { status: "ACTIVE" } },
    select: { id: true, tenant: { select: { id: true, slug: true } } },
  });

  const created: GenerateResult["created"] = [];
  const skipped: GenerateResult["skipped"] = [];

  for (const s of subs) {
    const res = await createInvoiceForSubscription({
      tenantId: s.tenant.id,
      subscriptionId: s.id,
      period: opts.period,
      dueInDays: dueDays,
      dueDate,
    });
    if (!res.ok) {
      skipped.push({ slug: s.tenant.slug, reason: res.reason });
      continue;
    }
    created.push({
      slug: s.tenant.slug,
      number: res.invoice.number,
      amount: res.invoice.amount,
      discount: res.invoice.discount,
    });
  }

  if (opts.actor) {
    const meta = await headerMeta();
    await logPlatform({
      actorId: opts.actor.id,
      actorName: opts.actor.name,
      actorSubLevel: opts.actor.subLevel,
      action: "INVOICE_GENERATED",
      targetLabel: yyyymm,
      detail: { period: label, created: created.length, skipped: skipped.length },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  return { period: label, yyyymm, dueDate, created, skipped };
}
