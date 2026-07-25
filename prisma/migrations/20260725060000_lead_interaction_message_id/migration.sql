-- Phase 4 (email inbound) — additive only.

-- Message-ID threading: reused for both outbound (the ID we sent) and
-- inbound (the ID we received, giving idempotent inbound processing via
-- the same unique column). Nullable — all existing rows have none, and
-- Postgres allows unlimited NULLs under a UNIQUE constraint, so this is
-- safe on top of existing history.
ALTER TABLE "lead_interactions" ADD COLUMN "messageId" TEXT;
CREATE UNIQUE INDEX "lead_interactions_messageId_key" ON "lead_interactions"("messageId");

-- IMAP UID cursor, per-mailbox (1:1 with UserEmailSettings today). BigInt
-- since IMAP UIDs/UIDVALIDITY are unsigned 32-bit.
ALTER TABLE "user_email_settings" ADD COLUMN "imapLastUid" BIGINT;
ALTER TABLE "user_email_settings" ADD COLUMN "imapUidValidity" BIGINT;
