import { prisma } from "@/lib/prisma";
import { logPlatform, headerMeta } from "@/lib/platform-audit";
import type { PlatformActor } from "@/lib/platform";

const num = (v: unknown) => Number(v ?? 0);

export type InvoiceStatus = "PENDING" | "PAID" | "FAILED" | "WAIVED";
export const INVOICE_STATUSES: InvoiceStatus[] = ["PENDING", "PAID", "FAILED", "WAIVED"];
/** Invoice yang masih menagih uang. */
export const UNPAID_STATUSES: InvoiceStatus[] = ["PENDING", "FAILED"];

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

export type GenerateResult = {
  period: string;
  yyyymm: string;
  dueDate: Date;
  created: { slug: string; number: string; amount: number }[];
  skipped: { slug: string; reason: string }[];
};

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
  const { start, yyyymm, label } = resolvePeriod(opts.period);
  const dueDays = opts.dueInDays && opts.dueInDays > 0 ? Math.round(opts.dueInDays) : 14;
  const dueDate = new Date(start.getTime() + dueDays * 24 * 60 * 60 * 1000);
  const prefix = `INV-${yyyymm}-`;

  const subs = await prisma.tenantSubscription.findMany({
    where: { status: "ACTIVE", tenant: { status: "ACTIVE" } },
    include: {
      plan: { select: { price_monthly: true } },
      tenant: { select: { id: true, slug: true } },
    },
  });

  const existing = await prisma.invoice.findMany({
    where: { invoice_number: { startsWith: prefix } },
    select: { tenant_id: true, invoice_number: true },
  });
  const already = new Set(existing.map((e) => e.tenant_id));
  let seq = existing.reduce((max, e) => {
    const n = parseInt(e.invoice_number.slice(prefix.length), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);

  const created: GenerateResult["created"] = [];
  const skipped: GenerateResult["skipped"] = [];

  for (const s of subs) {
    if (already.has(s.tenant.id)) {
      skipped.push({ slug: s.tenant.slug, reason: "sudah ada invoice periode ini" });
      continue;
    }
    const amount = num(s.plan.price_monthly);
    if (amount <= 0) {
      skipped.push({ slug: s.tenant.slug, reason: "harga paket 0" });
      continue;
    }
    seq += 1;
    const number = prefix + String(seq).padStart(5, "0");
    await prisma.invoice.create({
      data: {
        tenant_id: s.tenant.id,
        subscription_id: s.id,
        invoice_number: number,
        amount,
        status: "PENDING",
        due_date: dueDate,
      },
    });
    already.add(s.tenant.id);
    created.push({ slug: s.tenant.slug, number, amount });
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
