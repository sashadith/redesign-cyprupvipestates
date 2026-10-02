-- CC recipients on MCP email drafts (2026-10-02): fixed at draft time, shown
-- in the operator's preview, sent verbatim by crm_send_email. Purely additive —
-- one column with a default, no existing column touched; applying it before
-- the code deploys cannot break the running app (old code never reads it).
ALTER TABLE "lead_email_drafts" ADD COLUMN "cc" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
