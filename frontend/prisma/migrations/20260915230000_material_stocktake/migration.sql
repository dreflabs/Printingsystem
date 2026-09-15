-- Controlled material stocktake with Owner approval.
CREATE TABLE "MaterialStocktake" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "created_by" TEXT NOT NULL,
  "submitted_by" TEXT,
  "approved_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  CONSTRAINT "MaterialStocktake_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaterialStocktakeItem" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "stocktake_id" TEXT NOT NULL,
  "material_id" TEXT NOT NULL,
  "system_stock" DECIMAL(18,6) NOT NULL,
  "counted_stock" DECIMAL(18,6),
  "variance" DECIMAL(18,6),
  "notes" TEXT,
  "counted_by" TEXT,
  "counted_at" TIMESTAMP(3),
  CONSTRAINT "MaterialStocktakeItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MaterialStocktake"
  ADD CONSTRAINT "MaterialStocktake_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MaterialStocktake_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MaterialStocktake_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MaterialStocktake_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaterialStocktakeItem"
  ADD CONSTRAINT "MaterialStocktakeItem_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MaterialStocktakeItem_stocktake_id_fkey" FOREIGN KEY ("stocktake_id") REFERENCES "MaterialStocktake"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MaterialStocktakeItem_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MaterialStocktakeItem_counted_by_fkey" FOREIGN KEY ("counted_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "MaterialStocktakeItem_stocktake_id_material_id_key" ON "MaterialStocktakeItem"("stocktake_id", "material_id");
CREATE INDEX "MaterialStocktake_tenant_id_status_created_at_idx" ON "MaterialStocktake"("tenant_id", "status", "created_at");
CREATE INDEX "MaterialStocktakeItem_tenant_id_material_id_idx" ON "MaterialStocktakeItem"("tenant_id", "material_id");
