-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "group_name" TEXT,
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'PRIMARY',
ADD COLUMN     "specifications" TEXT,
ALTER COLUMN "current_stock" SET DATA TYPE DECIMAL(18,6);

-- AlterTable
ALTER TABLE "ProductMaterial" ADD COLUMN     "unit_price" DECIMAL(15,2);

-- AlterTable
ALTER TABLE "MaterialMovement" ALTER COLUMN "quantity_usage" SET DATA TYPE DECIMAL(18,6),
ALTER COLUMN "quantity_stock_change" SET DATA TYPE DECIMAL(18,6),
ALTER COLUMN "before_stock" SET DATA TYPE DECIMAL(18,6),
ALTER COLUMN "after_stock" SET DATA TYPE DECIMAL(18,6);

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "material_snapshot" JSONB,
ADD COLUMN     "pricing_snapshot" JSONB;

-- CreateTable
CREATE TABLE "ProductionJobItem" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "material_id" TEXT,

    CONSTRAINT "ProductionJobItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionJobItem_tenant_id_order_item_id_idx" ON "ProductionJobItem"("tenant_id", "order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionJobItem_job_id_order_item_id_key" ON "ProductionJobItem"("job_id", "order_item_id");

-- AddForeignKey
ALTER TABLE "ProductionJobItem" ADD CONSTRAINT "ProductionJobItem_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "ProductionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJobItem" ADD CONSTRAINT "ProductionJobItem_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJobItem" ADD CONSTRAINT "ProductionJobItem_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ink is a machine consumable, never a primary order substrate.
UPDATE "Material" SET "purpose" = 'CONSUMABLE' WHERE "type" = 'INK';
-- Only unambiguous legacy orders are backfilled. Multi-job orders need Admin review.
INSERT INTO "ProductionJobItem" ("id", "tenant_id", "job_id", "order_item_id", "material_id")
SELECT md5(j."id" || ':' || i."id"), j."tenant_id", j."id", i."id", i."material_id"
FROM "ProductionJob" j JOIN "OrderItem" i ON i."order_id" = j."order_id" AND i."tenant_id" = j."tenant_id"
WHERE i."retail_product_id" IS NULL
AND (SELECT count(*) FROM "ProductionJob" s WHERE s."order_id" = j."order_id" AND s."tenant_id" = j."tenant_id") = 1;

ALTER TABLE "ProductionJob" ADD COLUMN "material_plan_history" JSONB;
