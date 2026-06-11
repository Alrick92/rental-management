/*
  Warnings:

  - A unique constraint covering the columns `[organization_id,idempotency_key]` on the table `bookings` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "bookings_organization_id_idempotency_key_key" ON "bookings"("organization_id", "idempotency_key");
