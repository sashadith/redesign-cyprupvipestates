-- Typefully monitoring state (2026-10-24): durable consecutive-failure count,
-- alert/recovery flags, and the planned-draft dates of the last good check.
CREATE TABLE IF NOT EXISTS "social_monitor_state" (
    "id" TEXT NOT NULL,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "first_failure_at" TIMESTAMP(3),
    "last_failure_at" TIMESTAMP(3),
    "last_error" TEXT,
    "alerted_at" TIMESTAMP(3),
    "recovery_pending" BOOLEAN NOT NULL DEFAULT false,
    "upcoming_planned_at" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_monitor_state_pkey" PRIMARY KEY ("id")
);

INSERT INTO "social_monitor_state" ("id", "updated_at")
VALUES ('typefully', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- The old one-alert-per-outage marker (draft 0 / "api-unreachable") is replaced
-- by alerted_at. An outage already alerted at deploy time stays alerted (and
-- gets its recovery message) instead of being alerted a second time.
UPDATE "social_monitor_state" SET "alerted_at" = (
  SELECT "sent_at" FROM "social_reminders_sent" WHERE "draft_id" = 0 AND "reminder_kind" = 'api-unreachable'
) WHERE "id" = 'typefully' AND "alerted_at" IS NULL;

DELETE FROM "social_reminders_sent" WHERE "draft_id" = 0 AND "reminder_kind" = 'api-unreachable';
