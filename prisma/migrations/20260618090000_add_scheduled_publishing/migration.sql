-- Scheduled publishing: nullable scheduledAt + (status, scheduledAt) index on schedulable content
ALTER TABLE "projects" ADD COLUMN "scheduledAt" TIMESTAMP(3);
ALTER TABLE "blogs" ADD COLUMN "scheduledAt" TIMESTAMP(3);
ALTER TABLE "singlepages" ADD COLUMN "scheduledAt" TIMESTAMP(3);
ALTER TABLE "case_studies" ADD COLUMN "scheduledAt" TIMESTAMP(3);

CREATE INDEX "projects_status_scheduledAt_idx" ON "projects"("status", "scheduledAt");
CREATE INDEX "blogs_status_scheduledAt_idx" ON "blogs"("status", "scheduledAt");
CREATE INDEX "singlepages_status_scheduledAt_idx" ON "singlepages"("status", "scheduledAt");
CREATE INDEX "case_studies_status_scheduledAt_idx" ON "case_studies"("status", "scheduledAt");
