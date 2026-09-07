#!/usr/bin/env node
// End-to-end check of the MCP connector against a running app (default
// http://localhost:3000): DCR → consent (you click Allow in the browser) →
// PKCE token exchange → MCP initialize → the read tools. Read-only.
//
//   MCP_SMOKE_BASE=http://localhost:3000 node scripts/qa/mcp-smoke.mjs
//
// Requires the migration to be applied on the database the app points at and
// MCP_PUBLIC_ORIGIN set to the same base URL in the app's env.
import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const BASE = (process.env.MCP_SMOKE_BASE || "http://localhost:3000").replace(/\/$/, "");
const b64url = (b) => b.toString("base64url");
const assert = (cond, msg) => { if (!cond) { console.error(`✗ ${msg}`); process.exit(1); } console.log(`✓ ${msg}`); };

// 1. Discovery
const prm = await (await fetch(`${BASE}/.well-known/oauth-protected-resource`)).json();
assert(prm.resource === `${BASE}/api/mcp`, "protected resource metadata points at /api/mcp");
const asm = await (await fetch(`${BASE}/.well-known/oauth-authorization-server`)).json();
assert(asm.registration_endpoint === `${BASE}/api/mcp/oauth/register`, "authorization server metadata served");

// 2. Unauthenticated call gets the 401 challenge
const unauth = await fetch(`${BASE}/api/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }) });
assert(unauth.status === 401 && /resource_metadata=/.test(unauth.headers.get("www-authenticate") || ""), "401 + WWW-Authenticate challenge without a token");

// 3. DCR — our redirect must be on claude.ai per the allow-list, so the
//    consent redirect is captured by intercepting it: we register the real
//    claude.ai callback URL but read the code from the browser's address bar.
const redirectUri = "https://claude.ai/api/mcp/auth_callback";
const reg = await (await fetch(asm.registration_endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "mcp-smoke", redirect_uris: [redirectUri] }) })).json();
assert(reg.client_id, "dynamic client registration returned a client_id");

// 4. Consent — PKCE
const verifier = b64url(randomBytes(32));
const challenge = b64url(createHash("sha256").update(verifier, "ascii").digest());
const state = b64url(randomBytes(8));
const authorizeUrl = `${asm.authorization_endpoint}?${new URLSearchParams({ client_id: reg.client_id, redirect_uri: redirectUri, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", state })}`;
console.log("\nOpen this URL in a browser where you are logged into the admin, click Allow, then paste the FULL URL you land on (it will be a claude.ai URL that may 404 — that is fine):\n\n" + authorizeUrl + "\n");
const landed = await new Promise((resolve) => { process.stdin.setEncoding("utf8"); process.stdin.once("data", (d) => resolve(d.trim())); });
const landedUrl = new URL(landed);
assert(landedUrl.searchParams.get("state") === state, "state round-tripped");
const code = landedUrl.searchParams.get("code");
assert(code, "authorization code received");

// 5. Token exchange
const tok = await (await fetch(asm.token_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: verifier, client_id: reg.client_id, redirect_uri: redirectUri }) })).json();
assert(tok.access_token && tok.refresh_token, "token exchange returned access + refresh tokens");
const replay = await fetch(asm.token_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: verifier, client_id: reg.client_id, redirect_uri: redirectUri }) });
assert(replay.status === 400, "replaying the code is rejected");

// 6. Refresh rotation
const refreshed = await (await fetch(asm.token_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tok.refresh_token, client_id: reg.client_id }) })).json();
assert(refreshed.access_token && refreshed.refresh_token !== tok.refresh_token, "refresh rotates the refresh token");

// 7. MCP session
const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/api/mcp`), { authProvider: { token: async () => refreshed.access_token } });
const client = new Client({ name: "mcp-smoke", version: "1.0.0" });
await client.connect(transport);
assert(/crm_get_project/.test(client.getInstructions() || ""), "server instructions received");
const tools = await client.listTools();
const names = tools.tools.map((t) => t.name).sort();
assert(JSON.stringify(names) === JSON.stringify(["crm_get_lead", "crm_get_playbook", "crm_get_project", "crm_match_properties", "crm_search_leads", "crm_worklist"]), `six read tools listed: ${names.join(", ")}`);

const parse = (r) => JSON.parse(r.content[0].text);
const worklist = parse(await client.callTool({ name: "crm_worklist", arguments: { limit: 5 } }));
assert(Array.isArray(worklist.followUps) && typeof worklist.newLeadsLast7Days === "number", `crm_worklist: ${worklist.followUps.length} follow-ups, ${worklist.newLeadsLast7Days} new leads`);

const search = parse(await client.callTool({ name: "crm_search_leads", arguments: { pageSize: 3 } }));
assert(search.total >= 0 && search.leads.every((l) => !("password" in l) && !("utmSource" in l)), `crm_search_leads: ${search.total} leads, no excluded fields`);

const firstId = worklist.followUps[0]?.leadId ?? search.leads[0]?.leadId;
if (firstId) {
  const lead = parse(await client.callTool({ name: "crm_get_lead", arguments: { leadId: firstId } }));
  assert(lead.leadState?.code && Array.isArray(lead.interactions?.rows), `crm_get_lead: ${lead.name} → ${lead.leadState.code}`);
  const inboundLeak = lead.interactions.rows.some((r) => ["EMAIL_IN", "WHATSAPP_IN"].includes(r.type) && "body" in r);
  assert(!inboundLeak, "inbound bodies only under untrusted_content");
  const match = parse(await client.callTool({ name: "crm_match_properties", arguments: { leadId: firstId, limit: 3 } }));
  assert(Array.isArray(match.matches), `crm_match_properties: ${match.matches.length} matches`);
}
const playbook = parse(await client.callTool({ name: "crm_get_playbook", arguments: {} }));
assert(playbook.contactPhone && playbook.sections.length > 0, "crm_get_playbook returns sections");
const proj = parse(await client.callTool({ name: "crm_get_project", arguments: { query: "a" } }));
assert(Array.isArray(proj.candidates), `crm_get_project query: ${proj.candidates.length} candidates`);

const notFound = await client.callTool({ name: "crm_get_lead", arguments: { leadId: "00000000-0000-0000-0000-000000000000" } });
assert(notFound.isError === true, "unknown lead → isError");

await client.close();
console.log("\nAll smoke checks passed. Disconnect the 'mcp-smoke' connection under Admin → Account → Connected apps.");
process.exit(0);
