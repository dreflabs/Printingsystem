/** Nilai enum katalog — dipakai form (client) & action (server). */

export const PRINTING_UNITS = ["PCS", "M2", "METER", "LEMBAR", "RIM"] as const;
export type PrintingUnit = (typeof PRINTING_UNITS)[number];

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
