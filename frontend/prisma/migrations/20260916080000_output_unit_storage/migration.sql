-- Preserve legacy integer quantities while making the finished-goods unit
-- explicit for M2, METER, LEMBAR, RIM, and PCS workflows.
ALTER TABLE "ProductionJob"
  ADD COLUMN "planned_output_quantity" DECIMAL(18,6),
  ADD COLUMN "output_unit" TEXT,
  ADD COLUMN "output_quantity" DECIMAL(18,6);

ALTER TABLE "StorageItem"
  ADD COLUMN "output_quantity" DECIMAL(18,6),
  ADD COLUMN "output_unit" TEXT,
  ADD COLUMN "package_count" INTEGER NOT NULL DEFAULT 1;

UPDATE "ProductionJob"
SET "planned_output_quantity" = "planned_qty",
    "output_quantity" = NULLIF("actual_qty", 0),
    "output_unit" = 'PCS'
WHERE "planned_output_quantity" IS NULL;

UPDATE "StorageItem"
SET "output_quantity" = "quantity",
    "output_unit" = 'PCS'
WHERE "output_quantity" IS NULL;
