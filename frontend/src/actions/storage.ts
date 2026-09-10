"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser, requireMutableActor } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { allLiveJobsReached, DEAD_JOB_STATUS } from "@/lib/order-progress";
import { safeError } from "@/lib/safe-error";
import { ok, fail, type ActionResult } from "@/types";
import { buildLocationCode, defaultLocationName, buildStorageLocations } from "@/lib/starter-data";

const isGudang = (r: string[]) => r.includes("gudang");
const isAdmin = (r: string[]) => r.includes("admin") || r.includes("owner");

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
    await requireUser();
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
    return fail(safeError(e, "Gagal memuat lokasi storage."));
  }
}

/** Kode `LOC-001`, `LOC-002`, … untuk lokasi mode-sederhana (tanpa zona/rak/slot). */
async function nextSimpleLocationCode(tenantId: string): Promise<string> {
  const rows = await prisma.storageLocation.findMany({
    where: { tenant_id: tenantId, location_code: { startsWith: "LOC-" } },
    select: { location_code: true },
  });
  const max = rows.reduce((m, r) => {
    const n = parseInt(r.location_code.slice(4), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `LOC-${String(max + 1).padStart(3, "0")}`;
}

export async function createStorageLocation(data: {
  /** Mode sederhana: cukup nama bebas ("Rak Depan", "Meja Counter"). */
  name?: string;
  /** Mode terstruktur (gudang bertingkat): zona + rak + slot + lantai. */
  zone?: string;
  rack?: string;
  slot?: string;
  floor?: number;
  capacityMax?: number;
  /** true → lokasi diperlakukan sebagai counter serah terima (dipakai SCAN 9). */
  isCounter?: boolean;
}) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles)) return fail("Hanya Owner/Admin yang boleh menambah lokasi rak.");

    const simple = !data.zone?.trim();
    if (simple && !data.name?.trim()) return fail("Nama lokasi wajib diisi.");

    const floor = simple ? 1 : data.floor ?? 3;
    const code = simple
      ? await nextSimpleLocationCode(tenant.id)
      : buildLocationCode(data.zone!, data.rack, data.slot, floor);
    const zone = simple ? (data.isCounter ? "COUNTER" : "UMUM") : data.zone!.trim().toUpperCase();

    const existing = await prisma.storageLocation.findFirst({
      where: { tenant_id: tenant.id, location_code: code },
    });
    if (existing) return fail(`Lokasi ${code} sudah terdaftar.`);

    const loc = await prisma.storageLocation.create({
      data: {
        tenant_id: tenant.id,
        location_code: code,
        name: data.name?.trim() || defaultLocationName(data.zone!, data.rack, data.slot, floor),
        floor,
        zone,
        rack: simple ? null : data.rack?.trim() || null,
        slot: simple ? null : data.slot?.trim() || null,
        capacity_max: Math.max(1, data.capacityMax ?? 1),
        qr_code_value: `LOC:${code}`,
      },
    });
    await logAction(actor.id, "STORAGE_LOCATION_CREATE", "StorageLocation", code, null, {
      capacity_max: loc.capacity_max,
    });
    revalidatePath("/finishing");
    return ok(loc);
  } catch (e) {
    console.error("createStorageLocation:", e);
    return fail(safeError(e, "Gagal membuat lokasi storage."));
  }
}

/** Ubah nama / kapasitas / status aktif lokasi rak. Owner/Admin. */
export async function updateStorageLocation(
  id: string,
  data: { name?: string; capacityMax?: number; active?: boolean }
) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles)) return fail("Hanya Owner/Admin yang boleh mengubah lokasi rak.");

    const loc = await prisma.storageLocation.findFirst({ where: { id, tenant_id: tenant.id } });
    if (!loc) return fail("Lokasi tidak ditemukan.");

    if (data.capacityMax != null && data.capacityMax < loc.capacity_current)
      return fail(`Kapasitas tidak boleh di bawah isi saat ini (${loc.capacity_current}).`);
    if (data.active === false && loc.capacity_current > 0)
      return fail("Tidak bisa menonaktifkan lokasi yang masih berisi barang.");

    const updated = await prisma.storageLocation.update({
      where: { id },
      data: {
        ...(data.name?.trim() ? { name: data.name.trim() } : {}),
        ...(data.capacityMax != null ? { capacity_max: Math.max(1, data.capacityMax) } : {}),
        ...(data.active != null ? { active: data.active } : {}),
      },
    });
    await logAction(actor.id, "STORAGE_LOCATION_UPDATE", "StorageLocation", loc.location_code, loc, updated);
    revalidatePath("/finishing");
    return ok(updated);
  } catch (e) {
    console.error("updateStorageLocation:", e);
    return fail(safeError(e, "Gagal mengubah lokasi storage."));
  }
}

/** Buat semua lokasi layout standar yang belum ada. Owner/Admin. Idempoten.
 * Layout rekomendasi `02-WORKFLOW/09-STORAGE.md`: A=banner, B=stiker/kartu,
 * C=packaging, D=holding + counter LT1. */
