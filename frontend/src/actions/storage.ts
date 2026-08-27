"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { ok, fail, type ActionResult } from "@/types";

const isGudang = (r: string) => r === "gudang";
const isAdmin = (r: string) => r === "admin" || r === "owner";

/** Buang prefix "LOC:" dari hasil scan Location QR. */
function cleanLocationCode(v: string): string {
  return v.trim().replace(/^LOC:/i, "").trim();
}

async function findJobByCode(tx: Prisma.TransactionClient, tenantId: string, code: string) {
  const c = code.trim();
  let job = await tx.productionJob.findFirst({
    where: { tenant_id: tenantId, job_code: c },
    include: { order: { include: { customer: true } } },
  });
  if (!job) {
    const order = await tx.order.findFirst({ where: { tenant_id: tenantId, order_code: c } });
    if (order) {
      job = await tx.productionJob.findFirst({
        where: { tenant_id: tenantId, order_id: order.id },
        include: { order: { include: { customer: true } } },
        orderBy: { created_at: "desc" },
      });
    }
  }
  return job;
}

// ─────────────────────────────────────────────────────────────
// LOKASI STORAGE
// ─────────────────────────────────────────────────────────────

export async function getStorageLocations() {
  try {
    const tenant = await requireTenant();
    const locs = await prisma.storageLocation.findMany({
      where: { tenant_id: tenant.id },
      orderBy: { location_code: "asc" },
    });
    return ok(
      locs.map((l) => ({
        ...l,
        available: l.capacity_max - l.capacity_current,
        isFull: l.capacity_current >= l.capacity_max,
      }))
    );
  } catch (e) {
    console.error("getStorageLocations:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat lokasi storage.");
  }
}

export async function createStorageLocation(data: {
  zone: string;
  rack?: string;
  slot?: string;
  floor?: number;
  name?: string;
  capacityMax?: number;
}) {
  try {
    const tenant = await requireTenant();
    if (!data.zone?.trim()) return fail("Zona wajib diisi.");
    const floor = data.floor ?? 3;
    const parts = [`LT${floor}`, data.zone.trim().toUpperCase(), data.rack?.trim(), data.slot?.trim()].filter(Boolean);
    const code = parts.join("-");

    const existing = await prisma.storageLocation.findFirst({
      where: { tenant_id: tenant.id, location_code: code },
    });
    if (existing) return fail(`Lokasi ${code} sudah terdaftar.`);

    const loc = await prisma.storageLocation.create({
      data: {
        tenant_id: tenant.id,
        location_code: code,
        name: data.name || `Lantai ${floor} Zona ${data.zone.toUpperCase()}${data.rack ? ` Rak ${data.rack}` : ""}${data.slot ? ` Slot ${data.slot}` : ""}`,
        floor,
        zone: data.zone.trim().toUpperCase(),
        rack: data.rack?.trim() || null,
        slot: data.slot?.trim() || null,
        capacity_max: data.capacityMax ?? 1,
        qr_code_value: `LOC:${code}`,
      },
    });
    revalidatePath("/finishing");
    return ok(loc);
  } catch (e) {
    console.error("createStorageLocation:", e);
    return fail(e instanceof Error ? e.message : "Gagal membuat lokasi storage.");
  }
}

// ─────────────────────────────────────────────────────────────
// SCAN 6 + 7 — SIMPAN KE GUDANG
// ─────────────────────────────────────────────────────────────

