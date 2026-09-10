"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser, requireMutableActor, impersonationNote } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { TERMINAL_STATUSES } from "@/lib/order-status";
import { normalizeWorkspaceMode, WORKSPACE_MODES, type WorkspaceMode } from "@/lib/workspace-mode";
import { safeError } from "@/lib/safe-error";
import { ok, fail } from "@/types";

const OPERATIONAL_ROLES = ["admin", "designer_sales", "operator", "gudang"] as const;

/**
 * "Langkah berikutnya" untuk percetakan yang dijalankan sendiri (Solo Mode).
 * Tiap order aktif dipetakan ke satu aksi tahap berikut + ke mana harus pergi,
 * supaya Owner tidak perlu hafal alur 10x scan.
 */

type Step = { label: string; hint: string; href: string };

// Status order terminal / tidak butuh tindakan manual di daftar ini.
const DONE = new Set(TERMINAL_STATUSES);

function stepFor(status: string, balance: number, jobCount: number): Step | null {
  switch (status) {
    case "DRAFT":
      return { label: "Lengkapi order, upload & ACC desain", hint: "Menu Dashboard (Designer)", href: "/designer" };
    case "DESIGNING":
      return { label: "Kerjakan / ACC desain", hint: "Menu Dashboard (Designer)", href: "/designer" };
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
    case "INCIDENT":
      return { label: "Barang hilang di rak — tindak lanjuti", hint: "Alert di Dashboard Owner", href: "/owner" };
    default:
      return null;
  }
}

/**
 * Kelompok tahap kasar untuk Antrean Kerja (Beranda mode Solo). Urutan kunci =
 * urutan tampil di UI (lihat WORK_GROUPS di komponen WorkQueue).
 */
export type WorkGroup =
  | "keputusan"
  | "desain"
  | "bayar"
  | "produksi"
  | "qc_finishing"
  | "serah";

function groupFor(status: string): WorkGroup {
  switch (status) {
    case "QC_REWORK_PENDING":
    case "ON_HOLD":
    case "INCIDENT":
    case "FINAL_AUDIT_PENDING":
    case "FINAL_AUDIT_COMPLETE":
      return "keputusan";
    case "DRAFT":
    case "DESIGNING":
      return "desain";
    case "WAITING_PAYMENT":
      return "bayar";
    case "CONFIRMED":
    case "PRODUCTION_ASSIGNED":
    case "PRODUCTION_QUEUED":
    case "PRODUCTION_STARTED":
      return "produksi";
    case "PRODUCTION_COMPLETE":
    case "QC_PENDING":
    case "QC_PASSED":
    case "FINISHING_STARTED":
    case "FINISHING_COMPLETE":
    case "STORAGE_PENDING":
      return "qc_finishing";
    case "STORED":
    case "READY_FOR_PICKUP":
    case "IN_TRANSIT":
      return "serah";
    default:
      return "produksi";
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
      take: 200,
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
          group: groupFor(o.status),
          step,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return ok({ solo, items });
  } catch (e) {
    console.error("getNextSteps:", e);
    return fail(safeError(e, "Gagal memuat langkah berikutnya."));
  }
}

// ─── Tampilan Workspace: saran + ganti mode + peran Owner ─────────────────────

const REVALIDATE_MODE = ["/owner", "/beranda", "/owner/users"] as const;
function revalidateMode() {
  for (const p of REVALIDATE_MODE) revalidatePath(p);
}

/**
 * Saran ganti tampilan workspace untuk Owner, dihitung dari jumlah pegawai aktif
 * (bukan lagi tebakan "Owner belum punya peran"). Mengembalikan `null` kalau
 * tak ada yang perlu ditindak — jadi tenant yang sudah pas TIDAK di-nag.
 *
 * Aturan (hanya lintas batas SOLO ⟷ TIM; TEAM_SMALL/TEAM_FULL tidak saling nag):
 *   - SOLO + ada ≥1 pegawai   → sarankan TEAM_SMALL (≤4) / TEAM_FULL (≥5)
 *   - mode TIM + 0 pegawai + SUDAH pernah ada order → sarankan kembali ke SOLO
 *     (tenant TIM yang baru daftar & belum jalan TIDAK di-nag balik ke SOLO —
 *      dia memang sedang menuju merekrut, bukan "tim bubar")
 *
 * `sheddableRoles` = peran operasional yang masih dipegang Owner PADAHAL sudah
 * ada pegawai aktif yang meng-cover-nya → aman ditawarkan untuk dilepas.
 */
