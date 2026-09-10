"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { safeError } from "@/lib/safe-error";
import { ok, fail } from "@/types";
import { PRINTING_UNITS, MACHINE_CATEGORIES, MACHINE_STATUSES } from "@/lib/catalog-constants";

const isAdmin = (r: string[]) => r.includes("admin") || r.includes("owner");
const isGudang = (r: string[]) => r.includes("gudang") || r.includes("owner");

/** null/undefined/0 → null; 0<n≤100 → n; selain itu → "invalid". */
function clampPct(v: number | null | undefined): number | null | "invalid" {
  if (v == null || v === 0) return null;
  if (!Number.isFinite(v) || v < 0 || v > 100) return "invalid";
  return v;
}

// -- RETAIL PRODUCTS --

export async function getRetailProducts() {
  try {
    const tenant = await requireTenant();
    await requireUser();

    // Katalog admin: tampilkan yang nonaktif juga (dengan badge) supaya bisa
    // diaktifkan lagi. POS memakai query terpisah yang tetap filter active.
    const products = await prisma.retailProduct.findMany({
      where: { tenant_id: tenant.id },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
    const plainProducts = products.map((p) => ({
      ...p,
      price: Number(p.price),
      makloon_price: p.makloon_price == null ? null : Number(p.makloon_price),
    }));

    return { success: true, data: plainProducts };
  } catch (error: unknown) {
    console.error("Error fetching retail products:", error);
    return { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." };
  }
}

/** Kategori produk yang sudah pernah dipakai tenant ini — untuk saran autocomplete. */
const DEFAULT_RETAIL_CATEGORIES = ["Kertas", "Tinta", "Alat Tulis", "Merchandise"];
const DEFAULT_PRINTING_CATEGORIES = ["OUTDOOR", "INDOOR", "KERTAS", "MERCHANDISE", "PACKAGING", "LAINNYA"];

export async function getProductCategories() {
  try {
    const tenant = await requireTenant();
    await requireUser();
    const [retailRows, printingRows] = await Promise.all([
      prisma.retailProduct.findMany({
        where: { tenant_id: tenant.id },
        select: { category: true },
        distinct: ["category"],
      }),
      prisma.product.findMany({
        where: { tenant_id: tenant.id },
        select: { category: true },
        distinct: ["category"],
      }),
    ]);
    const merge = (defaults: string[], rows: { category: string }[]) =>
      Array.from(
        new Set([...defaults, ...rows.map((r) => r.category?.trim()).filter(Boolean)])
      ).sort((a, b) => a.localeCompare(b, "id"));
    return ok({
      retail: merge(DEFAULT_RETAIL_CATEGORIES, retailRows),
      printing: merge(DEFAULT_PRINTING_CATEGORIES, printingRows),
    });
  } catch (e) {
    console.error("getProductCategories:", e);
    return fail(safeError(e, "Gagal memuat kategori."));
  }
}

export async function createRetailProduct(data: {
  name: string;
  sku: string;
  category: string;
  price: number;
  makloon_price?: number | null;
  stock_quantity: number;
  min_stock: number;
}) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles)) return { success: false, error: "Hanya Owner/Admin yang boleh mengelola produk retail." };

    const category = data.category?.trim() || "GENERAL";
    if (!data.name?.trim()) return { success: false, error: "Nama produk wajib diisi." };

    const product = await prisma.retailProduct.create({
      data: {
        tenant_id: tenant.id,
        sku: data.sku,
        name: data.name.trim(),
        category,
        price: data.price,
        makloon_price:
          data.makloon_price != null && data.makloon_price > 0 ? data.makloon_price : null,
        stock_quantity: data.stock_quantity,
        min_stock: data.min_stock,
      },
    });

    revalidatePath("/admin/products");

    const plainProduct = {
      ...product,
      price: Number(product.price),
      makloon_price: product.makloon_price == null ? null : Number(product.makloon_price),
    };

    return { success: true, data: plainProduct };
  } catch (error: unknown) {
    console.error("Error creating retail product:", error);
    return { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." };
  }
}

