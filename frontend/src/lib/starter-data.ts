/**
 * Data awal untuk percetakan yang baru mendaftar.
 *
 * Tanpa ini, tenant baru buntu di tengah alur kerja: `ProductionJob` mewajibkan
 * `machine_id`, `finishProduction` mewajibkan pencatatan pemakaian bahan, dan
 * SCAN7 butuh lokasi rak. Semuanya tidak dibuat saat registrasi, sehingga order
 * bisa dibuat dan desainnya di-ACC, lalu berhenti — tanpa satu pun petunjuk di
 * aplikasi tentang apa yang kurang.
 *
 * Isinya sengaja bersifat kerangka, bukan tebakan tentang bisnis orang: satu
 * mesin dan bahan-bahan paling umum di percetakan Indonesia, semuanya dengan
 * stok 0 supaya Owner tetap harus mengisi angka sebenarnya. Tujuannya membuat
 * alurnya bisa diselesaikan sejak hari pertama, bukan menggantikan master data.
 *
 * Definisi rak dipakai bersama dengan `seedDefaultStorageLayout()` di
 * `actions/storage.ts` supaya tidak ada dua sumber kebenaran.
 */

export const DEFAULT_STORAGE_LAYOUT = [
  { zone: "A", floor: 3, racks: 3, slots: 4, capacityMax: 3 },
  { zone: "B", floor: 3, racks: 2, slots: 4, capacityMax: 6 },
  { zone: "C", floor: 3, racks: 1, slots: 4, capacityMax: 2 },
  { zone: "D", floor: 3, racks: 1, slots: 2, capacityMax: 20 },
  { zone: "COUNTER", floor: 1, racks: 1, slots: 3, capacityMax: 10 },
] as const;

export function buildLocationCode(zone: string, rack?: string, slot?: string, floor = 3) {
  const parts = [`LT${floor}`, zone.trim().toUpperCase(), rack?.trim(), slot?.trim()].filter(Boolean);
  return parts.join("-");
}

export function defaultLocationName(zone: string, rack?: string, slot?: string, floor = 3) {
  return `Lantai ${floor} Zona ${zone.toUpperCase()}${rack ? ` Rak ${rack}` : ""}${slot ? ` Slot ${slot}` : ""}`;
}

export interface StorageLocationRow {
  tenant_id: string;
  location_code: string;
  name: string;
  floor: number;
  zone: string;
  rack: string | null;
  slot: string | null;
  capacity_max: number;
  qr_code_value: string;
}

/**
 * Bangun baris lokasi rak dari layout standar.
 * `skipCodes` melewati kode yang sudah ada, supaya aman dijalankan ulang.
 */
export function buildStorageLocations(tenantId: string, skipCodes: Set<string> = new Set()): StorageLocationRow[] {
  const rows: StorageLocationRow[] = [];
  for (const grp of DEFAULT_STORAGE_LAYOUT) {
    for (let r = 1; r <= grp.racks; r++) {
      for (let s = 1; s <= grp.slots; s++) {
        const rack = grp.zone === "COUNTER" ? undefined : String(r).padStart(2, "0");
        const slot = String(s).padStart(2, "0");
        const code = buildLocationCode(grp.zone, rack, slot, grp.floor);
        if (skipCodes.has(code)) continue;
        rows.push({
          tenant_id: tenantId,
          location_code: code,
          name: defaultLocationName(grp.zone, rack, slot, grp.floor),
          floor: grp.floor,
          zone: grp.zone,
          rack: rack ?? null,
          slot: slot ?? null,
          capacity_max: grp.capacityMax,
          qr_code_value: `LOC:${code}`,
        });
      }
    }
  }
  return rows;
}

/**
 * Satu mesin kerangka. Sengaja hanya satu dan diberi nama jelas — Owner harus
 * menggantinya dengan mesin sungguhan, tapi produksi sudah bisa ditugaskan
 * sejak hari pertama.
 */
export function buildStarterMachines(tenantId: string) {
  return [
    {
      tenant_id: tenantId,
      machine_code: "MCH-001",
      name: "Mesin Utama (ganti namanya)",
      category: "INDOOR",
      status: "ACTIVE",
      notes: "Dibuat otomatis saat pendaftaran. Ganti nama dan kategorinya sesuai mesin Anda.",
    },
  ];
}

/**
 * Bahan paling umum di percetakan. Semua stok 0 — Owner mengisi angka
 * sebenarnya lewat menu Bahan. `added_by` diisi user Owner.
 */
export function buildStarterMaterials(tenantId: string, addedBy: string) {
  const base = [
    { code: "MAT-0001", name: "Flexi China 280gr", type: "MEDIA", unit_stock: "ROLL", unit_usage: "METER", conversion_factor: 50 },
    { code: "MAT-0002", name: "Albatros",          type: "MEDIA", unit_stock: "ROLL", unit_usage: "METER", conversion_factor: 50 },
    { code: "MAT-0003", name: "Stiker Vinyl",      type: "MEDIA", unit_stock: "ROLL", unit_usage: "METER", conversion_factor: 50 },
    { code: "MAT-0004", name: "Art Paper A3",      type: "MEDIA", unit_stock: "RIM",  unit_usage: "LEMBAR", conversion_factor: 500 },
    { code: "MAT-0005", name: "Tinta Eco Solvent", type: "INK",   unit_stock: "LITER", unit_usage: "ML",    conversion_factor: 1000 },
  ];

  return base.map((m) => ({
    tenant_id: tenantId,
    material_code: m.code,
    name: m.name,
    type: m.type,
    unit_stock: m.unit_stock,
    unit_usage: m.unit_usage,
    conversion_factor: m.conversion_factor,
    min_stock: 0,
    current_stock: 0,
    standard_cost: 0,
    added_by: addedBy,
    active: true,
  }));
}
