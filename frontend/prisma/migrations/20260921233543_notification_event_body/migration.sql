-- DropForeignKey
ALTER TABLE "NotificationEvent" DROP CONSTRAINT "NotificationEvent_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "NotificationEvent" DROP CONSTRAINT "NotificationEvent_order_id_fkey";

-- AlterTable
ALTER TABLE "NotificationEvent" ADD COLUMN     "body" TEXT,
ALTER COLUMN "order_id" DROP NOT NULL,
ALTER COLUMN "customer_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
