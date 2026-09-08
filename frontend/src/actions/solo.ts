"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { ok, fail } from "@/types";

/**
 * "Langkah berikutnya" untuk percetakan yang dijalankan sendiri (Solo Mode).
 * Tiap order aktif dipetakan ke satu aksi tahap berikut + ke mana harus pergi,
 * supaya Owner tidak perlu hafal alur 10x scan.
 */

type Step = { label: string; hint: string; href: string };

// Status order terminal / tidak butuh tindakan manual di daftar ini.
const DONE = new Set(["CLOSED", "CANCELLED", "PICKED_UP"]);

function stepFor(status: string, balance: number): Step | null {
  switch (status) {
    case "DRAFT":
      return { label: "Lengkapi order & catat DP", hint: "Buka detail order di Dashboard", href: "/admin" };
    case "DESIGNING":
    case "WAITING_APPROVAL":
      return { label: "Kerjakan / ACC desain", hint: "Menu Dashboard (Designer)", href: "/designer" };
    case "APPROVED":
    case "WAITING_PAYMENT":
      return { label: "Catat DP / pelunasan", hint: "Buka detail order di Dashboard", href: "/admin" };
    case "CONFIRMED":
    case "PRODUCTION_ASSIGNED":
    case "PRODUCTION_QUEUED":
      return { label: "Mulai produksi (SCAN 1)", hint: "Scan QR job atau menu Mesin Produksi", href: "/scan" };
    case "PRODUCTION_STARTED":
      return { label: "Selesai produksi — isi qty & bahan (SCAN 2)", hint: "Menu Mesin Produksi", href: "/operator" };
    case "PRODUCTION_COMPLETE":
    case "QC_PENDING":
      return { label: "QC hasil cetak (SCAN 3)", hint: "Gudang & Finishing → tab QC", href: "/finishing" };
    case "QC_PASSED":
      return { label: "Mulai finishing (SCAN 4)", hint: "Gudang & Finishing → tab Finishing", href: "/finishing" };
    case "FINISHING_STARTED":
      return { label: "Selesai finishing (SCAN 5)", hint: "Gudang & Finishing → tab Finishing", href: "/finishing" };
    case "FINISHING_COMPLETE":
    case "STORAGE_PENDING":
      return { label: "Simpan ke rak (SCAN 6–7)", hint: "Gudang & Finishing → tab Storage", href: "/finishing" };
    case "STORED":
    case "READY_FOR_PICKUP":
      return {
        label: balance > 0 ? "Terima pelunasan lalu serahkan (SCAN 10)" : "Serahkan ke pelanggan (SCAN 10)",
        hint: "POS / Kasir atau detail order",
        href: "/pos",
      };
    case "IN_TRANSIT":
      return { label: "Selesaikan serah terima", hint: "POS / Kasir", href: "/pos" };
    case "QC_REWORK_PENDING":
      return { label: "Putuskan rework (perbaiki / cetak ulang / tahan)", hint: "Alert di Dashboard", href: "/owner" };
    case "FINAL_AUDIT_PENDING":
    case "FINAL_AUDIT_COMPLETE":
      return { label: "Audit akhir sebelum order ditutup", hint: "Buka detail order di Dashboard", href: "/admin" };
    case "ON_HOLD":
      return { label: "Order dibekukan — tinjau lalu cairkan", hint: "Detail order di Dashboard", href: "/admin" };
    default:
      return null;
  }
}

export async function getNextSteps() {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    // Panel ini memang untuk yang jalan sendiri — butuh > 1 peran.
    const solo = actor.roles.length > 1;

    const orders = await prisma.order.findMany({
      where: { tenant_id: tenant.id, status: { notIn: [...DONE] } },
      orderBy: [{ deadline: "asc" }, { created_at: "asc" }],
      take: 40,
      select: {
        id: true,
        order_code: true,
        status: true,
        deadline: true,
        balance: true,
        customer: { select: { name: true } },
      },
    });

    const items = orders
      .map((o) => {
        const step = stepFor(o.status, Number(o.balance));
        if (!step) return null;
        return {
          orderId: o.id,
          orderCode: o.order_code,
          customerName: o.customer?.name ?? "Tanpa nama",
          status: o.status,
          deadline: o.deadline,
          step,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return ok({ solo, items });
  } catch (e) {
    console.error("getNextSteps:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat langkah berikutnya.");
  }
}
