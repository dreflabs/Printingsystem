-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "default_discount" DECIMAL(15,2),
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'Umum';

-- AlterTable
ALTER TABLE "RetailProduct" ADD COLUMN     "makloon_price" DECIMAL(15,2);
