# WhatsApp tools in the CRM MCP connector — design

**Date:** 2026-09-13
**Status:** approved, not implemented

## Problem

WhatsApp is where a large part of the lead conversation actually happens, and
until now none of it reached the CRM or claude.ai. A reconciliation run on
2026-09-13 measured the gap: of 190 individual WhatsApp chats in the preceding
90 days, 45 belonged to a CRM lead, and 20 of those 45 had WhatsApp activity
newer than anything on the lead's timeline — 7 of them showed no real contact
at all despite live conversations.

OpenWA now bridges that WhatsApp line (see `openwa-whatsapp-mcp` memory) and is
reachable from Claude Code. The claude.ai project "CVE LEADS" cannot use it:
OpenWA authenticates with a static API key, claude.ai custom connectors speak
OAuth 2.1, and OpenWA's own OAuth support is documented as planned, not built.

## Decisions

Four questions were settled with the operator before design:

1. **Surface: a small curated set, not all 51 OpenWA tools.** This is what
   removes the need for an OAuth shim entirely — see below.
2. **Send guard: recipient must already be a CRM lead**, rather than a
   draft/approval-code handshake like `crm_draft_email` → `crm_send_email`. A
   confirmation code per WhatsApp reply was judged too heavy for the medium.
3. **Read scope: lead-bound.** Tools address a `leadId`, never a raw phone
   number or the chat list, so private threads (family, friends, the
   photographer) stay outside a project that is opened on a phone.
4. **Deployment is the operator's call.** Build and test, then stop.

### Why the OAuth shim was dropped

The original request was an OAuth 2.1 shim in front of `https://wa.cyprusvipestates.com/mcp`
so claude.ai could add it as a second connector. Once the surface shrank to
"read and send, lead-bound", that shim became the expensive way to get a cheap
thing: the CRM connector is **already** registered and authorised in CVE LEADS,
so adding two tools to it costs no OAuth work, no second consent flow, no
second public authorization server, and keeps the OpenWA API key server-side.

The shim remains the right answer if the full OpenWA tool surface is ever
wanted in claude.ai. Nothing here forecloses it.

## Scope

**In:** two tools — read one lead's WhatsApp thread, send one text message to
one lead; a single server-side OpenWA client; shared phone normalisation with
tests; automatic `WHATSAPP_OUT` logging on every successful send.

**Out:** group chats, media send, media download, chats with no lead, voice
transcription (OpenWA returns no text for voice notes), an "unanswered leads"
worklist tool, and the OAuth shim.

## Architecture

Only one module knows OpenWA exists.

| File | Responsibility |
| --- | --- |
| `src/lib/openwa/client.ts` | HTTP client: `fetchThread(phone, limit)`, `sendText(phone, text)`, `chatExists(phone)`. Reads base URL, API key and session id from env. The only place holding the key. |
| `src/lib/openwa/phoneMatch.ts` | `toMsisdn(phone)` — digits only, leading `+`/spaces/zeros stripped, so `"+44 7787 597514"` becomes `"447787597514"`. Nothing fuzzier than that. |
| `src/lib/mcp/tools/whatsappThread.ts` | Registers `crm_whatsapp_thread`. |
| `src/lib/mcp/tools/whatsappSend.ts` | Registers `crm_whatsapp_send`. |
| `src/lib/mcp/tools/index.ts` | Add the two registrations. |
| `src/lib/mcp/toolNames.ts` | Add both names so the consent page and instructions list them. |

The Next.js app and OpenWA run on the same VPS, so the client talks to
`http://127.0.0.1:2785` directly — not through nginx, never over the public
internet, and the `/mcp` X-API-Key gate is irrelevant to this path.

### Addressing a chat — resolved

The reconciliation had to build a lid→phone index from 4,253 contacts, because
the chat list returns WhatsApp privacy ids (`738801512651@lid`) rather than
phone numbers. Repeating that per tool call would have forced a cached index.

**Verified on 2026-09-13 that no index is needed:** OpenWA accepts the classic
`<msisdn>@c.us` form directly and resolves it to the right conversation.
`GET /api/sessions/<id>/messages/31681595801@c.us/history` returned the thread
whose messages carry `to: 738801512651@lid`. Tools therefore build the chat id
from the lead's stored phone number and nothing else.

This also retires the reconciliation's fuzzy matching. That join compared the
**last 9 digits** because it had to marry two independently-typed datasets, and
that rule can in principle collide two numbers differing only in country code.
Here there is no join: the phone comes from the lead record the caller named,
and it is only reformatted. The fuzzy variant must not be reintroduced into
this path.

### Environment

