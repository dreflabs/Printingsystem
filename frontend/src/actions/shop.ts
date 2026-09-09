"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { presignPut } from "@/lib/r2";
import { ok, fail, type ActionResult } from "@/types";

export interface ShopIdentity {
  name: string;
  phone: string;
  address: string;
  slug: string;
  logo_url: string | null;
}

export async function getShopIdentity(): Promise<ActionResult<ShopIdentity>> {
  try {
    const tenant = await requireTenant();
    await requireUser();
    const t = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { name: true, owner_phone: true, address: true, slug: true, logo_url: true },
    });
    if (!t) return fail("Data toko tidak ditemukan.");
    return ok({ name: t.name, phone: t.owner_phone ?? "", address: t.address ?? "", slug: t.slug, logo_url: t.logo_url });
  } catch (e) {
    console.error("getShopIdentity:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat identitas toko.");
  }
}

export async function updateShopIdentity(input: {
  name: string;
  phone: string;
  address: string;
}): Promise<ActionResult<ShopIdentity>> {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!actor.roles.includes("owner"))
      return fail("Hanya Owner yang boleh mengubah identitas toko.");

    const name = input.name.trim();
    if (name.length < 2) return fail("Nama toko minimal 2 karakter.");

    const before = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { name: true, owner_phone: true, address: true },
    });

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name,
        owner_phone: input.phone.trim() || null,
        address: input.address.trim().slice(0, 400) || null,
      },
      select: { name: true, owner_phone: true, address: true, slug: true, logo_url: true },
    });

    await logAction(actor.id, "SHOP_IDENTITY_UPDATED", "Tenant", tenant.id, { ...before, slug: updated.slug, logo_url: updated.logo_url },
      { name: updated.name, owner_phone: updated.owner_phone, address: updated.address, slug: updated.slug, logo_url: updated.logo_url }
    );

    revalidatePath("/(dashboard)/owner/toko", "page");
    return ok({ name: updated.name, phone: updated.owner_phone ?? "", address: updated.address ?? "", slug: updated.slug, logo_url: updated.logo_url });
  } catch (e) {
    console.error("updateShopIdentity:", e);
    return fail(e instanceof Error ? e.message : "Gagal menyimpan identitas toko.");
  }
}

export async function createLogoUploadUrl(fileType: string): Promise<ActionResult<{ url: string; key: string }>> {
  try {
    const tenant = await requireTenant();
    await requireUser();
    const ext = fileType.split("/")[1] ?? "png";
    const key = `tenants/${tenant.id}/logo-${Date.now()}.${ext}`;
    const url = await presignPut(key); // expiresSec defaults to 300
    return ok({ url, key });
  } catch (e) {
    return fail("Gagal membuat URL upload.");
  }
}

export async function updateLogoUrl(url: string): Promise<ActionResult<string>> {
  try {
    const tenant = await requireTenant();
    await requireUser();
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { logo_url: url },
    });
    revalidatePath("/(dashboard)/owner/toko", "page");
    return ok(url);
  } catch (e) {
    return fail("Gagal menyimpan URL logo.");
  }
}
