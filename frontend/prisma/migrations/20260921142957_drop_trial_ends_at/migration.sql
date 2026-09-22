/*
  Warnings:

  - You are about to drop the column `trial_ends_at` on the `Tenant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "trial_ends_at";
