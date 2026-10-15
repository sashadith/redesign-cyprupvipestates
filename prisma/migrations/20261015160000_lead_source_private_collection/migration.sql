-- Private Collection enquiries in the CRM (2026-10-15). Purely additive: one
-- new LeadSource value. It is only ever WRITTEN by code that ships together with
-- this migration (/api/webhooks/private-collection-lead), and the Private
-- Collection site starts posting there only after this release is live.
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'PRIVATE_COLLECTION';
