/** Tipe produk cetak untuk form master data (PrintingProductModal). */

export interface ProductVariant {
  name: string;
  price: number;
}

export interface ProductFinishing {
  name: string;
  price: number;
  type: "per_m2" | "per_pcs" | "flat";
}

export interface PrintingProduct {
  id: string;
  label: string;
  value: string;
  basePrice: number;
  unit: string;
  variants: ProductVariant[];
  finishings: ProductFinishing[];
}
