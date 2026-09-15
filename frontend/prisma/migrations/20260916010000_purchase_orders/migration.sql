-- Supplier and purchase-order traceability for material receipts.
CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseOrder" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "po_number" TEXT NOT NULL,
  "supplier_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expected_date" TIMESTAMP(3),
  "notes" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseOrderItem" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "purchase_order_id" TEXT NOT NULL,
  "material_id" TEXT NOT NULL,
  "ordered_qty" DECIMAL(18,6) NOT NULL,
  "received_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "unit_cost" DECIMAL(15,2) NOT NULL,
  "notes" TEXT,
  CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MaterialMovement"
  ADD COLUMN "supplier_id" TEXT,
  ADD COLUMN "purchase_order_id" TEXT,
  ADD COLUMN "purchase_order_item_id" TEXT;

ALTER TABLE "Supplier"
  ADD CONSTRAINT "Supplier_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PurchaseOrder_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PurchaseOrder_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderItem"
  ADD CONSTRAINT "PurchaseOrderItem_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PurchaseOrderItem_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PurchaseOrderItem_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialMovement"
  ADD CONSTRAINT "MaterialMovement_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MaterialMovement_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MaterialMovement_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Supplier_tenant_id_code_key" ON "Supplier"("tenant_id", "code");
CREATE INDEX "Supplier_tenant_id_active_name_idx" ON "Supplier"("tenant_id", "active", "name");
CREATE UNIQUE INDEX "PurchaseOrder_tenant_id_po_number_key" ON "PurchaseOrder"("tenant_id", "po_number");
CREATE INDEX "PurchaseOrder_tenant_id_status_order_date_idx" ON "PurchaseOrder"("tenant_id", "status", "order_date");
CREATE INDEX "PurchaseOrderItem_tenant_id_purchase_order_id_idx" ON "PurchaseOrderItem"("tenant_id", "purchase_order_id");
CREATE INDEX "PurchaseOrderItem_tenant_id_material_id_idx" ON "PurchaseOrderItem"("tenant_id", "material_id");
