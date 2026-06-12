-- AddForeignKey
ALTER TABLE "maintenance_comments" ADD CONSTRAINT "maintenance_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
