"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { saveProductMaterials, validateCatalogMachine, validateCatalogMachineCategory, OPEN_ORDER_EXCLUSIONS, type MaterialRate } from "@/lib/product-materials";
import { logAction } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { requireEntitlement } from "@/lib/entitlements";
import { safeError } from "@/lib/safe-error";
import { ok, fail } from "@/types";
import { PRINTING_UNITS, MACHINE_CATEGORIES, MACHINE_STATUSES, validateMaterialUnitPair, validateMaterialConversionFactor } from "@/lib/catalog-constants";
import { can } from "@/lib/permissions";
import { validateMaterialInboundQuantity } from "@/lib/material-quantity";
import { movementCostAmount, weightedAverageCost } from "@/lib/material-costing";

const isAdmin = (r: string[]) => r.includes("admin") || r.includes("owner");
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
      include: {
        material_options: {
          where: { tenant_id: tenant.id, active: true, role: "PRIMARY", material: { active: true, purpose: "PRIMARY", type: { not: "INK" } } },
          orderBy: [{ sort_order: "asc" }, { material: { name: "asc" } }],
          select: {
            material_id: true,
            is_default: true,
            role: true,
            unit_price: true,
            sort_order: true,
            material: { select: { id: true, name: true, material_code: true } },
          },
        },
      },
    });

    return {
      success: true,
      data: products.map((p) => plainPrinting({
        ...p,
        material_options: p.material_options.map((option) => ({
          material_id: option.material_id,
          is_default: option.is_default,
          role: option.role,
          unit_price: option.unit_price == null ? null : Number(option.unit_price),
          sort_order: option.sort_order,
          id: option.material.id,
          name: option.material.name,
          material_code: option.material.material_code,
        })),
      })),
    };
  } catch (error: unknown) {
    console.error("Error fetching printing products:", error);
    return { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." };
  }
}

type PrintingProductInput = {
  name: string; category: string; unit?: string; base_price?: number | null;
  // Ukuran baku produk berformat tetap (mis. "A3", "10R") — hanya masuk akal
  // untuk unit non-M2 (M2 selalu custom per order, lihat calculatePrintingUnitPrice).
  fixed_size?: string | null;
  default_material_id?: string | null; default_machine_id?: string | null; default_machine_category?: string | null;
  material_ids?: string[]; material_rates?: MaterialRate[];
};

export async function createPrintingProduct(data: PrintingProductInput) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles)) return fail("Hanya Owner/Admin yang boleh mengelola produk cetak.");
    if (!data.name?.trim()) return fail("Nama produk wajib diisi.");
    if (data.base_price != null && (!Number.isFinite(data.base_price) || data.base_price <= 0)) return fail("Harga dasar harus positif atau dikosongkan.");
    if (data.fixed_size != null && data.fixed_size.trim().length > 30) return fail("Ukuran baku maksimal 30 karakter.");
    if (data.default_machine_id && data.default_machine_category) return fail("Pilih salah satu: mesin spesifik atau kategori mesin, bukan keduanya.");
    const product = await prisma.$transaction(async (tx) => {
      await validateCatalogMachine(tx, tenant.id, data.default_machine_id);
      await validateCatalogMachineCategory(tx, tenant.id, data.default_machine_category);
      const created = await tx.product.create({ data: {
        tenant_id: tenant.id, name: data.name.trim(), category: (data.category?.trim() || "LAINNYA").toUpperCase(),
        unit: PRINTING_UNITS.includes((data.unit ?? "PCS") as typeof PRINTING_UNITS[number]) ? data.unit : "PCS",
        base_price: data.base_price ?? null, fixed_size: data.fixed_size?.trim() || null, default_machine_id: data.default_machine_id || null,
        default_machine_category: data.default_machine_category || null,
      } });
      await saveProductMaterials(tx, tenant.id, created.id, {
        material_ids: data.material_ids ?? [], default_material_id: data.default_material_id || null, material_rates: data.material_rates,
      });
      return created;
    });
    await logAction(actor.id, "PRODUCT_CREATED", "Product", product.id, null, data);
    revalidatePath("/admin/products");
    return ok(plainPrinting(product));
  } catch (e) { return fail(safeError(e, "Gagal membuat produk cetak.")); }
}