```
OPENWA_BASE_URL=http://127.0.0.1:2785
OPENWA_API_KEY=<its own OPERATOR key, minted separately from the one Claude
                Code uses, so either can be revoked without breaking the other>
OPENWA_SESSION_ID=<session uuid>
OPENWA_DAILY_SEND_CAP=20
```

Missing or malformed values must fail loudly at tool-call time with a message
naming the variable, in the style of `McpConfigError` in `lib/mcp/publicOrigin`.
Both tools stay registered and simply error, so a misconfigured environment is
visible rather than silent.

## Tool contracts

### `crm_whatsapp_thread` (read)

Input: `leadId` (uuid, required), `limit` (1–50, default 20).

Resolves the lead, requires a phone, builds `<msisdn>@c.us`, fetches history
newest-last. Returns for each message: direction, timestamp in the CRM's
`iso`/`local`/`relative` shape, type, and the text. Inbound text goes under
`untrusted_content`, matching every other CRM tool.

Media carries a marker (`{ type, sizeBytes }`), never base64 — a single 11.1 MB
zip turned a 5-message read into an 11.1 MB response during the reconciliation.
Empty `unknown`-type rows are dropped: they are gateway sync artefacts, not
messages, and one of them nearly wrote a contact date that never happened.

Errors: lead not found / soft-deleted → "lead not found"; no phone → says so;
no thread → "no WhatsApp conversation with this lead" (not an error — a fact).

### `crm_whatsapp_send` (write)

Input: `leadId` (uuid, required), `text` (1–4000 chars, required).

All four guards must pass, each refusing with a plain reason:

1. Lead exists, `deletedAt` is null, source is not `NEWSLETTER`.
2. Lead has a phone number.
3. A WhatsApp thread with that number already exists. This is the core
   protection: existing conversations can be continued, new ones cannot be
   opened, so a typo cannot reach a stranger.
4. Sends today below `OPENWA_DAILY_SEND_CAP`, counted as `WHATSAPP_OUT`
   interactions with `metadata.via = "mcp-whatsapp"` and `occurredAt` at or
   after the most recent midnight in `Europe/Nicosia` (the operator's day, not
   UTC — the two differ by 2–3 hours and the cap should reset when his day
   does). No new table.

On success it logs a `WHATSAPP_OUT` interaction on the lead (body = the text
sent, `metadata.via = "mcp-whatsapp"`), through the same path as the admin's
WhatsApp log button.

That logging moves `nextFollowUpAt` to now + 7 or 14 days via
`applyFollowUpCadence`, and here that is **correct**: a message was genuinely
sent just now. This is the opposite of the backfill case documented in
`crm-contact-tracking-2026-07-25`, where the same mechanism silently snoozed
active leads because the cadence schedules from `Date.now()` and ignores
`occurredAt`. Do not copy a "restore the old follow-up date" workaround here.

If OpenWA reports the send succeeded but the interaction write then fails, the
tool must say the message went out and the log did not. Never report a send it
cannot confirm, and never retry a send to fix a logging failure.

## Testing

Unit tests, OpenWA stubbed — no live WhatsApp traffic in the suite:

- `toMsisdn`: `+44 7787 597514`, `447787597514` and `00447787597514` all yield
  `447787597514`; a number that cannot be reduced to digits is rejected rather
  than guessed at.
- The cap query respects `Europe/Nicosia` midnight, not UTC.
- Send guards: each of the four refusal paths, asserting nothing was sent.
- The cap boundary: the call at the limit sends, the next refuses.
- Send success writes exactly one `WHATSAPP_OUT` with `via = "mcp-whatsapp"`.
- Thread read: media becomes a marker; empty `unknown` rows are dropped.
- Send succeeded + logging failed reports both facts.

A manual end-to-end check sends one message to a lead the operator names, and
is run only with the operator watching.

## Deployment

Requires a production deploy of the main app plus four new variables in
`/var/www/shared/.env`. Per standing instruction, deployment is the operator's
decision: the work stops at "ready, tests green".

Rollout order matters — the env vars must exist before the deploy, or the first
tool call errors.

## Risks

**A wrong recipient is not recoverable.** WhatsApp's delete-for-everyone window
is minutes. Guard 3 makes a stranger unreachable, but a message can still go to
the wrong *lead* if the model picks the wrong `leadId`. The daily cap bounds the
blast radius; nothing eliminates it.

**The number is a business line.** Bulk or cold sending is what gets WhatsApp
numbers banned. The cap exists as much for that as for the CRM.

**Voice notes stay invisible.** Several active threads are conducted mostly by
voice, and those reads will look emptier than the relationship really is.
