-- Preserve the unit-cost snapshot and make the total movement cost queryable.
ALTER TABLE "MaterialMovement"
  ADD COLUMN "cost_amount" DECIMAL(18,2);

UPDATE "MaterialMovement"
SET "cost_amount" = ABS("quantity_stock_change") * "unit_cost"
WHERE "cost_amount" IS NULL AND "unit_cost" IS NOT NULL;
