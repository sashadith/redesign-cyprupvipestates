-- Global, admin-editable AI prompt templates (one row per feature key), shared
-- across all projects and editable in-place from any project's own page.
CREATE TABLE IF NOT EXISTS "ai_prompt_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_prompt_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_prompt_templates_key_key" ON "ai_prompt_templates"("key");