export async function assignStorageLocation(
  jobCode: string,
  locationCode: string,
  input?: { quantity?: number }
): Promise<ActionResult<{ locationCode: string; orderStatus: string; notified: boolean }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isGudang(actor.role)) return fail("Hanya role Gudang yang bisa menyimpan ke storage.");

    const result = await prisma.$transaction(async (tx) => {
      const job = await findJobByCode(tx, tenant.id, jobCode);
      if (!job) throw new Error("Job tidak ditemukan.");
      if (job.status !== "FINISHING_COMPLETE") {
        throw new Error(`Job harus FINISHING_COMPLETE (sekarang: ${job.status}).`);
      }

      const existing = await tx.storageItem.findFirst({
        where: { job_id: job.id, status: { in: ["STORED", "IN_TRANSIT"] } },
      });
      if (existing) throw new Error("Job ini sudah tersimpan di lokasi lain.");

      const code = cleanLocationCode(locationCode);
      const loc = await tx.storageLocation.findFirst({
        where: { tenant_id: tenant.id, location_code: code, active: true },
      });
      if (!loc) throw new Error(`Lokasi ${code} tidak ditemukan / tidak aktif.`);
      if (loc.capacity_current >= loc.capacity_max) {
        throw new Error(`Lokasi ${code} penuh. Pilih lokasi lain.`);
      }

      const quantity = input?.quantity ?? job.actual_qty ?? job.planned_qty;
      await tx.storageItem.create({
        data: {
          tenant_id: tenant.id,
          job_id: job.id,
          location_id: loc.id,
          quantity,
          status: "STORED",
          stored_by: actor.id,
        },
      });
      await tx.storageLocation.update({
        where: { id: loc.id },
        data: { capacity_current: { increment: 1 } },
      });

      await tx.productionJob.update({ where: { id: job.id }, data: { status: "STORED" } });
      await tx.order.updateMany({
        where: { id: job.order_id, status: { in: ["FINISHING_COMPLETE", "STORAGE_PENDING"] } },
        data: { status: "READY_FOR_PICKUP" },
      });

      // Notifikasi WhatsApp (layer provider terpisah — di sini hanya antrikan PENDING)
      let notified = false;
      const order = job.order;
      if (order.customer_id && order.customer?.phone) {
        const lunas = Number(order.balance) <= 0;
        await tx.notificationEvent.create({
          data: {
            tenant_id: tenant.id,
            order_id: order.id,
            customer_id: order.customer_id,
            event_type: "READY_FOR_PICKUP",
            channel: "WHATSAPP",
            recipient: order.customer.phone,
            template_code: lunas ? "READY_FOR_PICKUP_PAID" : "READY_FOR_PICKUP_UNPAID",
            status: "PENDING",
          },
        });
        notified = true;
      }

      return { orderId: job.order_id, jobCode: job.job_code, locationCode: code, orderStatus: "READY_FOR_PICKUP", notified };
    });

    await logAction(actor.id, "STORED", "ProductionJob", result.jobCode, null, { location: result.locationCode });
    revalidatePath("/finishing");
    revalidatePath("/scan");
    return ok({ locationCode: result.locationCode, orderStatus: result.orderStatus, notified: result.notified });
  } catch (e) {
    console.error("assignStorageLocation:", e);
    return fail(e instanceof Error ? e.message : "Gagal menyimpan ke storage.");
  }
}

export async function reportStorageIncident(
  jobCode: string,
  input: { notes: string }
): Promise<ActionResult<null>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isGudang(actor.role) && !isAdmin(actor.role)) return fail("Tidak berwenang melaporkan insiden.");
    if (!input.notes?.trim()) return fail("Catatan insiden wajib diisi.");

    await prisma.$transaction(async (tx) => {
      const job = await findJobByCode(tx, tenant.id, jobCode);
      if (!job) throw new Error("Job tidak ditemukan.");
      const item = await tx.storageItem.findFirst({
        where: { job_id: job.id, status: { in: ["STORED", "IN_TRANSIT"] } },
      });
      if (!item) throw new Error("Storage item aktif tidak ditemukan untuk job ini.");

      await tx.storageItem.update({
        where: { id: item.id },
        data: {
          status: "INCIDENT",
          incident_reported_at: new Date(),
          incident_reported_by: actor.id,
          incident_notes: input.notes.trim(),
        },
      });
      await tx.order.update({ where: { id: job.order_id }, data: { status: "INCIDENT" } });
    });

    await logAction(actor.id, "STORAGE_INCIDENT", "ProductionJob", jobCode.trim(), null, { notes: input.notes });
    revalidatePath("/finishing");
    revalidatePath("/owner");
    return ok(null);
  } catch (e) {
    console.error("reportStorageIncident:", e);
    return fail(e instanceof Error ? e.message : "Gagal melaporkan insiden.");
  }
}

// ─────────────────────────────────────────────────────────────
// SCAN 9 — KONFIRMASI BARANG DI COUNTER
// ─────────────────────────────────────────────────────────────

