"use server";

import { revalidatePath } from "next/cache";
import { PrismaClient } from "@prisma/client";
import { requireTenant } from "@/lib/tenant";

const prisma = new PrismaClient();

// -- RETAIL PRODUCTS --

export async function getRetailProducts() {
  try {
    const tenant = await requireTenant();
    
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
  } catch (error: any) {
    console.error("Error fetching retail products:", error);
    return { success: false, error: error.message };
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
  } catch (error: any) {
    console.error("Error creating retail product:", error);
    return { success: false, error: error.message };
  }
}

// -- PRINTING PRODUCTS --

export async function getPrintingProducts() {
  try {
    const tenant = await requireTenant();
    
    const products = await prisma.product.findMany({
      where: {
        tenant_id: tenant.id,
        active: true
      },
      orderBy: { name: 'asc' }
    });
    
    return { success: true, data: products };
  } catch (error: any) {
    console.error("Error fetching printing products:", error);
    return { success: false, error: error.message };
  }
}
