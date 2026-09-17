-- DropIndex
DROP INDEX "ProductionJob_tenant_id_finishing_assignee_id_status_idx";

-- DropIndex
DROP INDEX "ProductionJob_tenant_id_qc_assignee_id_status_idx";

-- DropIndex
DROP INDEX "StorageItem_tenant_id_status_incident_resolved_at_idx";

-- AlterTable
ALTER TABLE "Correction" ADD COLUMN     "refund_method" TEXT;

-- AlterTable
ALTER TABLE "MaterialStocktakeItem" ALTER COLUMN "counted_stock" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "variance" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "PurchaseOrder" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Supplier" ALTER COLUMN "updated_at" DROP DEFAULT;
