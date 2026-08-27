"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { ok, fail, type ActionResult } from "@/types";

/**
 * Antrikan ulang notifikasi WhatsApp yang gagal.
 * Pengiriman sebenarnya dilakukan oleh layer provider terpisah (belum dibangun) —
 * di sini hanya set status kembali ke PENDING + naikkan retry_count.
 */
export async function retryNotification(id: string): Promise<ActionResult<null>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (actor.role !== "admin" && actor.role !== "owner") return fail("Tidak berwenang.");

    const evt = await prisma.notificationEvent.findFirst({ where: { id, tenant_id: tenant.id } });
    if (!evt) return fail("Notifikasi tidak ditemukan.");
    if (!["FAILED", "RETRY"].includes(evt.status)) return fail("Notifikasi ini tidak dalam status gagal.");

    await prisma.notificationEvent.update({
      where: { id },
      data: {
        status: "PENDING",
        retry_count: { increment: 1 },
        is_resend: true,
        resent_by: actor.id,
        error_message: null,
      },
    });
    await logAction(actor.id, "NOTIFICATION_RETRIED", "NotificationEvent", id, null, { event_type: evt.event_type });
    revalidatePath("/owner");
    revalidatePath("/admin");
    return ok(null);
  } catch (e) {
    console.error("retryNotification:", e);
    return fail(e instanceof Error ? e.message : "Gagal mengulang notifikasi.");
  }
}