export async function updatePrintingProduct(id: string, data: Partial<PrintingProductInput> & { active?: boolean }) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles)) return fail("Hanya Owner/Admin yang boleh mengelola produk cetak.");
    if (data.name !== undefined && !data.name.trim()) return fail("Nama produk wajib diisi.");
    if (data.base_price != null && (!Number.isFinite(data.base_price) || data.base_price <= 0)) return fail("Harga dasar harus positif atau dikosongkan.");
    if (data.fixed_size != null && data.fixed_size.trim().length > 30) return fail("Ukuran baku maksimal 30 karakter.");
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${id} AND tenant_id = ${tenant.id} FOR UPDATE`;
      const existing = await tx.product.findFirst({ where: { id, tenant_id: tenant.id }, include: { material_options: { where: { active: true } } } });
      if (!existing) throw new Error("Produk tidak ditemukan.");
      if (data.default_machine_id !== undefined) await validateCatalogMachine(tx, tenant.id, data.default_machine_id);
      if (data.default_machine_category !== undefined) await validateCatalogMachineCategory(tx, tenant.id, data.default_machine_category);
      const effMachineId = data.default_machine_id !== undefined ? data.default_machine_id : existing.default_machine_id;
      const effCategory = data.default_machine_category !== undefined ? data.default_machine_category : existing.default_machine_category;
      if (effMachineId && effCategory) throw new Error("Pilih salah satu: mesin spesifik atau kategori mesin, bukan keduanya.");
      const { material_ids, material_rates, default_material_id, ...fields } = data;
      const updated = await tx.product.update({ where: { id }, data: {
        ...fields,
        ...(fields.default_machine_id !== undefined ? { default_machine_id: fields.default_machine_id || null } : {}),
        ...(fields.default_machine_category !== undefined ? { default_machine_category: fields.default_machine_category || null } : {}),
        ...(fields.fixed_size !== undefined ? { fixed_size: fields.fixed_size?.trim() || null } : {}),
      } });
      if (material_ids !== undefined || default_material_id !== undefined || material_rates !== undefined) {
        await saveProductMaterials(tx, tenant.id, id, {
          material_ids: material_ids ?? existing.material_options.map(m => m.material_id),
          default_material_id: default_material_id === undefined ? existing.default_material_id : default_material_id || null,
          material_rates,
        });
      }
      return { updated, existing };
    });
    await logAction(actor.id, "PRODUCT_MATERIALS_UPDATED", "Product", id, result.existing, data);
    revalidatePath("/admin/products"); revalidatePath("/admin"); revalidatePath("/designer");
    return ok(plainPrinting(result.updated));
  } catch (e) { return fail(safeError(e, "Gagal memperbarui produk cetak.")); }
}

export async function setProductMaterials(productId: string, data: { materialIds: string[]; defaultMaterialId?: string | null }) {
  return updatePrintingProduct(productId, { material_ids: data.materialIds, default_material_id: data.defaultMaterialId ?? null });
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
    const actor = await requireUser();
    if (!can(actor, "material.view")) return fail("Anda tidak memiliki akses melihat material.");
    const materials = await prisma.material.findMany({
      where: { tenant_id: tenant.id },
      orderBy: { name: "asc" },
      include: { machines: { select: { machine_id: true } }, product_options: { where: { active: true }, select: { product: { select: { name: true } } } } },
    });
    return ok(
      materials.map((m) => ({
        ...m,
        conversion_factor: Number(m.conversion_factor),
        min_stock: Number(m.min_stock),
        current_stock: Number(m.current_stock),
        standard_cost: Number(m.standard_cost),
        usable_width_mm: m.usable_width_mm == null ? null : Number(m.usable_width_mm),
        effective_length: m.effective_length == null ? null : Number(m.effective_length),
        machine_ids: m.machines.map((x) => x.machine_id),
      }))
    );
  } catch (e) {
    console.error("getMaterials:", e);
    return fail(safeError(e, "Gagal memuat material."));
  }
}

/** Riwayat pergerakan material untuk audit penerimaan, pemakaian, waste, dan opname. */
export async function getMaterialMovementHistory(materialId?: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!can(actor, "material.view")) return fail("Anda tidak memiliki akses melihat riwayat material.");
    const rows = await prisma.materialMovement.findMany({
      where: { tenant_id: tenant.id, ...(materialId ? { material_id: materialId } : {}) },
      orderBy: { created_at: "desc" },
      take: 200,
      include: {
        material: { select: { material_code: true, name: true, unit_stock: true } },
        machine: { select: { name: true, machine_code: true } },
        performer: { select: { name: true } },
        job: { select: { job_code: true, order: { select: { order_code: true } } } },
      },
    });
    return ok(rows.map((row) => ({
      id: row.id,
      materialId: row.material_id,
      materialCode: row.material.material_code,
      materialName: row.material.name,
      unitStock: row.material.unit_stock,
      movementType: row.movement_type,
      quantityUsage: Number(row.quantity_usage),
      quantityStockChange: Number(row.quantity_stock_change),
      beforeStock: Number(row.before_stock),
      afterStock: Number(row.after_stock),
      supplier: row.supplier,
      unitCost: row.unit_cost == null ? null : Number(row.unit_cost),
      costAmount: row.cost_amount == null ? null : Number(row.cost_amount),
      referenceNo: row.reference_no,
      receivedAt: row.received_at,
      performedBy: row.performer.name,
      machine: row.machine ? `${row.machine.name} (${row.machine.machine_code})` : null,
      jobCode: row.job?.job_code ?? null,
      orderCode: row.job?.order.order_code ?? null,
      reason: row.reason,
      createdAt: row.created_at,
    })));
  } catch (e) {
    console.error("getMaterialMovementHistory:", e);
    return fail(safeError(e, "Gagal memuat riwayat material."));
  }
}

export async function createMaterial(data: {
  name: string;
  group_name?: string | null;
  specifications?: string | null;
  purpose?: string;
  type: string; // MEDIA / INK / OTHER
  unit_stock: string;
  unit_usage: string;
  unit_custom?: string | null;
  conversion_factor: number;
  min_stock: number;
  current_stock: number;
  standard_cost: number;
  usable_width_mm?: number | null;
  effective_length?: number | null;
  is_shared?: boolean;
  machine_ids?: string[];
}) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    await requireEntitlement(tenant.id, "inventory");
    if (!can(actor, "material.receive")) return fail("Hanya Gudang/Owner yang boleh menambah material baru.");
    if (!data.name?.trim()) return fail("Nama material wajib diisi.");
    if (!Number.isFinite(data.conversion_factor) || !(data.conversion_factor > 0)) return fail("Faktor konversi harus lebih dari 0.");

    const material = await prisma.$transaction(async (tx) => {
      await validateMaterialSetup(tx, tenant.id, data);
      const m = await tx.material.create({
        data: {
          tenant_id: tenant.id,
          material_code: await (async () => {
            const count = await tx.material.count({ where: { tenant_id: tenant.id } });
            return `MAT-${String(count + 1).padStart(4, "0")}`;
          })(),
          name: data.name.trim(),
          type: data.type,
          group_name: data.group_name?.trim() || null,
          specifications: data.specifications?.trim() || null,
          purpose: data.type === "INK" ? "CONSUMABLE" : data.purpose ?? "PRIMARY",
          unit_stock: data.unit_stock,
          unit_usage: data.unit_usage,
          unit_custom: data.unit_custom || null,
          conversion_factor: data.conversion_factor,
          min_stock: data.min_stock,
          current_stock: data.current_stock,
          standard_cost: data.standard_cost,
          usable_width_mm: data.usable_width_mm ?? null,
          effective_length: data.effective_length ?? null,
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
    // Jangan meneruskan row Prisma mentah ke Client Component: field Decimal
    // seperti conversion_factor/current_stock tidak dapat diserialisasi oleh
    // boundary Server Action Next.js.
    return ok({
      id: material.id,
      material_code: material.material_code,
      name: material.name,
    });
  } catch (e) {
    console.error("createMaterial:", e);
    return fail(safeError(e, "Gagal membuat material."));
  }
}

export async function updateMaterial(
  id: string,
  data: {
    name?: string;
    type?: string;
    purpose?: string;
    group_name?: string | null;
    specifications?: string | null;
    unit_stock?: string;
    unit_usage?: string;
    unit_custom?: string | null;
    conversion_factor?: number;
    min_stock?: number;
    standard_cost?: number;
    usable_width_mm?: number | null;
    effective_length?: number | null;
    is_shared?: boolean;
    active?: boolean;
    machine_ids?: string[];
  }
) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    await requireEntitlement(tenant.id, "inventory");
    if (!can(actor, "material.receive")) return fail("Hanya Gudang/Owner yang boleh mengubah data material.");
    const existing = await prisma.material.findFirst({ where: { id, tenant_id: tenant.id } });
    if (!existing) return fail("Material tidak ditemukan.");

    const { machine_ids, ...fields } = data;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Material" WHERE id = ${id} AND tenant_id = ${tenant.id} FOR UPDATE`;
      await validateMaterialSetup(tx, tenant.id, { ...existing, ...data, conversion_factor: Number(data.conversion_factor ?? existing.conversion_factor), min_stock: Number(data.min_stock ?? existing.min_stock), standard_cost: Number(data.standard_cost ?? existing.standard_cost), current_stock: Number(existing.current_stock), usable_width_mm: data.usable_width_mm ?? (existing.usable_width_mm == null ? null : Number(existing.usable_width_mm)), effective_length: data.effective_length ?? (existing.effective_length == null ? null : Number(existing.effective_length)) });
      const changingUnits = (data.unit_stock !== undefined && data.unit_stock !== existing.unit_stock) || (data.unit_usage !== undefined && data.unit_usage !== existing.unit_usage) || (data.conversion_factor !== undefined && data.conversion_factor !== Number(existing.conversion_factor));
      if (changingUnits && (Number(existing.current_stock) !== 0 || await tx.materialMovement.count({ where: { tenant_id: tenant.id, material_id: id } }) || await tx.orderItem.count({ where: { tenant_id: tenant.id, material_id: id } }))) throw new Error("Satuan/konversi material yang sudah digunakan tidak dapat diubah. Buat material baru agar histori stok tetap konsisten.");
      if (data.active === false || data.purpose === "CONSUMABLE" || data.type === "INK") {
        if (await tx.productMaterial.count({ where: { tenant_id: tenant.id, material_id: id, active: true } }) || await tx.orderItem.count({ where: { tenant_id: tenant.id, material_id: id, order: { status: { notIn: OPEN_ORDER_EXCLUSIONS } } } })) throw new Error("Material masih terhubung ke produk atau order terbuka. Tinjau relasinya terlebih dahulu.");
      }
      if (machine_ids) {
        const removed = await tx.machineMaterial.findMany({ where: { tenant_id: tenant.id, material_id: id, machine_id: { notIn: machine_ids } }, select: { machine_id: true } });
        if (removed.length && await tx.productionJob.count({ where: { tenant_id: tenant.id, machine_id: { in: removed.map(m => m.machine_id) }, status: { in: ["PRODUCTION_QUEUED", "PRODUCTION_ASSIGNED", "PRODUCTION_STARTED", "PRODUCTION_PAUSED"] }, items: { some: { material_id: id } } } })) throw new Error("Bahan masih digunakan job aktif pada mesin yang akan dihapus.");
      }
      await tx.material.update({ where: { id }, data: { ...fields, ...(data.type === "INK" ? { purpose: "CONSUMABLE" } : {}) } });
      if (machine_ids) {
        await tx.machineMaterial.deleteMany({ where: { tenant_id: tenant.id, material_id: id } });
        for (const machineId of machine_ids) {
          await tx.machineMaterial.create({
            data: { tenant_id: tenant.id, machine_id: machineId, material_id: id },
          });
        }
      }
    });

    await logAction(actor.id, "MATERIAL_UPDATED", "Material", id, existing, data);
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
    await requireEntitlement(tenant.id, "inventory");
    if (!can(actor, "material.adjust")) return fail("Hanya Owner yang boleh melakukan adjustment stok.");
    if (!data.reason?.trim()) return fail("Alasan penyesuaian wajib diisi.");
    if (!Number.isFinite(data.newStock) || data.newStock < 0) return fail("Jumlah stok fisik tidak valid.");

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Material" WHERE id = ${materialId} AND tenant_id = ${tenant.id} FOR UPDATE`;
      const material = await tx.material.findFirst({ where: { id: materialId, tenant_id: tenant.id } });
      if (!material) throw new Error("Material tidak ditemukan.");

      const before = Number(material.current_stock);
      const after = data.newStock;
      const delta = after - before;
      const nextCost = data.unitCost != null && after > 0
        ? weightedAverageCost(before, Number(material.standard_cost), Math.max(0, delta), data.unitCost)
        : Number(material.standard_cost);

      await tx.material.update({ where: { id: materialId }, data: { current_stock: after, ...(data.unitCost != null ? { standard_cost: nextCost } : {}) } });
      await tx.materialMovement.create({
        data: {
          tenant_id: tenant.id,
          material_id: materialId,
          movement_type: "ADJUSTMENT",
          quantity_usage: 0,
          quantity_stock_change: delta,
          before_stock: before,
          after_stock: after,
          supplier: data.supplier || null,
          unit_cost: data.unitCost ?? null,
          cost_amount: movementCostAmount(delta, data.unitCost),
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

/** Penerimaan barang baru: tambah delta ke stok dan catat movement IN. */
export async function receiveMaterialStock(
  materialId: string,
  data: {
    quantity: number;
    supplier?: string;
    unitCost?: number;
    receivedAt?: string;
    referenceNo?: string;
    notes?: string;
  }
) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    await requireEntitlement(tenant.id, "inventory");
    if (!can(actor, "material.receive")) return fail("Hanya Gudang/Owner yang boleh mencatat stok masuk.");
    let quantity: number;
    try {
      quantity = validateMaterialInboundQuantity(data.quantity, "Jumlah stok masuk");
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Jumlah stok masuk tidak valid.");
    }
    if (data.unitCost != null && (!Number.isFinite(data.unitCost) || data.unitCost < 0)) return fail("Harga beli tidak valid.");

    const receivedAt = data.receivedAt ? new Date(`${data.receivedAt}T12:00:00`) : new Date();
    if (Number.isNaN(receivedAt.getTime())) return fail("Tanggal penerimaan tidak valid.");

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Material" WHERE id = ${materialId} AND tenant_id = ${tenant.id} FOR UPDATE`;
      const material = await tx.material.findFirst({ where: { id: materialId, tenant_id: tenant.id, active: true } });
      if (!material) throw new Error("Material tidak ditemukan atau sudah nonaktif.");

      const before = Number(material.current_stock);
      const after = before + quantity;
      const nextCost = weightedAverageCost(before, Number(material.standard_cost), quantity, data.unitCost);
      await tx.material.update({ where: { id: material.id }, data: { current_stock: after, standard_cost: nextCost } });
      await tx.materialMovement.create({
        data: {
          tenant_id: tenant.id,
          material_id: material.id,
          movement_type: "IN",
          quantity_usage: 0,
          quantity_stock_change: quantity,
          before_stock: before,
          after_stock: after,
          supplier: data.supplier?.trim() || null,
          unit_cost: data.unitCost ?? null,
          cost_amount: movementCostAmount(quantity, data.unitCost),
          reference_no: data.referenceNo?.trim() || null,
          received_at: receivedAt,
          performed_by: actor.id,
          reason: data.notes?.trim() || "Penerimaan bahan",
        },
      });
      return { before, after, quantity };
    });

    await logAction(actor.id, "MATERIAL_RECEIVED", "Material", materialId, null, {
      quantity,
      supplier: data.supplier,
      reference_no: data.referenceNo,
    });
    revalidatePath("/finishing");
    revalidatePath("/admin");
    return ok(result);
  } catch (e) {
    console.error("receiveMaterialStock:", e);
    return fail(safeError(e, "Gagal mencatat stok masuk."));
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

/** Kategori mesin yang sudah pernah dipakai tenant ini — untuk picker Kategori. */
export async function getMachineCategories() {
  try {
    const tenant = await requireTenant();
    await requireUser();
    const rows = await prisma.machine.findMany({
      where: { tenant_id: tenant.id },
      select: { category: true },
      distinct: ["category"],
    });
    const categories = Array.from(
      new Set([...(MACHINE_CATEGORIES as readonly string[]), ...rows.map((r) => r.category?.trim()).filter(Boolean)])
    ).sort((a, b) => a.localeCompare(b, "id"));
    return ok(categories);
  } catch (e) {
    console.error("getMachineCategories:", e);
    return fail(safeError(e, "Gagal memuat kategori mesin."));
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

export async function createMachine(data: { name: string; category: string; status?: string; notes?: string | null; default_operator_id?: string | null; max_active_jobs?: number | null }) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.roles)) return fail("Hanya Owner/Admin yang boleh mengelola data mesin.");
    if (!data.name?.trim()) return fail("Nama mesin wajib diisi.");
    const defaultOperatorId = await resolveDefaultOperator(tenant.id, data.default_operator_id);
    const maxActiveJobs = data.max_active_jobs == null ? null : Math.max(1, Math.min(100, Math.trunc(data.max_active_jobs)));
    const machine = await prisma.machine.create({
      data: {
        tenant_id: tenant.id,
        machine_code: await nextCode("machine", tenant.id, "MCH", 3),
        name: data.name.trim(),
        category: normCat(data.category),
        status: normStatus(data.status),
        notes: data.notes?.trim() || null,
        default_operator_id: defaultOperatorId,
        max_active_jobs: maxActiveJobs,
      },
    });
    if (defaultOperatorId) {
      // Menetapkan operator default sekaligus memastikan grant mesin ada;
      // auto-release tetap memverifikasi grant ini sebagai defense in depth.
      await prisma.userMachine.upsert({
        where: { user_id_machine_id: { user_id: defaultOperatorId, machine_id: machine.id } },
        create: { tenant_id: tenant.id, user_id: defaultOperatorId, machine_id: machine.id, assigned_by: actor.id },
        update: { tenant_id: tenant.id, assigned_by: actor.id },
      });
    }
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
  data: { name?: string; category?: string; status?: string; notes?: string | null; default_operator_id?: string | null; max_active_jobs?: number | null }
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
    if (data.max_active_jobs !== undefined) patch.max_active_jobs = data.max_active_jobs == null ? null : Math.max(1, Math.min(100, Math.trunc(data.max_active_jobs)));
    if (data.default_operator_id !== undefined) {
      patch.default_operator_id = await resolveDefaultOperator(tenant.id, data.default_operator_id);
    }
    const machine = await prisma.machine.update({ where: { id }, data: patch });
    const defaultOperatorId = typeof patch.default_operator_id === "string" ? patch.default_operator_id : null;
    if (defaultOperatorId) {
      await prisma.userMachine.upsert({
        where: { user_id_machine_id: { user_id: defaultOperatorId, machine_id: machine.id } },
        create: { tenant_id: tenant.id, user_id: defaultOperatorId, machine_id: machine.id, assigned_by: actor.id },
        update: { tenant_id: tenant.id, assigned_by: actor.id },
      });
    }
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

async function validateMaterialSetup(tx: Prisma.TransactionClient, tenantId: string, data: { type?: string; purpose?: string; unit_stock?: string; unit_usage?: string; unit_custom?: string | null; conversion_factor: number; min_stock: number; current_stock: number; standard_cost: number; usable_width_mm?: number | null; effective_length?: number | null; machine_ids?: string[] }) {
  if (!data.type || !["MEDIA", "INK", "OTHER"].includes(data.type)) throw new Error("Tipe material tidak valid.");
  if (data.purpose && !["PRIMARY", "CONSUMABLE"].includes(data.purpose)) throw new Error("Fungsi material tidak valid.");
  validateMaterialUnitPair(data.unit_stock ?? "", data.unit_usage ?? "", data.unit_custom);
  validateMaterialConversionFactor(data.unit_stock ?? "", data.unit_usage ?? "", data.conversion_factor);
  for (const [value, label] of [[data.usable_width_mm, "Lebar efektif media"], [data.effective_length, "Panjang efektif roll"]] as const) {
    if (value != null && (!Number.isFinite(value) || value <= 0)) throw new Error(`${label} harus lebih dari 0.`);
  }
  if (![data.conversion_factor, data.min_stock, data.current_stock, data.standard_cost].every(Number.isFinite) || data.conversion_factor <= 0 || data.min_stock < 0 || data.standard_cost < 0) throw new Error("Angka material tidak valid; konversi harus positif.");
  const ids = [...new Set(data.machine_ids ?? [])];
  if (ids.length !== (data.machine_ids ?? []).length || ids.length !== await tx.machine.count({ where: { tenant_id: tenantId, id: { in: ids } } })) throw new Error("Daftar mesin tidak valid untuk toko ini.");
}