export async function seedDefaultStorageLayout() {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles)) return fail("Hanya Owner/Admin yang boleh membuat layout rak.");

    // Layout-nya dipakai bersama dengan pendaftaran tenant baru (lib/starter-data),
    // supaya rak bawaan dan rak hasil tombol ini selalu identik.
    const existing = new Set(
      (
        await prisma.storageLocation.findMany({
          where: { tenant_id: tenant.id },
          select: { location_code: true },
        })
      ).map((l) => l.location_code)
    );

    const rows = buildStorageLocations(tenant.id, existing);

    if (rows.length === 0) return ok({ created: 0 });
    await prisma.storageLocation.createMany({ data: rows });
    await logAction(actor.id, "STORAGE_LAYOUT_SEED", "StorageLocation", "*", null, { created: rows.length });
    revalidatePath("/finishing");
    return ok({ created: rows.length });
  } catch (e) {
    console.error("seedDefaultStorageLayout:", e);
    return fail(safeError(e, "Gagal membuat layout rak."));
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
    if (!isGudang(actor.roles)) return fail("Hanya role Gudang yang boleh menyimpan ke storage.");

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

      // Klaim slot secara atomik — cegah 2 petugas mengisi slot terakhir bersamaan.
      const claimed = await tx.storageLocation.updateMany({
        where: { id: loc.id, active: true, capacity_current: { lt: loc.capacity_max } },
        data: { capacity_current: { increment: 1 } },
      });
      if (claimed.count === 0) {
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

      await tx.productionJob.update({ where: { id: job.id }, data: { status: "STORED" } });

      // Order → READY_FOR_PICKUP HANYA kalau semua job order sudah tersimpan.
      // Order multi-item bisa punya beberapa job (1 per mesin) — jangan flip &
      // jangan notifikasi pelanggan sampai barang terakhir masuk rak.
      const allStored = await allLiveJobsReached(tx, job.order_id, "STORED");
      let notified = false;
      let orderStatus = job.order.status;
      if (allStored) {
        const flip = await tx.order.updateMany({
          where: {
            id: job.order_id,
            status: { in: ["FINISHING_COMPLETE", "STORAGE_PENDING", "FINISHING_STARTED", "QC_PASSED"] },
          },
          data: { status: "READY_FOR_PICKUP" },
        });
        if (flip.count > 0) {
          orderStatus = "READY_FOR_PICKUP";
          // Notifikasi WhatsApp (layer provider terpisah — di sini hanya antrikan PENDING)
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
        }
      }

      return { orderId: job.order_id, jobCode: job.job_code, locationCode: code, orderStatus, notified };
    });

    await logAction(actor.id, "STORED", "ProductionJob", result.jobCode, null, { location: result.locationCode });
    revalidatePath("/finishing");
    revalidatePath("/scan");
    return ok({ locationCode: result.locationCode, orderStatus: result.orderStatus, notified: result.notified });
  } catch (e) {
    console.error("assignStorageLocation:", e);
    return fail(safeError(e, "Gagal menyimpan ke storage."));
  }
}

export async function reportStorageIncident(
  jobCode: string,
  input: { notes: string }
): Promise<ActionResult<null>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isGudang(actor.roles) && !isAdmin(actor.roles)) return fail("Hanya Gudang atau Owner/Admin yang boleh melaporkan insiden.");
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
    return fail(safeError(e, "Gagal melaporkan insiden."));
  }
}

// ─────────────────────────────────────────────────────────────
// SCAN 9 — KONFIRMASI BARANG DI COUNTER
// ─────────────────────────────────────────────────────────────

