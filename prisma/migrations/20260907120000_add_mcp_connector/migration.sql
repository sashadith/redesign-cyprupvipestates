-- MCP connector (2026-09-07): OAuth clients/codes/tokens, email drafts (Phase 2), tool-call audit log.
-- Purely additive — five new tables and one new enum. No existing table, column or enum value changes,
-- so applying this before the code deploys cannot break the running app (old code never reads these tables).

-- CreateEnum
CREATE TYPE "LeadEmailDraftStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'SUPERSEDED', 'EXPIRED', 'LOCKED');

-- CreateTable
CREATE TABLE "mcp_oauth_clients" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT,
    "redirectUris" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_oauth_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_auth_codes" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_auth_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_tokens" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuedHost" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_email_drafts" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "approvalCode" TEXT NOT NULL,
    "status" "LeadEmailDraftStatus" NOT NULL DEFAULT 'PENDING',
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "previewMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "sentInteractionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_email_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_tool_calls" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenId" TEXT,
    "tool" TEXT NOT NULL,
    "leadId" TEXT,
    "ok" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_oauth_clients_clientId_key" ON "mcp_oauth_clients"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_auth_codes_codeHash_key" ON "mcp_auth_codes"("codeHash");

-- CreateIndex
CREATE INDEX "mcp_auth_codes_expiresAt_idx" ON "mcp_auth_codes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_tokens_accessTokenHash_key" ON "mcp_tokens"("accessTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_tokens_refreshTokenHash_key" ON "mcp_tokens"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "mcp_tokens_userId_idx" ON "mcp_tokens"("userId");

-- CreateIndex
CREATE INDEX "mcp_tokens_familyId_idx" ON "mcp_tokens"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_email_drafts_sentInteractionId_key" ON "lead_email_drafts"("sentInteractionId");

-- CreateIndex
CREATE INDEX "lead_email_drafts_leadId_status_idx" ON "lead_email_drafts"("leadId", "status");

-- CreateIndex
CREATE INDEX "lead_email_drafts_status_expiresAt_idx" ON "lead_email_drafts"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "mcp_tool_calls_createdAt_idx" ON "mcp_tool_calls"("createdAt");

-- CreateIndex
CREATE INDEX "mcp_tool_calls_leadId_idx" ON "mcp_tool_calls"("leadId");

-- AddForeignKey
ALTER TABLE "mcp_auth_codes" ADD CONSTRAINT "mcp_auth_codes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "mcp_oauth_clients"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_auth_codes" ADD CONSTRAINT "mcp_auth_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "mcp_oauth_clients"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_email_drafts" ADD CONSTRAINT "lead_email_drafts_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_email_drafts" ADD CONSTRAINT "lead_email_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

