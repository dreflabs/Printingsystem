/**
 * Quantities entered for material receipts and purchase orders use
 * two-decimal precision. Production consumption can still create six-decimal
 * stock movements after conversion; this helper is only for inbound quantities.
 */
export const MATERIAL_INPUT_STEP = 0.01;

export function validateMaterialInboundQuantity(value: number, label = "Jumlah") {
  if (!Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 100))) {
    throw new Error(`${label} harus berupa angka dengan maksimal 2 angka desimal.`);
  }
  if (!(value > 0)) {
    throw new Error(`${label} harus lebih dari 0.`);
  }
  const normalized = Math.round(value * 100) / 100;
  if (Math.abs(value - normalized) > 1e-9) {
    throw new Error(`${label} harus menggunakan maksimal 2 angka desimal.`);
  }
  return normalized;
}
