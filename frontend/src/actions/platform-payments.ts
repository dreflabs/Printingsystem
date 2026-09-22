"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, requireSubLevel } from "@/lib/platform";
import { logPlatform, headerMeta } from "@/lib/platform-audit";
import { getPaymentSettings, savePaymentSettings, isGatewayConfigured, canEnableGateway, GATEWAY_INTEGRATION_PENDING, GATEWAY_PROVIDERS, type PaymentSettings } from "@/lib/payment-settings";
import { activateTenantForPaidInvoice } from "@/lib/billing";
import { safeError } from "@/lib/safe-error";
import { ok, fail } from "@/types";

const num = (v: unknown) => Number(v ?? 0);

// ─────────────────────────────────────────────────────────────────────────────
// Pengaturan metode pembayaran
// ─────────────────────────────────────────────────────────────────────────────

export async function getPaymentSettingsAdmin() {
  try {
    await requireSuperAdmin();
    const settings = await getPaymentSettings();
    return ok({
      settings,
      gatewayConfigured: isGatewayConfigured(settings.gatewayProvider),
      gatewayPending: GATEWAY_INTEGRATION_PENDING,
      providers: GATEWAY_PROVIDERS.map((p) => ({ key: p.key, label: p.label })),
    });
  } catch (e) {
    console.error("getPaymentSettingsAdmin:", e);
    return fail(safeError(e, "Gagal memuat pengaturan pembayaran."));
  }
}