export async function updateRetailProduct(
  id: string,
  data: {
    name?: string;
    sku?: string;
    category?: string;
    price?: number;
    makloon_price?: number | null;
    min_stock?: number;
    active?: boolean;
  }
) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles)) return fail("Hanya Owner/Admin yang boleh mengelola produk retail.");
    const existing = await prisma.retailProduct.findFirst({ where: { id, tenant_id: tenant.id } });
    if (!existing) return fail("Produk tidak ditemukan.");

    const patch: Record<string, unknown> = {};
    if (data.name != null) patch.name = data.name.trim();
    if (data.sku != null) patch.sku = data.sku.trim();
    if (data.category != null) patch.category = data.category.trim() || "GENERAL";
    if (data.price != null) patch.price = data.price;
    if (data.makloon_price !== undefined) patch.makloon_price = data.makloon_price != null && data.makloon_price > 0 ? data.makloon_price : null;
    if (data.min_stock != null) patch.min_stock = Math.max(0, Math.round(data.min_stock));
    if (data.active != null) patch.active = data.active;

    const product = await prisma.retailProduct.update({ where: { id }, data: patch });
    revalidatePath("/admin/products");
    return ok({
      ...product,
      price: Number(product.price),
      makloon_price: product.makloon_price == null ? null : Number(product.makloon_price),
    });
  } catch (e) {
    console.error("updateRetailProduct:", e);
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return fail("SKU sudah dipakai produk lain.");
    }
    return fail(safeError(e, "Gagal memperbarui produk retail."));
  }
}

/**
 * Hapus produk retail. Kalau sudah pernah dipakai (ada mutasi stok / item order)
 * FK memblokir hard-delete → produk dinonaktifkan saja (tetap terhubung ke
 * riwayat penjualan). Kalau belum pernah dipakai → baris dihapus.
 */
export async function deleteRetailProduct(id: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles)) return fail("Hanya Owner/Admin yang boleh menghapus produk retail.");
    const existing = await prisma.retailProduct.findFirst({
      where: { id, tenant_id: tenant.id },
      select: { id: true, _count: { select: { stock_movements: true, order_items: true } } },
    });
    if (!existing) return fail("Produk tidak ditemukan.");

    const used = existing._count.stock_movements + existing._count.order_items;
    if (used > 0) {
      await prisma.retailProduct.update({ where: { id }, data: { active: false } });
      revalidatePath("/admin/products");
      return ok({ mode: "deactivated" as const });
    }
    await prisma.retailProduct.delete({ where: { id } });
    revalidatePath("/admin/products");
    return ok({ mode: "deleted" as const });
  } catch (e) {
    console.error("deleteRetailProduct:", e);
    return fail(safeError(e, "Gagal menghapus produk retail."));
  }
}

// -- PRINTING PRODUCTS --

function plainPrinting<T extends { base_price: unknown }>(p: T) {
  return { ...p, base_price: p.base_price == null ? null : Number(p.base_price) };
}

export async function getPrintingProducts() {
  try {
    const tenant = await requireTenant();
    await requireUser();

    const products = await prisma.product.findMany({
      where: { tenant_id: tenant.id, active: true },
      orderBy: { name: "asc" },
    });

    return { success: true, data: products.map(plainPrinting) };
  } catch (error: unknown) {
    console.error("Error fetching printing products:", error);
    return { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." };
  }
}

export async function createPrintingProduct(data: {
  name: string;
  category: string;
  unit?: string;
  base_price?: number | null;
  default_material_id?: string | null;
  default_machine_id?: string | null;
}) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles)) return fail("Hanya Owner/Admin yang boleh mengelola produk cetak.");
    if (!data.name?.trim()) return fail("Nama produk wajib diisi.");
    const unit = PRINTING_UNITS.includes((data.unit ?? "").toUpperCase() as (typeof PRINTING_UNITS)[number])
      ? (data.unit as string).toUpperCase()
      : "PCS";
    const product = await prisma.product.create({
      data: {
        tenant_id: tenant.id,
        name: data.name.trim(),
        category: (data.category?.trim() || "LAINNYA").toUpperCase(),
        unit,
        base_price: data.base_price != null && data.base_price > 0 ? data.base_price : null,
        default_material_id: data.default_material_id || null,
        default_machine_id: data.default_machine_id || null,
      },
    });
    revalidatePath("/admin/products");
    return ok(plainPrinting(product));
  } catch (e) {
    console.error("createPrintingProduct:", e);
    return fail(safeError(e, "Gagal membuat produk cetak."));
  }
}

