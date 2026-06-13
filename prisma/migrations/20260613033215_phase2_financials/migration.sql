-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "grace_period_days" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "invoice_lead_days" INTEGER NOT NULL DEFAULT 5;

-- CreateIndex
CREATE INDEX "expenses_property_id_idx" ON "expenses"("property_id");

-- CreateIndex
CREATE INDEX "landlord_payments_property_id_idx" ON "landlord_payments"("property_id");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landlord_payments" ADD CONSTRAINT "landlord_payments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landlord_payments" ADD CONSTRAINT "landlord_payments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