export async function getWorkspaceModeSuggestion() {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!actor.roles.includes("owner")) return ok(null);

    const current = normalizeWorkspaceMode((tenant as { workspace_mode?: string }).workspace_mode);

    const staff = await prisma.user.findMany({
      where: { tenant_id: tenant.id, active: true, role: { name: { not: "owner" } } },
      select: {
        role: { select: { name: true } },
        extra_roles: { select: { role: { select: { name: true } } } },
      },
    });
    const staffCount = staff.length;
    const covered = new Set<string>();
    for (const s of staff) {
      covered.add(s.role.name);
      for (const er of s.extra_roles) covered.add(er.role.name);
    }

    let suggested: WorkspaceMode = current;
    if (current === "SOLO" && staffCount > 0) {
      suggested = staffCount <= 4 ? "TEAM_SMALL" : "TEAM_FULL";
    } else if (current !== "SOLO" && staffCount === 0) {
      const hasOrders = (await prisma.order.count({ where: { tenant_id: tenant.id } })) > 0;
      if (hasOrders) suggested = "SOLO";
    }

    const ownerOps = OPERATIONAL_ROLES.filter((r) => actor.roles.includes(r));
    const sheddableRoles = ownerOps.filter((r) => covered.has(r));

    if (current === suggested && sheddableRoles.length === 0) return ok(null);

    return ok({ current, suggested, staffCount, ownerOps, sheddableRoles });
  } catch (e) {
    console.error("getWorkspaceModeSuggestion:", e);
    return fail(safeError(e, "Gagal memuat saran tampilan."));
  }
}

/** Ganti `Tenant.workspace_mode`. Owner saja. Tidak menyentuh izin/Role. */
export async function setWorkspaceMode(mode: WorkspaceMode) {
  try {
    const tenant = await requireTenant();
    const actor = await requireMutableActor();
    if (!actor.roles.includes("owner")) return fail("Hanya Owner yang bisa mengubah tampilan workspace.");
    if (!WORKSPACE_MODES.includes(mode)) return fail("Mode tampilan tidak dikenal.");

    const before = normalizeWorkspaceMode((tenant as { workspace_mode?: string }).workspace_mode);
    if (before === mode) return ok(null);

    await prisma.tenant.update({ where: { id: tenant.id }, data: { workspace_mode: mode } });
    await logAction(actor.id, "WORKSPACE_MODE_SET", "Tenant", tenant.id, { mode: before }, { mode }, impersonationNote(actor));
    revalidateMode();
    return ok(null);
  } catch (e) {
    console.error("setWorkspaceMode:", e);
    return fail(safeError(e, "Gagal mengubah tampilan workspace."));
  }
}

/**
 * Setel peran OPERASIONAL akun Owner yang sedang login menjadi PERSIS `names`
 * (subset dari OPERATIONAL_ROLES). Menambah yang kurang, mencabut sisanya.
 * Peran utama `owner` tidak pernah tersentuh. Dipakai untuk melepas peran yang
 * sudah ada pegawainya — dan untuk membatalkannya (kirim daftar lama).
 */
export async function setOwnerOperationalRoles(names: string[]) {
  try {
    await requireTenant();
    const actor = await requireMutableActor();
    if (!actor.roles.includes("owner")) return fail("Hanya Owner yang bisa mengatur peran akunnya sendiri di sini.");

    const target = OPERATIONAL_ROLES.filter((r) => names.includes(r));
    const currentOps = OPERATIONAL_ROLES.filter((r) => actor.roles.includes(r));
    const toAdd = target.filter((r) => !currentOps.includes(r));
    const toRemove = currentOps.filter((r) => !target.includes(r));
    if (toAdd.length === 0 && toRemove.length === 0) return ok({ roles: currentOps });

    const roleRows = await prisma.role.findMany({ where: { name: { in: [...OPERATIONAL_ROLES] } } });
    const idOf = (n: string) => roleRows.find((x) => x.name === n)?.id;

    await prisma.$transaction([
      ...(toAdd.length
        ? [prisma.userRole.createMany({
            data: toAdd.map((n) => ({ user_id: actor.id, role_id: idOf(n)! })),
            skipDuplicates: true,
          })]
        : []),
      ...(toRemove.length
        ? [prisma.userRole.deleteMany({
            where: { user_id: actor.id, role_id: { in: toRemove.map(idOf).filter((x): x is string => !!x) } },
          })]
        : []),
    ]);

    await logAction(
      actor.id, "OWNER_OPERATIONAL_ROLES_SET", "User", actor.id,
      { roles: currentOps }, { roles: target }, impersonationNote(actor),
    );
    revalidateMode();
    return ok({ roles: target });
  } catch (e) {
    console.error("setOwnerOperationalRoles:", e);
    return fail(safeError(e, "Gagal mengubah peran akun Anda."));
  }
}

/**
 * Kembali sepenuhnya ke Mode Solo: Owner dapat semua peran operasional lagi +
 * `workspace_mode` = SOLO. Untuk tenant yang tim-nya bubar / Owner mau turun
 * tangan lagi.
 */
export async function enableSoloMode() {
  const r1 = await setOwnerOperationalRoles([...OPERATIONAL_ROLES]);
  if (!r1.success) return r1;
  return setWorkspaceMode("SOLO");
}