export async function confirmItemAtCounter(jobCode: string): Promise<ActionResult<{ orderStatus: string }>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isGudang(actor.roles)) return fail("Hanya role Gudang yang boleh konfirmasi barang di counter.");

    const result = await prisma.$transaction(async (tx) => {
      const job = await findJobByCode(tx, tenant.id, jobCode);
      if (!job) throw new Error("Job tidak ditemukan.");
      // Order multi-job: job pertama membawa order ke IN_TRANSIT, job berikutnya
      // dikonfirmasi selagi order sudah IN_TRANSIT.
      if (job.order.status !== "READY_FOR_PICKUP" && job.order.status !== "IN_TRANSIT") {
        throw new Error(`Order belum siap diambil (sekarang: ${job.order.status}).`);
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
      await tx.productionJob.update({ where: { id: job.id }, data: { status: "IN_TRANSIT" } });

      // Order → IN_TRANSIT hanya kalau semua job order sudah di counter.
      const allTransit = await allLiveJobsReached(tx, job.order_id, "IN_TRANSIT");
      if (allTransit) {
        await tx.order.updateMany({
          where: { id: job.order_id, status: "READY_FOR_PICKUP" },
          data: { status: "IN_TRANSIT" },
        });
      }
      return { jobCode: job.job_code, orderStatus: allTransit ? "IN_TRANSIT" : job.order.status };
    });

    await logAction(actor.id, "IN_TRANSIT", "ProductionJob", result.jobCode, null, null);
    revalidatePath("/scan");
    return ok({ orderStatus: result.orderStatus });
  } catch (e) {
    console.error("confirmItemAtCounter:", e);
    return fail(safeError(e, "Gagal konfirmasi barang di counter."));
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
    const actor = await requireMutableActor();
    if (!actor.roles.includes("admin") && !actor.roles.includes("owner")) {
      return fail("Hanya Admin/Owner yang boleh melakukan release final.");
    }
    if (!input.receiverName?.trim()) return fail("Nama penerima wajib diisi.");

    const result = await prisma.$transaction(async (tx) => {
      const job = await findJobByCode(tx, tenant.id, jobCode);
      if (!job) throw new Error("Job tidak ditemukan.");
      const order = job.order;

      if (order.status !== "IN_TRANSIT" && order.status !== "READY_FOR_PICKUP") {
        throw new Error(`Order tidak siap diserahkan (status: ${order.status}).`);
      }
      // Kebijakan opsional: wajib SCAN 9 (barang dikonfirmasi di counter) sebelum
      // serah terima — order harus sudah IN_TRANSIT, bukan langsung READY_FOR_PICKUP.
      if (order.status === "READY_FOR_PICKUP") {
        const t = await tx.tenant.findUnique({
          where: { id: tenant.id },
          select: { require_counter_confirmation: true },
        });
        if (t?.require_counter_confirmation) {
          throw new Error("Barang belum dikonfirmasi di counter (SCAN 9). Gudang harus scan barang di counter dulu.");
        }
      }
      const already = await tx.pickupRecord.findFirst({ where: { order_id: order.id } });
      if (already) throw new Error("Order ini sudah pernah diserahkan.");

      const lunas = Number(order.balance) <= 0;
      if (!lunas) {
        if (!actor.roles.includes("owner") || !input.ownerOverrideReason?.trim()) {
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

      // Serah terima itu order-level: lepas SEMUA job & storage item order ini,
      // bukan cuma yang di-scan (order multi-item bisa punya beberapa job).
      const orderJobs = await tx.productionJob.findMany({
        where: { order_id: order.id },
        select: { id: true },
      });
      const jobIds = orderJobs.map((j) => j.id);

      // Bebaskan slot rak untuk barang yang belum sempat lewat counter (masih STORED
      // → slot-nya masih terhitung; yang sudah IN_TRANSIT sudah di-decrement di SCAN 9).
      const stillStored = await tx.storageItem.findMany({
        where: { job_id: { in: jobIds }, status: "STORED" },
        select: { location_id: true },
      });
      for (const si of stillStored) {
        await tx.storageLocation.update({
          where: { id: si.location_id },
          data: { capacity_current: { decrement: 1 } },
        });
      }

      await tx.storageItem.updateMany({
        where: { job_id: { in: jobIds }, status: { in: ["IN_TRANSIT", "STORED"] } },
        data: { status: "RELEASED", released_by: actor.id, released_at: new Date() },
      });
      await tx.productionJob.updateMany({
        where: { order_id: order.id, status: { notIn: DEAD_JOB_STATUS } },
        data: { status: "PICKED_UP" },
      });
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
    return fail(safeError(e, "Gagal melakukan release order."));
  }
}

// ─────────────────────────────────────────────────────────────
// PENCARIAN & PETA GUDANG
// ─────────────────────────────────────────────────────────────

export async function getStorageLocationsWithItems() {
  try {
    const tenant = await requireTenant();
    await requireUser();
    const locs = await prisma.storageLocation.findMany({
      where: { tenant_id: tenant.id },
      orderBy: [{ floor: "desc" }, { zone: "asc" }, { rack: "asc" }, { slot: "asc" }],
      include: {
        stored_items: {
          where: { status: "STORED" },
          include: { job: { include: { order: { include: { customer: true } } } } },
        },
      },
    });
    return ok(locs);
  } catch (e) {
    console.error("getStorageLocationsWithItems:", e);
    return fail(safeError(e, "Gagal memuat peta gudang."));
  }
}

export async function searchStorageItems(query: string) {
  try {
    const tenant = await requireTenant();
    await requireUser();
    if (!query || query.trim().length < 3) return ok([]);
    const q = query.trim();
    const items = await prisma.storageItem.findMany({
      where: {
        tenant_id: tenant.id,
        status: { in: ["STORED", "IN_TRANSIT"] },
        job: {
          OR: [
            { job_code: { contains: q, mode: "insensitive" } },
            { order: { order_code: { contains: q, mode: "insensitive" } } },
            { order: { customer: { name: { contains: q, mode: "insensitive" } } } },
          ],
        },
      },
      include: {
        location: true,
        transit_location: true,
        job: { include: { order: { include: { customer: true } } } },
      },
      take: 20,
    });
    return ok(items);
  } catch (e) {
    console.error("searchStorageItems:", e);
    return fail(safeError(e, "Gagal mencari barang."));
  }
}