export async function updatePrintingProduct(
  id: string,
  data: {
    name?: string;
    category?: string;
    unit?: string;
    base_price?: number | null;
    default_material_id?: string | null;
    default_machine_id?: string | null;
    active?: boolean;
  }
) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles)) return fail("Hanya Owner/Admin yang boleh mengelola produk cetak.");
    const existing = await prisma.product.findFirst({ where: { id, tenant_id: tenant.id } });
    if (!existing) return fail("Produk tidak ditemukan.");

    const patch: Record<string, unknown> = {};
    if (data.name != null) patch.name = data.name.trim();
    if (data.category != null) patch.category = (data.category.trim() || "LAINNYA").toUpperCase();
    if (data.unit != null) {
      patch.unit = PRINTING_UNITS.includes(data.unit.toUpperCase() as (typeof PRINTING_UNITS)[number])
        ? data.unit.toUpperCase()
        : "PCS";
    }
    if (data.base_price !== undefined) patch.base_price = data.base_price != null && data.base_price > 0 ? data.base_price : null;
    if (data.default_material_id !== undefined) patch.default_material_id = data.default_material_id || null;
    if (data.default_machine_id !== undefined) patch.default_machine_id = data.default_machine_id || null;
    if (data.active != null) patch.active = data.active;

    const product = await prisma.product.update({ where: { id }, data: patch });
    revalidatePath("/admin/products");
    return ok(plainPrinting(product));
  } catch (e) {
    console.error("updatePrintingProduct:", e);
    return fail(safeError(e, "Gagal memperbarui produk cetak."));
  }
}

export async function deletePrintingProduct(id: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles)) return fail("Hanya Owner/Admin yang boleh menghapus jasa cetak.");
    const existing = await prisma.product.findFirst({
      where: { id, tenant_id: tenant.id },
      select: { id: true, _count: { select: { order_items: true } } },
    });
    if (!existing) return fail("Jasa cetak tidak ditemukan.");

    if (existing._count.order_items > 0) {
      await prisma.product.update({ where: { id }, data: { active: false } });
      revalidatePath("/admin/products");
      return ok({ mode: "deactivated" as const });
    }
    await prisma.product.delete({ where: { id } });
    revalidatePath("/admin/products");
    return ok({ mode: "deleted" as const });
  } catch (e) {
    console.error("deletePrintingProduct:", e);
    return fail(safeError(e, "Gagal menghapus jasa cetak."));
  }
}

// -- CUSTOMERS --

async function nextCode(model: "customer" | "material" | "machine", tenantId: string, prefix: string, pad: number) {
  const count =
    model === "customer"
      ? await prisma.customer.count({ where: { tenant_id: tenantId } })
      : model === "material"
      ? await prisma.material.count({ where: { tenant_id: tenantId } })
      : await prisma.machine.count({ where: { tenant_id: tenantId } });
  return `${prefix}-${String(count + 1).padStart(pad, "0")}`;
}

export async function getCustomers() {
  try {
    const tenant = await requireTenant();
    await requireUser();
    const customers = await prisma.customer.findMany({
      where: { tenant_id: tenant.id },
      orderBy: { name: "asc" },
    });
    return ok(
      customers.map((c) => ({
        ...c,
        default_discount_pct: c.default_discount_pct == null ? null : Number(c.default_discount_pct),
      }))
    );
  } catch (e) {
    console.error("getCustomers:", e);
    return fail(safeError(e, "Gagal memuat customer."));
  }
}

