/*
  Warnings:

  - Added the required column `created_by_user_id` to the `message_threads` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_thread_id_fkey";

-- DropIndex
DROP INDEX "message_threads_organization_id_idx";

-- AlterTable
ALTER TABLE "message_threads" ADD COLUMN     "created_by_user_id" UUID NOT NULL,
ADD COLUMN     "property_id" UUID,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "thread_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "thread_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "last_read_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thread_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "thread_participants_user_id_idx" ON "thread_participants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "thread_participants_thread_id_user_id_key" ON "thread_participants"("thread_id", "user_id");

-- CreateIndex
CREATE INDEX "message_threads_organization_id_updated_at_idx" ON "message_threads"("organization_id", "updated_at");

-- AddForeignKey
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_participants" ADD CONSTRAINT "thread_participants_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "message_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_participants" ADD CONSTRAINT "thread_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "message_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
