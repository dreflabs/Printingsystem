/**
 * Weighted-average cost per stock unit. Harga lama dipertahankan jika
 * penerimaan baru tidak membawa harga beli atau saldo sesudah penerimaan nol.
 */
export function weightedAverageCost(
  existingQuantity: number,
  existingCost: number,
  incomingQuantity: number,
  incomingCost: number | null | undefined,
): number {
  if (!Number.isFinite(existingQuantity) || existingQuantity < 0) throw new Error("Saldo material lama tidak valid.");
  if (!Number.isFinite(existingCost) || existingCost < 0) throw new Error("HPP material lama tidak valid.");
  if (!Number.isFinite(incomingQuantity) || incomingQuantity < 0) throw new Error("Jumlah penerimaan tidak valid.");
  if (incomingCost == null || !Number.isFinite(incomingCost) || incomingCost < 0) return existingCost;
  const totalQuantity = existingQuantity + incomingQuantity;
  if (totalQuantity <= 0) return existingCost;
  return ((existingQuantity * existingCost) + (incomingQuantity * incomingCost)) / totalQuantity;
}

export function movementCostAmount(quantityStockChange: number, unitCost: number | null | undefined): number | null {
  if (unitCost == null) return null;
  if (!Number.isFinite(quantityStockChange) || !Number.isFinite(unitCost)) return null;
  return Math.abs(quantityStockChange) * unitCost;
}