export async function createCustomer(data: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  company?: string;
  type?: string;
  default_discount_pct?: number | null;
  notes?: string;
}) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles)) return fail("Hanya Owner/Admin yang boleh mengelola data customer.");
    if (!data.name?.trim()) return fail("Nama customer wajib diisi.");
    const pct = clampPct(data.default_discount_pct);
    if (pct === "invalid") return fail("Diskon default harus 0–100%.");
    const customer = await prisma.customer.create({
      data: {
        tenant_id: tenant.id,
        customer_code: await nextCode("customer", tenant.id, "CST", 5),
        name: data.name.trim(),
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        company: data.company || null,
        type: data.type || "Umum",
        default_discount_pct: pct,
        notes: data.notes || null,
        created_by: actor.id,
      },
    });
    revalidatePath("/admin/customers");
    return ok(customer);
  } catch (e) {
    console.error("createCustomer:", e);
    return fail(safeError(e, "Gagal membuat customer."));
  }
}

export async function updateCustomer(
  id: string,
  data: {
    name?: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    company?: string | null;
    type?: string;
    default_discount_pct?: number | null;
    notes?: string | null;
  }
) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles)) return fail("Hanya Owner/Admin yang boleh mengelola data customer.");
    const existing = await prisma.customer.findFirst({ where: { id, tenant_id: tenant.id } });
    if (!existing) return fail("Customer tidak ditemukan.");
    const { default_discount_pct, ...rest } = data;
    let pctPatch: { default_discount_pct?: number | null } = {};
    if (default_discount_pct !== undefined) {
      const pct = clampPct(default_discount_pct);
      if (pct === "invalid") return fail("Diskon default harus 0–100%.");
      pctPatch = { default_discount_pct: pct };
    }
    const customer = await prisma.customer.update({ where: { id }, data: { ...rest, ...pctPatch } });
    revalidatePath("/admin/customers");
    return ok(customer);
  } catch (e) {
    console.error("updateCustomer:", e);
    return fail(safeError(e, "Gagal memperbarui customer."));
  }
}

// -- MATERIALS --

export async function getMaterials() {
  try {
    const tenant = await requireTenant();
    await requireUser();
    const materials = await prisma.material.findMany({
      where: { tenant_id: tenant.id },
      orderBy: { name: "asc" },
      include: { machines: { select: { machine_id: true } } },
    });
    return ok(
      materials.map((m) => ({
        ...m,
        conversion_factor: Number(m.conversion_factor),
        min_stock: Number(m.min_stock),
        current_stock: Number(m.current_stock),
        standard_cost: Number(m.standard_cost),
        machine_ids: m.machines.map((x) => x.machine_id),
      }))
    );
  } catch (e) {
    console.error("getMaterials:", e);
    return fail(safeError(e, "Gagal memuat material."));
  }
}

export async function createMaterial(data: {
  name: string;
  type: string; // MEDIA / INK / OTHER
  unit_stock: string;
  unit_usage: string;
  unit_custom?: string | null;
  conversion_factor: number;
  min_stock: number;
  current_stock: number;
  standard_cost: number;
  is_shared?: boolean;
  machine_ids?: string[];
}) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isGudang(actor.roles)) return fail("Hanya Owner/Gudang yang boleh menambah material baru.");
    if (!data.name?.trim()) return fail("Nama material wajib diisi.");
    if (!(data.conversion_factor > 0)) return fail("Faktor konversi harus lebih dari 0.");

    const material = await prisma.$transaction(async (tx) => {
      const m = await tx.material.create({
        data: {
          tenant_id: tenant.id,
          material_code: await (async () => {
            const count = await tx.material.count({ where: { tenant_id: tenant.id } });
            return `MAT-${String(count + 1).padStart(4, "0")}`;
          })(),
          name: data.name.trim(),
          type: data.type,
          unit_stock: data.unit_stock,
          unit_usage: data.unit_usage,
          unit_custom: data.unit_custom || null,
          conversion_factor: data.conversion_factor,
          min_stock: data.min_stock,
          current_stock: data.current_stock,
          standard_cost: data.standard_cost,
          is_shared: data.is_shared ?? false,
          added_by: actor.id,
        },
      });
      for (const machineId of data.machine_ids ?? []) {
        await tx.machineMaterial.create({
          data: { tenant_id: tenant.id, machine_id: machineId, material_id: m.id },
        });
      }
      return m;
    });

    revalidatePath("/admin");
    return ok(material);
  } catch (e) {
    console.error("createMaterial:", e);
    return fail(safeError(e, "Gagal membuat material."));
  }
}

