-- Product-specific material allowlist.
-- Existing default_material_id remains for backward compatibility while the
-- application migrates reads and writes to ProductMaterial.
CREATE TABLE "ProductMaterial" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PRIMARY',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMaterial_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductMaterial_tenant_id_product_id_material_id_key"
  ON "ProductMaterial"("tenant_id", "product_id", "material_id");
CREATE INDEX "ProductMaterial_tenant_id_product_id_active_idx"
  ON "ProductMaterial"("tenant_id", "product_id", "active");
CREATE INDEX "ProductMaterial_tenant_id_material_id_active_idx"
  ON "ProductMaterial"("tenant_id", "material_id", "active");
CREATE UNIQUE INDEX "ProductMaterial_one_active_default_per_product_key"
  ON "ProductMaterial"("tenant_id", "product_id")
  WHERE "active" = true AND "is_default" = true;

ALTER TABLE "ProductMaterial"
  ADD CONSTRAINT "ProductMaterial_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductMaterial"
  ADD CONSTRAINT "ProductMaterial_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductMaterial"
  ADD CONSTRAINT "ProductMaterial_material_id_fkey"
  FOREIGN KEY ("material_id") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing configured defaults as the initial allowlist. This is
-- intentionally limited to rows whose default material belongs to the same
-- tenant; it never widens compatibility from historical order items.
INSERT INTO "ProductMaterial" (
  "id", "tenant_id", "product_id", "material_id", "role", "is_default",
  "active", "sort_order", "created_at", "updated_at"
)
SELECT
  md5(p."id" || ':' || p."default_material_id"),
  p."tenant_id",
  p."id",
  p."default_material_id",
  'PRIMARY',
  true,
  true,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Product" p
JOIN "Material" m
  ON m."id" = p."default_material_id"
 AND m."tenant_id" = p."tenant_id"
WHERE p."default_material_id" IS NOT NULL;