export async function confirmItemAtCounter(jobCode: string): Promise<ActionResult<{ orderStatus: string }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isGudang(actor.role)) return fail("Hanya role Gudang yang bisa konfirmasi barang di counter.");

    const result = await prisma.$transaction(async (tx) => {
      const job = await findJobByCode(tx, tenant.id, jobCode);
      if (!job) throw new Error("Job tidak ditemukan.");
      if (job.order.status !== "READY_FOR_PICKUP") {
        throw new Error(`Order belum READY_FOR_PICKUP (sekarang: ${job.order.status}).`);
      }
      const item = await tx.storageItem.findFirst({ where: { job_id: job.id, status: "STORED" } });
      if (!item) throw new Error("Barang tidak ada di storage (status bukan STORED).");

      const counter = await tx.storageLocation.findFirst({
        where: { tenant_id: tenant.id, zone: "COUNTER", active: true },
        orderBy: { location_code: "asc" },
      });

      await tx.storageItem.update({
        where: { id: item.id },
        data: {
          status: "IN_TRANSIT",
          transit_at: new Date(),
          transit_by: actor.id,
          transit_location_id: counter?.id ?? null,
        },
      });
      await tx.storageLocation.update({
        where: { id: item.location_id },
        data: { capacity_current: { decrement: 1 } },
      });
      await tx.order.update({ where: { id: job.order_id }, data: { status: "IN_TRANSIT" } });
      return { jobCode: job.job_code, orderStatus: "IN_TRANSIT" };
    });

    await logAction(actor.id, "IN_TRANSIT", "ProductionJob", result.jobCode, null, null);
    revalidatePath("/scan");
    return ok({ orderStatus: result.orderStatus });
  } catch (e) {
    console.error("confirmItemAtCounter:", e);
    return fail(e instanceof Error ? e.message : "Gagal konfirmasi barang di counter.");
  }
}

// ─────────────────────────────────────────────────────────────
// SCAN 10 — RELEASE FINAL KE KONSUMEN
// ─────────────────────────────────────────────────────────────

export interface ReleaseOrderInput {
  receiverName: string;
  receiverIdType?: string;
  receiverIdNumber?: string;
  photoPath?: string;
  notes?: string;
  /** hanya berlaku jika actor = owner: izinkan release walau ada sisa tagihan */
  ownerOverrideReason?: string;
}

export async function releaseOrder(
  jobCode: string,
  input: ReleaseOrderInput
): Promise<ActionResult<{ orderStatus: string }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (actor.role !== "admin" && actor.role !== "owner") {
      return fail("Hanya Admin/Owner yang bisa melakukan release final.");
    }
    if (!input.receiverName?.trim()) return fail("Nama penerima wajib diisi.");

    const result = await prisma.$transaction(async (tx) => {
      const job = await findJobByCode(tx, tenant.id, jobCode);
      if (!job) throw new Error("Job tidak ditemukan.");
      const order = job.order;

      if (order.status !== "IN_TRANSIT" && order.status !== "READY_FOR_PICKUP") {
        throw new Error(`Order tidak siap diserahkan (status: ${order.status}).`);
      }
      const already = await tx.pickupRecord.findFirst({ where: { order_id: order.id } });
      if (already) throw new Error("Order ini sudah pernah diserahkan.");

      const lunas = Number(order.balance) <= 0;
      if (!lunas) {
        if (actor.role !== "owner" || !input.ownerOverrideReason?.trim()) {
          throw new Error(
            `Masih ada sisa tagihan Rp ${Number(order.balance).toLocaleString("id-ID")}. Butuh pelunasan atau override Owner.`
          );
        }
      }

      await tx.pickupRecord.create({
        data: {
          tenant_id: tenant.id,
          order_id: order.id,
          released_by: actor.id,
          receiver_name: input.receiverName.trim(),
          receiver_id_type: input.receiverIdType || null,
          receiver_id_number: input.receiverIdNumber || null,
          photo_path: input.photoPath || null,
          notes: input.ownerOverrideReason
            ? `OVERRIDE OWNER: ${input.ownerOverrideReason.trim()}${input.notes ? ` | ${input.notes}` : ""}`
            : input.notes || null,
        },
      });

      await tx.storageItem.updateMany({
        where: { job_id: job.id, status: { in: ["IN_TRANSIT", "STORED"] } },
        data: { status: "RELEASED", released_by: actor.id, released_at: new Date() },
      });
      await tx.productionJob.update({ where: { id: job.id }, data: { status: "PICKED_UP" } });
      // PICKED_UP → FINAL_AUDIT_PENDING (sistem)
      await tx.order.update({
        where: { id: order.id },
        data: { status: "FINAL_AUDIT_PENDING", closed_at: null },
      });

      return { jobCode: job.job_code, orderId: order.id, orderStatus: "FINAL_AUDIT_PENDING", overridden: !lunas };
    });

    await logAction(
      actor.id,
      result.overridden ? "ORDER_RELEASED_OVERRIDE" : "ORDER_RELEASED",
      "Order",
      result.orderId,
      null,
      { receiver: input.receiverName, override_reason: input.ownerOverrideReason }
    );
    revalidatePath("/scan");
    revalidatePath("/admin");
    return ok({ orderStatus: result.orderStatus });
  } catch (e) {
    console.error("releaseOrder:", e);
    return fail(e instanceof Error ? e.message : "Gagal melakukan release order.");
  }
}
