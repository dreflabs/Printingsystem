"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser, requireMutableActor } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { ok, fail } from "@/types";

const OPERATIONAL_ROLES = ["admin", "designer_sales", "operator", "gudang"] as const;

/**
 * "Langkah berikutnya" untuk percetakan yang dijalankan sendiri (Solo Mode).
 * Tiap order aktif dipetakan ke satu aksi tahap berikut + ke mana harus pergi,
 * supaya Owner tidak perlu hafal alur 10x scan.
 */

type Step = { label: string; hint: string; href: string };

// Status order terminal / tidak butuh tindakan manual di daftar ini.
const DONE = new Set(["CLOSED", "CANCELLED", "PICKED_UP"]);

function stepFor(status: string, balance: number, jobCount: number): Step | null {
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
      // Order lengkap tapi belum ada job → auto-release tidak jalan (produk
      // belum punya Mesin Default). Harus dirilis manual dari detail order.
      return jobCount === 0
        ? { label: "Rilis ke produksi — pilih mesin di detail order", hint: "Dashboard → detail order → Assign ke Produksi", href: "/admin" }
        : { label: "Mulai produksi (SCAN 1)", hint: "Scan QR job atau menu Mesin Produksi", href: "/scan" };
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
    // Owner yang BELUM punya satu pun peran operasional → tawarkan "Aktifkan Mode
    // Solo". Begitu dia punya minimal satu (baik lewat Solo Mode maupun dipilih
    // manual), tawaran berhenti muncul — supaya Owner yang sengaja melepas satu
    // peran setelah merekrut tidak terus ditawari lagi.
    const canEnableSolo =
      actor.roles.includes("owner") && !OPERATIONAL_ROLES.some((r) => actor.roles.includes(r));

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
        _count: { select: { production_jobs: true } },
      },
    });

    const items = orders
      .map((o) => {
        const step = stepFor(o.status, Number(o.balance), o._count.production_jobs);
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

    return ok({ solo, canEnableSolo, items });
  } catch (e) {
    console.error("getNextSteps:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat langkah berikutnya.");
  }
}

/**
 * Beri akun Owner yang sedang login semua peran operasional (Solo Mode).
 * Untuk tenant lama yang daftar sebelum peran otomatis diberikan.
 */
export async function enableSoloMode() {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (!actor.roles.includes("owner")) return fail("Hanya Owner yang bisa mengaktifkan Mode Solo.");

    const roles = await prisma.role.findMany({ where: { name: { in: [...OPERATIONAL_ROLES] } } });
    await prisma.$transaction(
      roles.map((r) =>
        prisma.userRole.upsert({
          where: { user_id_role_id: { user_id: actor.id, role_id: r.id } },
          update: {},
          create: { user_id: actor.id, role_id: r.id },
        }),
      ),
    );
    const after = [...new Set([...actor.roles, ...OPERATIONAL_ROLES])];
    await logAction(actor.id, "USER_ROLES_UPDATED", "User", actor.id, actor.roles, after);
    revalidatePath("/owner");
    revalidatePath("/owner/users");
    void tenant;
    return ok(null);
  } catch (e) {
    console.error("enableSoloMode:", e);
    return fail(e instanceof Error ? e.message : "Gagal mengaktifkan Mode Solo.");
  }
}
