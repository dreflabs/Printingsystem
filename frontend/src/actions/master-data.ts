"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { ok, fail } from "@/types";

const isAdmin = (r: string) => r === "admin" || r === "owner";
const isGudang = (r: string) => r === "gudang" || r === "owner";

// -- RETAIL PRODUCTS --

export async function getRetailProducts() {
  try {
    const tenant = await requireTenant();
    await requireUser();

    const products = await prisma.retailProduct.findMany({
      where: {
        tenant_id: tenant.id,
        active: true
      },
      orderBy: { name: 'asc' }
    });
    const plainProducts = products.map((p) => ({
      ...p,
      price: Number(p.price),
    }));
    
    return { success: true, data: plainProducts };
  } catch (error: unknown) {
    console.error("Error fetching retail products:", error);
    return { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." };
  }
}

export async function createRetailProduct(data: {
  name: string;
  sku: string;
  category: string;
  price: number;
  stock_quantity: number;
  min_stock: number;
}) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.role)) return { success: false, error: "Hanya Owner/Admin yang boleh mengelola produk retail." };

    const product = await prisma.retailProduct.create({
      data: {
        tenant_id: tenant.id,
        ...data
      }
    });
    
    revalidatePath("/admin/products");
    
    const plainProduct = {
      ...product,
      price: Number(product.price),
    };
    
    return { success: true, data: plainProduct };
  } catch (error: unknown) {
    console.error("Error creating retail product:", error);
    return { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." };
  }
}

// -- PRINTING PRODUCTS --

export async function getPrintingProducts() {
  try {
    const tenant = await requireTenant();
    await requireUser();

    const products = await prisma.product.findMany({
      where: {
        tenant_id: tenant.id,
        active: true
      },
      orderBy: { name: 'asc' }
    });

    return { success: true, data: products };
  } catch (error: unknown) {
    console.error("Error fetching printing products:", error);
    return { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan." };
  }
}

export async function createPrintingProduct(data: {
  name: string;
  category: string;
  default_material_id?: string | null;
}) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.role)) return fail("Hanya Owner/Admin yang boleh mengelola produk cetak.");
    const product = await prisma.product.create({
      data: {
        tenant_id: tenant.id,
        name: data.name,
        category: data.category,
        default_material_id: data.default_material_id || null,
      },
    });
    revalidatePath("/admin/products");
    return ok(product);
  } catch (e) {
    console.error("createPrintingProduct:", e);
    return fail(e instanceof Error ? e.message : "Gagal membuat produk cetak.");
  }
}

export async function updatePrintingProduct(
  id: string,
  data: { name?: string; category?: string; default_material_id?: string | null; active?: boolean }
) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.role)) return fail("Hanya Owner/Admin yang boleh mengelola produk cetak.");
    const existing = await prisma.product.findFirst({ where: { id, tenant_id: tenant.id } });
    if (!existing) return fail("Produk tidak ditemukan.");
    const product = await prisma.product.update({ where: { id }, data });
    revalidatePath("/admin/products");
    return ok(product);
  } catch (e) {
    console.error("updatePrintingProduct:", e);
    return fail(e instanceof Error ? e.message : "Gagal memperbarui produk cetak.");
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
      customers.map((c) => ({ ...c, default_discount: c.default_discount ? Number(c.default_discount) : null }))
    );
  } catch (e) {
    console.error("getCustomers:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat customer.");
  }
}

export async function createCustomer(data: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  company?: string;
  type?: string;
  default_discount?: number | null;
  notes?: string;
}) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.role)) return fail("Hanya Owner/Admin yang boleh mengelola data customer.");
    if (!data.name?.trim()) return fail("Nama customer wajib diisi.");
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
        default_discount: data.default_discount ?? null,
        notes: data.notes || null,
        created_by: actor.id,
      },
    });
    revalidatePath("/admin/customers");
    return ok(customer);
  } catch (e) {
    console.error("createCustomer:", e);
    return fail(e instanceof Error ? e.message : "Gagal membuat customer.");
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
    default_discount?: number | null;
    notes?: string | null;
  }
) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.role)) return fail("Hanya Owner/Admin yang boleh mengelola data customer.");
    const existing = await prisma.customer.findFirst({ where: { id, tenant_id: tenant.id } });
    if (!existing) return fail("Customer tidak ditemukan.");
    const customer = await prisma.customer.update({ where: { id }, data });
    revalidatePath("/admin/customers");
    return ok(customer);
  } catch (e) {
    console.error("updateCustomer:", e);
    return fail(e instanceof Error ? e.message : "Gagal memperbarui customer.");
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
    return fail(e instanceof Error ? e.message : "Gagal memuat material.");
  }
}

export async function createMaterial(data: {
  name: string;
  type: "MEDIA" | "INK";
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
    if (!isGudang(actor.role)) return fail("Hanya Owner/Gudang yang boleh menambah material baru.");
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
    return fail(e instanceof Error ? e.message : "Gagal membuat material.");
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
    if (!isGudang(actor.role)) return fail("Hanya Owner/Gudang yang boleh mengubah data material.");
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
    return fail(e instanceof Error ? e.message : "Gagal memperbarui material.");
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
    if (!isGudang(actor.role)) return fail("Hanya Owner/Gudang yang boleh menyesuaikan stok material.");
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
    return fail(e instanceof Error ? e.message : "Gagal menyesuaikan stok.");
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
      include: { materials: { select: { material_id: true } } },
    });
    return ok(machines.map((m) => ({ ...m, material_ids: m.materials.map((x) => x.material_id) })));
  } catch (e) {
    console.error("getMachines:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat mesin.");
  }
}

export async function createMachine(data: {
  name: string;
  category: string;
  status?: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
  notes?: string;
}) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.role)) return fail("Hanya Owner/Admin yang boleh mengelola data mesin.");
    if (!data.name?.trim()) return fail("Nama mesin wajib diisi.");
    const machine = await prisma.machine.create({
      data: {
        tenant_id: tenant.id,
        machine_code: await nextCode("machine", tenant.id, "MCH", 3),
        name: data.name.trim(),
        category: data.category,
        status: data.status || "ACTIVE",
        notes: data.notes || null,
      },
    });
    revalidatePath("/admin");
    return ok(machine);
  } catch (e) {
    console.error("createMachine:", e);
    return fail(e instanceof Error ? e.message : "Gagal membuat mesin.");
  }
}

export async function updateMachine(
  id: string,
  data: {
    name?: string;
    category?: string;
    status?: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
    notes?: string | null;
  }
) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.role)) return fail("Hanya Owner/Admin yang boleh mengelola data mesin.");
    const existing = await prisma.machine.findFirst({ where: { id, tenant_id: tenant.id } });
    if (!existing) return fail("Mesin tidak ditemukan.");
    const machine = await prisma.machine.update({ where: { id }, data });
    revalidatePath("/admin");
    return ok(machine);
  } catch (e) {
    console.error("updateMachine:", e);
    return fail(e instanceof Error ? e.message : "Gagal memperbarui mesin.");
  }
}
