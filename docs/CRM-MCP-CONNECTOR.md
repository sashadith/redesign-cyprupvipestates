# CRM MCP connector (claude.ai "CVE LEADS")

Design: `docs/superpowers/specs/2026-09-07-crm-mcp-connector-design.md`.
Status: Phase 1 (read-only tools) — see the spec for Phase 2 (writes, email drafts with approval code).

## What it is

A remote MCP server inside this app at `/api/mcp`, protected by a minimal OAuth 2.1
server on the admin login. claude.ai connects to it as a *custom connector* and gets
six read-only tools: `crm_worklist`, `crm_search_leads`, `crm_get_lead`,
`crm_match_properties`, `crm_get_project`, `crm_get_playbook`.

## Environment

- `MCP_PUBLIC_ORIGIN` — this app's public origin, no path. Production
  `https://cyprusvipestates.com`, staging `https://design.cyprusvipestates.com`.
  Must be set in the VPS `.env` of each app **before** the connector is used;
  the discovery endpoints return 500 with a clear message if it is missing.
- `CRON_SECRET` — already present; used by `/api/cron/mcp-cleanup`.

## Deploy checklist (Phase 1)

1. Code on `main`, deployed (`scripts/deploy-prod.sh` / `deploy-staging.sh`).
2. Migration `20260907120000_add_mcp_connector` applied to the shared DB
   (`CVP_RUN_MIGRATE=1`, or `npx prisma migrate deploy` on the VPS). Additive only —
   safe to apply before or after the code deploy.
3. `MCP_PUBLIC_ORIGIN` in the app's `.env`, app restarted.
4. Crontab: `15 5 * * * curl -s "http://127.0.0.1:3000/api/cron/mcp-cleanup?key=$CRON_SECRET"`.
5. Verify: `curl -si https://<host>/.well-known/oauth-authorization-server` → 200 JSON,
   no `x-middleware-rewrite` header; `curl -si -X POST https://<host>/api/mcp` → 401 with
   `WWW-Authenticate`.

## Connecting claude.ai

1. claude.ai → Settings → Connectors → *Add custom connector*.
2. Name: `CVE CRM`. URL: `https://cyprusvipestates.com/api/mcp`. Leave OAuth client id/secret empty
   (the server registers the client automatically).
3. Click Connect → you land on `/admin/mcp/authorize` (log in if asked) → **Allow**.
4. In the "CVE LEADS" project, enable the connector and its tools.

## Disconnecting / reconnecting

Admin → Account → **Connected apps** → Disconnect. Or remove the connector in claude.ai.
Tokens live 8 h and refresh automatically for 90 days; after 90 days without use,
reconnect (step 3 above). Deactivating the admin user kills every token immediately.

## Audit

Admin → Account → Connected apps → *Recent activity* lists the last 100 tool calls
(tool, lead, ok/error, duration). Arguments and message text are never stored.

## Local development

`.env.local` default: `MCP_PUBLIC_ORIGIN=http://localhost:3000`. `MCP_PUBLIC_ORIGIN`
must equal the origin the dev server is actually reached on — if port 3000 is taken by
another session on the machine, run on another port and override it for that shell,
e.g. `MCP_PUBLIC_ORIGIN=http://localhost:3100 npx next dev -p 3100`. Unit tests:
`npm test`. End-to-end: `node scripts/qa/mcp-smoke.mjs` (needs the migration applied on
the DB the app points at — which is production; run it against staging/production
after deploy).

## Troubleshooting

| Symptom | Cause |
|---|---|
| claude.ai says it cannot connect / "not an MCP server" | `/.well-known/...` 404 → `.well-known` missing from `src/middleware.ts` matcher, or `MCP_PUBLIC_ORIGIN` unset |
| Consent page shows "Connection request rejected" | redirect URI not on claude.ai/claude.com or client id unknown (re-add the connector) |
| Tools return `rate_limited` | 120 calls/min per token; wait a minute |
| Tools return `config` | `MCP_PUBLIC_ORIGIN` invalid |
