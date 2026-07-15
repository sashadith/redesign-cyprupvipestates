-- Auto-saved snapshot of the admin's last-used Property Matching panel filters
-- per lead, so reopening a lead shows exactly what the client is searching for.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lastMatchFilters" JSONB;