export async function updateMaterial(
  id: string,
  data: {
    name?: string;
    unit_stock?: string;
    unit_usage?: string;
    unit_custom?: string | null;
    conversion_factor?: number;
    min_stock?: number;
    standard_cost?: number;
    is_shared?: boolean;
    active?: boolean;
    machine_ids?: string[];
  }
) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isGudang(actor.roles)) return fail("Hanya Owner/Gudang yang boleh mengubah data material.");
    const existing = await prisma.material.findFirst({ where: { id, tenant_id: tenant.id } });
    if (!existing) return fail("Material tidak ditemukan.");

    const { machine_ids, ...fields } = data;
    await prisma.$transaction(async (tx) => {
      await tx.material.update({ where: { id }, data: fields });
      if (machine_ids) {
        await tx.machineMaterial.deleteMany({ where: { tenant_id: tenant.id, material_id: id } });
        for (const machineId of machine_ids) {
          await tx.machineMaterial.create({
            data: { tenant_id: tenant.id, machine_id: machineId, material_id: id },
          });
        }
      }
    });

    revalidatePath("/admin");
    return ok({ id });
  } catch (e) {
    console.error("updateMaterial:", e);
    return fail(safeError(e, "Gagal memperbarui material."));
  }
}

/** Penyesuaian stok manual → catat MaterialMovement (ADJUSTMENT). */
export async function adjustMaterialStock(
  materialId: string,
  data: { newStock: number; reason: string; supplier?: string; unitCost?: number }
) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isGudang(actor.roles)) return fail("Hanya Owner/Gudang yang boleh menyesuaikan stok material.");
    if (!data.reason?.trim()) return fail("Alasan penyesuaian wajib diisi.");

    const result = await prisma.$transaction(async (tx) => {
      const material = await tx.material.findFirst({ where: { id: materialId, tenant_id: tenant.id } });
      if (!material) throw new Error("Material tidak ditemukan.");

      const before = Number(material.current_stock);
      const after = data.newStock;
      const delta = after - before;

      await tx.material.update({ where: { id: materialId }, data: { current_stock: after } });
      await tx.materialMovement.create({
        data: {
          tenant_id: tenant.id,
          material_id: materialId,
          movement_type: delta >= 0 ? "IN" : "ADJUSTMENT",
          quantity_usage: 0,
          quantity_stock_change: delta,
          before_stock: before,
          after_stock: after,
          supplier: data.supplier || null,
          unit_cost: data.unitCost ?? null,
          performed_by: actor.id,
          reason: data.reason.trim(),
        },
      });
      return { before, after, delta };
    });

    revalidatePath("/admin");
    return ok(result);
  } catch (e) {
    console.error("adjustMaterialStock:", e);
    return fail(safeError(e, "Gagal menyesuaikan stok."));
  }
}

// -- MACHINES --

export async function getMachines() {
  try {
    const tenant = await requireTenant();
    await requireUser();
    const machines = await prisma.machine.findMany({
      where: { tenant_id: tenant.id },
      orderBy: { name: "asc" },
      include: {
        materials: { select: { material_id: true } },
        default_operator: { select: { id: true, name: true } },
      },
    });
    return ok(machines.map((m) => ({
      ...m,
      material_ids: m.materials.map((x) => x.material_id),
      default_operator_name: m.default_operator?.name ?? null,
    })));
  } catch (e) {
    console.error("getMachines:", e);
    return fail(safeError(e, "Gagal memuat mesin."));
  }
}

// Jenis/kategori mesin bebas diisi tenant — bukan enum. Nilai yang cocok dengan
// daftar saran dinormalkan ke huruf besar (biar konsisten dengan data lama);
// selain itu diterima apa adanya, hanya dirapikan & dibatasi panjangnya.
const normCat = (v?: string) => {
  const t = (v ?? "").trim();
  if (!t) return "LAINNYA";
  const up = t.toUpperCase();
  if ((MACHINE_CATEGORIES as readonly string[]).includes(up)) return up;
  return t.slice(0, 40);
};
const normStatus = (v?: string) =>
  (MACHINE_STATUSES as readonly string[]).includes(v ?? "") ? (v as string) : "ACTIVE";

