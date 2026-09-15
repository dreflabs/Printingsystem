/** Nilai enum katalog — dipakai form (client) & action (server). */

export const PRINTING_UNITS = ["PCS", "M2", "METER", "LEMBAR", "RIM"] as const;
export type PrintingUnit = (typeof PRINTING_UNITS)[number];

export const MATERIAL_STOCK_UNITS = ["ROLL", "METER", "LEMBAR", "LITER", "KG", "RIM", "BOTOL", "PCS"] as const;
export const MATERIAL_USAGE_UNITS = ["METER", "LEMBAR", "ML", "GRAM", "LITER", "KG", "PCS"] as const;
export type MaterialStockUnit = (typeof MATERIAL_STOCK_UNITS)[number];
export type MaterialUsageUnit = (typeof MATERIAL_USAGE_UNITS)[number];

/** Pasangan unit yang dapat dikonversi secara deterministik oleh ledger stok. */
export const MATERIAL_UNIT_PAIRS: Readonly<Record<string, readonly string[]>> = {
  ROLL: ["METER"],
  METER: ["METER"],
  LEMBAR: ["LEMBAR"],
  LITER: ["ML", "LITER"],
  KG: ["GRAM", "KG"],
  RIM: ["LEMBAR"],
  BOTOL: ["ML", "LITER"],
  PCS: ["PCS"],
};

export function isKnownMaterialStockUnit(value: string): value is MaterialStockUnit {
  return MATERIAL_STOCK_UNITS.includes(value as MaterialStockUnit);
}

export function isKnownMaterialUsageUnit(value: string): value is MaterialUsageUnit {
  return MATERIAL_USAGE_UNITS.includes(value as MaterialUsageUnit);
}

export function validateMaterialUnitPair(unitStock: string, unitUsage: string, unitCustom?: string | null) {
  const stock = unitStock.trim().toUpperCase();
  const usage = unitUsage.trim().toUpperCase();
  const custom = unitCustom?.trim().toUpperCase() || null;
  const stockKnown = isKnownMaterialStockUnit(stock);
  const usageKnown = isKnownMaterialUsageUnit(usage);

  if (!stock || !usage) throw new Error("Satuan stok dan satuan produksi wajib diisi.");
  if (!stockKnown || !usageKnown) {
    if (!custom || stock !== custom || usage !== custom) {
      throw new Error("Satuan custom harus diisi dan digunakan konsisten pada stok serta produksi.");
    }
    return { stock, usage, custom };
  }
  if (!MATERIAL_UNIT_PAIRS[stock]?.includes(usage)) {
    throw new Error(`Pasangan satuan ${stock} → ${usage} tidak didukung. Periksa satuan stok dan produksi.`);
  }
  if (custom) throw new Error("Satuan custom hanya boleh digunakan jika kedua satuan memakai nilai custom yang sama.");
  return { stock, usage, custom: null };
}

/** Unit yang sama tidak boleh memiliki skala tersembunyi. Faktor disimpan
 * terpisah karena faktor 50 pada ROLL→METER memiliki dimensi yang jelas. */
export function validateMaterialConversionFactor(unitStock: string, unitUsage: string, factor: number) {
  if (!Number.isFinite(factor) || factor <= 0) throw new Error("Faktor konversi harus lebih dari 0.");
  if (unitStock.trim().toUpperCase() === unitUsage.trim().toUpperCase() && Math.abs(factor - 1) > 1e-9) {
    throw new Error("Jika satuan stok dan pemakaian sama, faktor konversi harus 1.");
  }
  return factor;
}

export function printingUnitLabel(unit: string) {
  const labels: Record<string, string> = { PCS: "pcs", M2: "m²", METER: "meter", LEMBAR: "lembar", RIM: "rim" };
  return labels[unit] ?? unit.toLowerCase();
}

/** Tarif per unit jual, sebelum dikalikan jumlah item. */
export function calculatePrintingUnitPrice(unit: string, rate: number, widthCm?: number, heightCm?: number) {
  if (!Number.isFinite(rate) || rate < 0) throw new Error("Tarif katalog tidak valid.");
  if (unit === "M2") {
    const area = ((Number(widthCm) || 0) / 100) * ((Number(heightCm) || 0) / 100);
    if (!(area > 0)) throw new Error("Ukuran wajib diisi untuk produk berbasis M2.");
    return Math.round(rate * area);
  }
  if (!PRINTING_UNITS.includes(unit as PrintingUnit)) throw new Error("Satuan harga produk tidak valid.");
  return Math.round(rate);
}

/**
 * Jenis/kategori mesin — HANYA SARAN autocomplete, bukan pilihan terkunci.
 * Tenant bebas mengetik jenis mesin mereka sendiri (mis. "Eco Solvent 3.2m",
 * "UV Flatbed", "Riso", "Konica bizhub"). Tidak ada logika yang bergantung
 * pada nilai ini — murni label untuk pengelompokan.
 */
export const MACHINE_CATEGORIES = [
  "OUTDOOR", "INDOOR", "SUBLIMASI", "A3", "UV", "DTF", "BENDERA", "LAINNYA",
] as const;
export type MachineCategory = (typeof MACHINE_CATEGORIES)[number];

export const MACHINE_STATUSES = ["ACTIVE", "MAINTENANCE", "INACTIVE"] as const;
export type MachineStatus = (typeof MACHINE_STATUSES)[number];