export async function updatePaymentSettings(input: PaymentSettings) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN", "FINANCE");
    if (!input.gatewayEnabled && !input.manualEnabled) {
      return fail("Minimal satu metode pembayaran harus aktif.");
    }
    if (input.gatewayEnabled && !input.gatewayProvider) {
      return fail("Pilih provider gateway sebelum mengaktifkannya.");
    }
    if (input.gatewayEnabled && !canEnableGateway(input.gatewayProvider)) {
      return fail(
        GATEWAY_INTEGRATION_PENDING
          ? "Integrasi payment gateway masih dipending. Gunakan transfer bank manual untuk sekarang."
          : "Kredensial provider gateway belum dikonfigurasi di environment.",
      );
    }
    const saved = await savePaymentSettings(input);
    const meta = await headerMeta();
    await logPlatform({
      actorId: actor.id,
      actorName: actor.name,
      actorSubLevel: actor.subLevel,
      action: "PAYMENT_SETTINGS_UPDATED",
      targetType: "PlatformSetting",
      targetLabel: "payment.methods",
      detail: {
        gatewayEnabled: saved.gatewayEnabled,
        manualEnabled: saved.manualEnabled,
        gatewayProvider: saved.gatewayProvider,
        gatewayConfigured: isGatewayConfigured(saved.gatewayProvider),
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    revalidatePath("/platform/payments");
    return ok(saved);
  } catch (e) {
    console.error("updatePaymentSettings:", e);
    return fail(safeError(e, "Gagal menyimpan pengaturan pembayaran."));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rekening bank tujuan transfer manual
// ─────────────────────────────────────────────────────────────────────────────

export type BankAccountInput = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  label?: string;
  notes?: string;
  active: boolean;
  sortOrder?: number;
};

function validateBankAccount(input: BankAccountInput): string | null {
  if (!input.bankName?.trim()) return "Nama bank wajib diisi.";
  if (!input.accountNumber?.trim()) return "Nomor rekening wajib diisi.";
  if (!/^[0-9\s-]{4,40}$/.test(input.accountNumber.trim())) return "Nomor rekening hanya angka, spasi, atau strip.";
  if (!input.accountHolder?.trim()) return "Nama pemilik rekening wajib diisi.";
  return null;
}

export async function listBankAccounts() {
  try {
    await requireSuperAdmin();
    const rows = await prisma.bankAccount.findMany({ orderBy: [{ sort_order: "asc" }, { created_at: "asc" }] });
    return ok(
      rows.map((b) => ({
        id: b.id,
        bankName: b.bank_name,
        accountNumber: b.account_number,
        accountHolder: b.account_holder,
        label: b.label,
        notes: b.notes,
        active: b.active,
        sortOrder: b.sort_order,
      })),
    );
  } catch (e) {
    console.error("listBankAccounts:", e);
    return fail(safeError(e, "Gagal memuat rekening."));
  }
}

export async function createBankAccount(input: BankAccountInput) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN", "FINANCE");
    const err = validateBankAccount(input);
    if (err) return fail(err);

    const created = await prisma.bankAccount.create({
      data: {
        bank_name: input.bankName.trim(),
        account_number: input.accountNumber.trim(),
        account_holder: input.accountHolder.trim(),
        label: input.label?.trim() || null,
        notes: input.notes?.trim() || null,
        active: input.active,
        sort_order: input.sortOrder ?? 0,
      },
    });
    const meta = await headerMeta();
    await logPlatform({
      actorId: actor.id,
      actorName: actor.name,
      actorSubLevel: actor.subLevel,
      action: "BANK_ACCOUNT_CREATED",
      targetType: "BankAccount",
      targetId: created.id,
      targetLabel: `${created.bank_name} ${created.account_number}`,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    revalidatePath("/platform/payments");
    return ok({ id: created.id });
  } catch (e) {
    console.error("createBankAccount:", e);
    return fail(safeError(e, "Gagal menambah rekening."));
  }
}

export async function updateBankAccount(id: string, input: BankAccountInput) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN", "FINANCE");
    const err = validateBankAccount(input);
    if (err) return fail(err);

    const existing = await prisma.bankAccount.findUnique({ where: { id } });
    if (!existing) return fail("Rekening tidak ditemukan.");

    await prisma.bankAccount.update({
      where: { id },
      data: {
        bank_name: input.bankName.trim(),
        account_number: input.accountNumber.trim(),
        account_holder: input.accountHolder.trim(),
        label: input.label?.trim() || null,
        notes: input.notes?.trim() || null,
        active: input.active,
        sort_order: input.sortOrder ?? 0,
      },
    });
    const meta = await headerMeta();
    await logPlatform({
      actorId: actor.id,
      actorName: actor.name,
      actorSubLevel: actor.subLevel,
      action: "BANK_ACCOUNT_UPDATED",
      targetType: "BankAccount",
      targetId: id,
      targetLabel: `${input.bankName.trim()} ${input.accountNumber.trim()}`,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    revalidatePath("/platform/payments");
    return ok({ id });
  } catch (e) {
    console.error("updateBankAccount:", e);
    return fail(safeError(e, "Gagal memperbarui rekening."));
  }
}

export async function deleteBankAccount(id: string) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN", "FINANCE");
    const existing = await prisma.bankAccount.findUnique({ where: { id } });
    if (!existing) return fail("Rekening tidak ditemukan.");

    await prisma.bankAccount.delete({ where: { id } });
    const meta = await headerMeta();
    await logPlatform({
      actorId: actor.id,
      actorName: actor.name,
      actorSubLevel: actor.subLevel,
      action: "BANK_ACCOUNT_DELETED",
      targetType: "BankAccount",
      targetId: id,
      targetLabel: `${existing.bank_name} ${existing.account_number}`,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    revalidatePath("/platform/payments");
    return ok(null);
  } catch (e) {
    console.error("deleteBankAccount:", e);
    return fail(safeError(e, "Gagal menghapus rekening."));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bukti pembayaran manual
// ─────────────────────────────────────────────────────────────────────────────

export async function listPaymentProofs(status?: "PENDING" | "APPROVED" | "REJECTED") {
  try {
    await requireSuperAdmin();
    const rows = await prisma.paymentProof.findMany({
      where: status ? { status } : undefined,
      orderBy: { created_at: "desc" },
      take: 100,
      include: {
        tenant: { select: { slug: true, name: true } },
        invoice: { select: { invoice_number: true, amount: true, status: true, billing_period: true } },
      },
    });
    return ok(
      rows.map((p) => ({
        id: p.id,
        tenantSlug: p.tenant.slug,
        tenantName: p.tenant.name,
        invoiceNumber: p.invoice.invoice_number,
        invoiceAmount: num(p.invoice.amount),
        invoiceStatus: p.invoice.status,
        billingPeriod: p.invoice.billing_period,
        fileName: p.file_name,
        note: p.note,
        status: p.status,
        reviewNote: p.review_note,
        createdAt: p.created_at.toISOString(),
      })),
    );
  } catch (e) {
    console.error("listPaymentProofs:", e);
    return fail(safeError(e, "Gagal memuat bukti pembayaran."));
  }
}

export async function reviewPaymentProof(
  id: string,
  decision: "APPROVE" | "REJECT",
  note?: string,
) {
  try {
    const actor = await requireSubLevel("SUPER_ADMIN", "FINANCE");
    if (decision === "REJECT" && !note?.trim()) return fail("Alasan penolakan wajib diisi.");

    const proof = await prisma.paymentProof.findUnique({
      where: { id },
      include: {
        invoice: { select: { id: true, invoice_number: true, amount: true, status: true } },
        tenant: { select: { slug: true } },
      },
    });
    if (!proof) return fail("Bukti pembayaran tidak ditemukan.");
    if (proof.status !== "PENDING") return fail("Bukti ini sudah direview.");

    await prisma.$transaction(async (tx) => {
      await tx.paymentProof.update({
        where: { id },
        data: {
          status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
          reviewed_by: actor.id,
          reviewed_at: new Date(),
          review_note: note?.trim() || null,
        },
      });
      if (decision === "APPROVE" && proof.invoice.status !== "PAID") {
        await tx.invoice.update({
          where: { id: proof.invoice.id },
          data: {
            status: "PAID",
            paid_at: new Date(),
            payment_method: "MANUAL_TRANSFER",
            payment_reference: proof.file_name ?? null,
          },
        });
        // Tanpa free trial: begitu invoice pertama lunas, tenant UNPAID dibuka.
        await activateTenantForPaidInvoice(tx, proof.tenant_id);
      }
    });

    const meta = await headerMeta();
    await logPlatform({
      actorId: actor.id,
      actorName: actor.name,
      actorSubLevel: actor.subLevel,
      action: decision === "APPROVE" ? "PAYMENT_PROOF_APPROVED" : "PAYMENT_PROOF_REJECTED",
      targetType: "Tenant",
      targetLabel: proof.tenant.slug,
      detail: {
        proofId: id,
        invoice: proof.invoice.invoice_number,
        amount: num(proof.invoice.amount),
        note: note?.trim() || null,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    revalidatePath("/platform/payments");
    revalidatePath("/platform/billing");
    return ok(null);
  } catch (e) {
    console.error("reviewPaymentProof:", e);
    return fail(safeError(e, "Gagal mereview bukti pembayaran."));
  }
}
