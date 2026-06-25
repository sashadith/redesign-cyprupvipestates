-- CRM list filter/search performance indexes
CREATE INDEX IF NOT EXISTS "leads_email_idx" ON "leads"("email");
CREATE INDEX IF NOT EXISTS "leads_source_idx" ON "leads"("source");
CREATE INDEX IF NOT EXISTS "leads_assignedToId_idx" ON "leads"("assignedToId");

-- Activity timeline lookups + actor link
CREATE INDEX IF NOT EXISTS "lead_activities_leadId_idx" ON "lead_activities"("leadId");
ALTER TABLE "lead_activities" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
