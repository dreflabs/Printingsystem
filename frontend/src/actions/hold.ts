"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { ok, fail, type ActionResult } from "@/types";

// Terminal / special statuses that must not be frozen.
const UNFREEZABLE = ["CLOSED", "CANCELLED", "PICKED_UP", "ON_HOLD"];

/**
 * Owner freezes an order — parks it at ON_HOLD regardless of where it is in the
 * pipeline. The pre-hold status is recorded in the audit log (old_value_json.from)
 * so unfreezeOrder can restore it. No schema column needed.
 */
export async function freezeOrder(orderId: string, reason: string): Promise<ActionResult<null>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (actor.role !== "owner") return fail("Hanya Owner yang boleh membekukan order.");
    if (!reason?.trim()) return fail("Alasan pembekuan wajib diisi.");

    const order = await prisma.order.findFirst({ where: { id: orderId, tenant_id: tenant.id } });
    if (!order) return fail("Order tidak ditemukan.");
    if (order.status === "ON_HOLD") return fail("Order ini sudah dibekukan.");
    if (UNFREEZABLE.includes(order.status)) return fail(`Order berstatus ${order.status} tidak bisa dibekukan.`);

    await prisma.order.update({ where: { id: orderId }, data: { status: "ON_HOLD" } });
    await logAction(actor.id, "ORDER_FROZEN", "Order", orderId, { from: order.status }, { reason: reason.trim() });

    revalidatePath("/admin");
    revalidatePath("/owner");
    return ok(null);
  } catch (e) {
    console.error("freezeOrder:", e);
    return fail(e instanceof Error ? e.message : "Gagal membekukan order.");
  }
}

/**
 * Owner unfreezes an order, restoring the status it held before the freeze.
 * Only works for orders that reached ON_HOLD via freezeOrder — an ON_HOLD set by
 * the final-audit RED path or a rework HOLD must be resolved through those flows.
 */
export async function unfreezeOrder(orderId: string, note?: string): Promise<ActionResult<{ restoredTo: string }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (actor.role !== "owner") return fail("Hanya Owner yang boleh mencairkan order.");

    const order = await prisma.order.findFirst({ where: { id: orderId, tenant_id: tenant.id } });
    if (!order) return fail("Order tidak ditemukan.");
    if (order.status !== "ON_HOLD") return fail("Order ini tidak sedang dibekukan.");

    const freezeLog = await prisma.auditLog.findFirst({
      where: { tenant_id: tenant.id, entity_type: "Order", entity_id: orderId, action: "ORDER_FROZEN" },
      orderBy: { created_at: "desc" },
    });

    let restoredTo: string | null = null;
    if (freezeLog?.old_value_json) {
      try {
        const parsed = JSON.parse(freezeLog.old_value_json) as { from?: string };
        if (parsed.from) restoredTo = parsed.from;
      } catch {
        /* fall through */
      }
    }

    if (!restoredTo) {
      return fail(
        "Order ini masuk ON_HOLD bukan lewat pembekuan Owner (mis. audit RED / rework HOLD). Selesaikan lewat alur audit atau rework."
      );
    }

    await prisma.order.update({ where: { id: orderId }, data: { status: restoredTo } });
    await logAction(actor.id, "ORDER_UNFROZEN", "Order", orderId, { from: "ON_HOLD" }, { to: restoredTo, note: note?.trim() || undefined });

    revalidatePath("/admin");
    revalidatePath("/owner");
    return ok({ restoredTo });
  } catch (e) {
    console.error("unfreezeOrder:", e);
    return fail(e instanceof Error ? e.message : "Gagal mencairkan order.");
  }
}
