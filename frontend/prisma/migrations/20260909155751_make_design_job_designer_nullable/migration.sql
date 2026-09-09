-- DropForeignKey
ALTER TABLE "DesignJob" DROP CONSTRAINT "DesignJob_designer_id_fkey";

-- DropForeignKey
ALTER TABLE "ProductionJob" DROP CONSTRAINT "ProductionJob_operator_id_fkey";

-- AlterTable
ALTER TABLE "DesignJob" ALTER COLUMN "designer_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "DesignJob" ADD CONSTRAINT "DesignJob_designer_id_fkey" FOREIGN KEY ("designer_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