/** Validasi operator default: harus user tenant ini, aktif, & punya peran operator. */
async function resolveDefaultOperator(tenantId: string, operatorId: string | null | undefined) {
  const id = (operatorId ?? "").trim();
  if (!id) return null;
  const u = await prisma.user.findFirst({
    where: {
      id,
      tenant_id: tenantId,
      active: true,
      OR: [{ role: { name: "operator" } }, { extra_roles: { some: { role: { name: "operator" } } } }],
    },
    select: { id: true },
  });
  if (!u) throw new Error("Operator default tidak valid (harus pegawai aktif berperan Operator).");
  return u.id;
}

export async function createMachine(data: { name: string; category: string; status?: string; notes?: string | null; default_operator_id?: string | null }) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles)) return fail("Hanya Owner/Admin yang boleh mengelola data mesin.");
    if (!data.name?.trim()) return fail("Nama mesin wajib diisi.");
    const defaultOperatorId = await resolveDefaultOperator(tenant.id, data.default_operator_id);
    const machine = await prisma.machine.create({
      data: {
        tenant_id: tenant.id,
        machine_code: await nextCode("machine", tenant.id, "MCH", 3),
        name: data.name.trim(),
        category: normCat(data.category),
        status: normStatus(data.status),
        notes: data.notes?.trim() || null,
        default_operator_id: defaultOperatorId,
      },
    });
    revalidatePath("/admin");
    revalidatePath("/admin/products");
    return ok(machine);
  } catch (e) {
    console.error("createMachine:", e);
    return fail(safeError(e, "Gagal membuat mesin."));
  }
}

export async function updateMachine(
  id: string,
  data: { name?: string; category?: string; status?: string; notes?: string | null; default_operator_id?: string | null }
) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles)) return fail("Hanya Owner/Admin yang boleh mengelola data mesin.");
    const existing = await prisma.machine.findFirst({ where: { id, tenant_id: tenant.id } });
    if (!existing) return fail("Mesin tidak ditemukan.");
    const patch: Record<string, unknown> = {};
    if (data.name != null) patch.name = data.name.trim();
    if (data.category != null) patch.category = normCat(data.category);
    if (data.status != null) patch.status = normStatus(data.status);
    if (data.notes !== undefined) patch.notes = data.notes?.trim() || null;
    if (data.default_operator_id !== undefined) {
      patch.default_operator_id = await resolveDefaultOperator(tenant.id, data.default_operator_id);
    }
    const machine = await prisma.machine.update({ where: { id }, data: patch });
    revalidatePath("/admin");
    revalidatePath("/admin/products");
    return ok(machine);
  } catch (e) {
    console.error("updateMachine:", e);
    return fail(safeError(e, "Gagal memperbarui mesin."));
  }
}

export async function deleteMachine(id: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles)) return fail("Hanya Owner/Admin yang boleh menghapus mesin.");
    
    // Check if machine is used in Production Jobs or as Default Machine in Products
    const existing = await prisma.machine.findFirst({
      where: { id, tenant_id: tenant.id },
      select: { 
        id: true, 
        _count: { select: { production_jobs: true, default_for_products: true } } 
      },
    });
    if (!existing) return fail("Mesin tidak ditemukan.");

    const used = existing._count.production_jobs > 0 || existing._count.default_for_products > 0;
    if (used) {
      // Soft delete: set status to INACTIVE
      await prisma.machine.update({ where: { id }, data: { status: "INACTIVE" } });
      revalidatePath("/admin/products");
      return ok({ mode: "deactivated" as const });
    }
    await prisma.machine.delete({ where: { id } });
    revalidatePath("/admin/products");
    return ok({ mode: "deleted" as const });
  } catch (e) {
    console.error("deleteMachine:", e);
    return fail(safeError(e, "Gagal menghapus mesin."));
  }
}


