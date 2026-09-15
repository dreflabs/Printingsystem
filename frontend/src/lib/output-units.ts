/** Unit output barang jadi yang dipakai di produksi dan storage. */
export const OUTPUT_UNITS = ["PCS", "M2", "METER", "LEMBAR", "RIM", "MIXED"] as const;
export type OutputUnit = (typeof OUTPUT_UNITS)[number];

/**
 * Menentukan unit output dari item yang berada dalam satu job.
 * Job per mesin dapat memuat beberapa item; bila unitnya berbeda, nilai MIXED
 * mencegah sistem menampilkan angka seolah-olah semuanya pcs.
 */
export function resolveOutputUnit(units: Array<string | null | undefined>): OutputUnit {
  const normalized = [...new Set(units
    .filter((unit): unit is string => Boolean(unit?.trim()))
    .map((unit) => unit.trim().toUpperCase()))];
  if (normalized.length === 0) return "PCS";
  if (normalized.length > 1) return "MIXED";
  return OUTPUT_UNITS.includes(normalized[0] as OutputUnit) ? normalized[0] as OutputUnit : "MIXED";
}

export function outputUnitLabel(unit: string | null | undefined): string {
  switch ((unit ?? "PCS").toUpperCase()) {
    case "M2": return "m²";
    case "METER": return "meter";
    case "LEMBAR": return "lembar";
    case "RIM": return "rim";
    case "MIXED": return "unit campuran";
    default: return "pcs";
  }
}
