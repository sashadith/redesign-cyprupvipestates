-- Social reminders + notify_owner_telegram (2026-10-09). Purely additive — a
-- new table and one nullable column, no default, nothing existing touched;
-- applying it before the code deploys cannot break the running app (old code
-- never reads either).

-- CreateTable
CREATE TABLE "social_reminders_sent" (
    "id" TEXT NOT NULL,
    "draft_id" INTEGER NOT NULL,
    "reminder_kind" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_reminders_sent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_reminders_sent_draft_id_reminder_kind_key" ON "social_reminders_sent"("draft_id", "reminder_kind");

-- AlterTable
ALTER TABLE "mcp_tool_calls" ADD COLUMN "detail" JSONB;
