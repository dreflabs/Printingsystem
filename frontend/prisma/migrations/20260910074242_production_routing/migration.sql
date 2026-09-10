-- AlterTable
ALTER TABLE "Machine" ADD COLUMN     "default_operator_id" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "auto_release_blocked" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "require_admin_production_release" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_default_operator_id_fkey" FOREIGN KEY ("default_operator_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
