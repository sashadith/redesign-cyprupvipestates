-- On/off switches for SEO Advisor and Page Power (admin). No rows = both ON.
CREATE TABLE "tool_switches" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByName" TEXT,

    CONSTRAINT "tool_switches_pkey" PRIMARY KEY ("key")
);
