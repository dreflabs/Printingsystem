-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "addon_users" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TenantSubscription" ADD COLUMN     "service_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "term_months" INTEGER NOT NULL DEFAULT 1;
