# Partner Portal Phase 3e (Telegram bot, match alerts, partner-branded presentations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three things for partners:
- Partners can connect a Telegram bot and choose email, Telegram or both for their notifications. They can ask the bot for status and commissions.
- They get match alerts when a new unit or a price drop fits one of their clients.
- They can send their clients a presentation branded with their own name and logo, with no CVE contact data, and see when it is opened.

**Architecture:**
- **Telegram:** a separate partner bot (env `PARTNER_TELEGRAM_BOT_TOKEN`, never the office bot). The webhook route on the main host is guarded by Telegram's secret-token header. Accounts are linked through a one-time code generated in the portal (deep link `t.me/<bot>?start=<code>`).
- **Channels:** the existing outbox sender (`notifySend.ts`) delivers each row to the partner's chosen channel(s).
- **Match alerts:** a daily cron over the existing `inventoryChanges()` engine (published / new units / price changes) plus a pure planner that matches changes against each effectively active claim's budget and interest. Results go to new outbox kinds.
- **Branded presentations:** these reuse `ClientPresentation` with a nullable `partnerId`. The public page `/c/[token]` switches to partner branding when it is set. Presentations always belong to a lead the partner holds (an ACTIVE claim), so enquiries and views are attributed to that partner automatically.

**Tech Stack:** Next.js 14.2, Prisma 5.22 (additive migration), Telegram Bot API over fetch, node:test via tsx.

**Spec:** `docs/superpowers/specs/2026-10-17-crm-v2-partner-portal-design.md` §9 #1 (Telegram bot), #3 (match alerts), #6 (branded presentations), #8 (onboarding: Telegram + presentation steps), §7 security.

## Global Constraints

- The local `.env.local` DATABASE_URL is the LIVE production DB. Never run migrate/db push/next build/next dev or anything connecting to a DB. Use `prisma generate`/`validate` with the dummy URL. The controller verifies the additive migration on PGlite.
- Never call cron routes or the Telegram API from tests or scripts. Never send email or Telegram.
- No `src/app/admin` changes. **The old CRM's presentation flows must behave exactly as before for presentations without a partnerId.**
- Partner copy en/de/pl/ru (DE Sie / PL Państwo / RU Вы, never Hebrew). CRM and office texts in English. CI styles throughout.
- Isolation:
  - A partner reaches only presentations, claims and alerts for their own effectively ACTIVE claims (`claimState.ts` rule).
  - The bot answers only the linked partner's own data.
  - Telegram chat ids and link codes are never shown to other partners.
  - Bot replies never include other partners' data, ourCommission or ourRate (unless trust mode, and even then commissions only).
- Telegram security:
  - The webhook requires header `X-Telegram-Bot-Api-Secret-Token` to equal env `PARTNER_TELEGRAM_WEBHOOK_SECRET` (constant-time compare). Anything else returns 401.
  - Link codes: 10 characters from an unambiguous alphabet (~50 bit), stored hashed, single-use, valid 30 min, chat rate-limited — impractical to guess.
  - One chat per partner; `/stop` unlinks.
  - All outgoing texts are HTML-escaped (parse_mode HTML).
- Tests `npm test`; `npx tsc --noEmit` 0; `npm run lint` 0. Explicit-path commits, never `git add -A`, don't push, don't deploy.

## Decisions

1. **Schema (additive):**
   - Partner:
     - `notifyChannel PartnerNotifyChannel @default(EMAIL)` with enum EMAIL | TELEGRAM | BOTH;
     - `telegramChatId String? @unique`, `telegramLinkedAt DateTime?`;
     - brand fields `brandName String?`, `brandPhone String?`, `brandEmail String?`, `brandWebsite String?`, `brandLogo Bytes?`, `brandLogoType String?`, `brandLogoUpdatedAt DateTime?`.
   - New `PartnerTelegramCode { id, partnerId, codeHash @unique, expiresAt, usedAt?, createdAt }`.
   - ClientPresentation: `partnerId String?` (relation, onDelete SetNull, `@@index([partnerId])`).
   - Enum values `MATCH` and `PRESENTATION_OPENED` added to `PartnerNotificationKind`.
2. **Channel routing:**
   - Every outbox kind goes to the channels selected by `notifyChannel`. TELEGRAM or BOTH requires a linked chat; without one, the row falls back to email.
   - `emailNotifications=false` still suppresses STAGE/MESSAGE email (3d rule) but not Telegram.
   - A row counts as sent when at least one chosen channel succeeded. Errors are recorded per channel in `error`.
   - Pure `routeNotification({ kind, notifyChannel, chatLinked, emailNotifications })` → `{ email: boolean; telegram: boolean }`.
3. **Bot:**
   - Commands:
     - `/start <code>` links (or says the code is invalid/expired, neutral);
     - `/status` lists up to 10 effectively active clients (submission name, stage);
     - `/commission` shows totals per stage, plus the latest payout with its credit-note number;
     - `/help`;
     - `/stop` unlinks.
   - Unknown text gets a short help reply. Replies come in the partner's language.
   - Unlinked chats get a neutral "connect from your partner portal" reply in English plus the partner's portal URL.
   - **Client submission via chat is out of scope** (a later phase). `/help` points to the portal's Submit page.
   - Rate limit: 30 messages per chat per 10 minutes (in-memory). Over-limit messages are ignored.
4. **Portal Telegram card** (profile, settings section):
   - "Connect Telegram" creates a code and shows the deep link `https://t.me/<PARTNER_TELEGRAM_BOT_USERNAME>?start=<code>` plus the code (valid 30 min).
   - Shows the linked state with date and a "Disconnect" button.
   - Channel radio: Email / Telegram / Both (Telegram options disabled until linked).
   - If the env vars are missing, the card says Telegram is not available yet.
5. **CRM:** on /crm/partners, a "Telegram bot" panel for owners only:
   - status from `getWebhookInfo`, loaded on demand by a button;
   - "Register webhook" calls `setWebhook` with `url = https://cyprusvipestates.com/api/webhooks/partner-telegram`, the secret, and `allowed_updates=["message"]`;
   - audited;
   - each partner row shows "Telegram linked".
6. **Match alerts:**
   - **Schedule:** daily cron `/api/cron/partner-match` at 06:00 Cyprus (`0 4 * * *` UTC). Env `PARTNER_MATCH_START` is required.
   - **Changes:** `inventoryChanges` for the last 24 h, types `published`, `new_units`, `price_from_changed` (decrease only), `unit_price_changed` (decrease only), `back_on_market`.
   - **Candidates:** effectively ACTIVE claims whose lead has a budget (budgetMin or budgetMax) and is not CLOSED or LOST.
   - **Match rule** (pure `planMatchAlerts`):
     - the change's price (unit price, or priceFrom for development-level events) lies within the lead budget (±10 % tolerance on the max);
     - AND either the development is one of the claim's submitted projects, or it is in the same district/town as one of them (via `locationMatch`);
     - with no submitted projects, budget plus the lead's `projectInterest` development's location is used; with neither, no alert.
   - **Delivery:**
     - Max 3 alerts per claim per day.
     - Outbox row kind MATCH, `refKey match:<claimId>:<developmentId>:<YYYY-MM-DD Cyprus>`, payload with the project name, change type, the new price from, and the public URL.
     - The lead owner (staff) gets one English email per day listing that day's alerts for their leads (separate simple sender in the same cron, idempotent through a `SYSTEM` LeadInteraction "Match alert sent" with metadata, mark-after-send like crm-sla).
7. **Branded presentations:**
   - **Brand settings** (profile section "Your branding"):
     - display name (default company or name), phone, email, website (https only), logo upload;
     - logo: PNG/JPEG/WebP, ≤ 300 KB, magic-byte check; dimensions are not checked on the server, the page displays max 160×60.
     - Stored as `brandLogo` bytes and served by `src/app/c/[token]/logo/route.ts` (only for partner presentations; `Cache-Control: public, max-age=86400`; `Content-Type` from `brandLogoType`).
   - **Creating** (`/presentations` page: list of the partner's presentations with views/opened; "New presentation" form):
     - client = one of the partner's effectively ACTIVE claims; projects = multi-select from `myProjects` (max 12; all available units);
     - greeting name (default submission first name), personal note (≤ 600), language (en/de/pl/ru), expiry 30 days.
     - Creates `ClientPresentation { leadId: claim.leadId, partnerId, advisorId: null, token: existing generator, criteria: { budgetMin, budgetMax } from lead }` + items.
     - Partners can revoke their own presentations.
   - **Public page `/c/[token]` when partnerId is set:**
     - partner logo/name in the hero instead of CVE branding, and a closing section with the partner's brand contact (phone/WhatsApp from brandPhone, email, website);
     - NO CVE advisor block, NO CVE WhatsApp number, NO CVE contact data;
     - the footer reads "Presented by {brandName}".
     - The page stays noindex. Everything else (properties, map, overlay, favorites, view tracking) is unchanged.
     - Presentations without a partnerId render exactly as today.
   - **Opened notification:** on the first page-level view (existing `/api/c/[token]/view` route), the outbox gets a PRESENTATION_OPENED row (`refKey presopen:<presentationId>`), payload { clientName }. The partner client detail shows the views count, last opened time and favorites.
8. **Onboarding:** add steps "Telegram connected" (optional, counts once linked) and "First presentation sent". Total steps adapt.

## Tasks

### Task 1: Migration
- [ ] Schema per Decision 1. SQL file `prisma/migrations/20261019140000_partner_telegram_matches_presentations/migration.sql`, with the `ALTER TYPE … ADD VALUE` statements first and not used in the same file.
- [ ] Validate and generate; run tsc and npm test (add the new kinds to the notify unions as no-op handled cases if tsc requires; real handling comes in Tasks 3/4/5); commit.
- [ ] The controller runs the PGlite check.

### Task 2: Pure logic + dictionary
- [ ] `src/lib/partner/telegram.ts`: `parseBotCommand(text)`, `newLinkCode()` (+hash), `routeNotification(...)`, `buildBotReply(locale, kind, data)` for status/commission/help/link results, `buildTelegramNotification(locale, row)` for every outbox kind (escaped HTML, short, with portal link), `chatRateLimit`.
- [ ] `src/lib/partner/matchAlerts.ts`: `planMatchAlerts({ claims, changes, today })`.
- [ ] `src/lib/partner/brand.ts`: `validateBrand(raw)`, `sniffImageType(bytes)`.
- [ ] `src/lib/partner/presentationDraft.ts`: `validatePresentationDraft(raw, allowedProjectIds, allowedClaimIds)`.
- [ ] Dictionary for bot replies, the Telegram card, channel choice, branding, presentations, match email/Telegram texts, onboarding steps, all 4 locales.
- [ ] Tests for everything, including escaping, command parsing edge cases, routing matrix, match rule boundaries (tolerance, decrease-only, location fallback, cap 3), logo sniffing, and draft validation (foreign claim/project rejected).

### Task 3: Telegram integration
- [ ] `src/lib/partner/telegramApi.ts`: `sendPartnerTelegram(chatId, html)`, `setPartnerWebhook()`, `getPartnerWebhookInfo()` (fetch, 10 s timeout, token from env, never logged).
- [ ] Webhook route `src/app/api/webhooks/partner-telegram/route.ts` per Decision 3 + security rules. Always answers 200 to Telegram after auth (errors logged without message bodies).
- [ ] Portal Telegram card + actions (create code, disconnect, channel); CRM owner panel (Decision 5).
- [ ] The outbox sender delivers via `routeNotification`. Onboarding Telegram step.
- [ ] Tests for pure parts and route auth (constant-time compare helper).

### Task 4: Match alerts cron
- [ ] `src/lib/partner/matchSend.ts` + `src/app/api/cron/partner-match/route.ts` per Decision 6 (lock, START gate, bounded: 2000 claims, 500 changes). Outbox MATCH rows. Owner digest email (English) with idempotency.
- [ ] The sender handles MATCH and PRESENTATION_OPENED: email builders (4 locales) + Telegram builders.
- [ ] Tests for the planning glue.

### Task 5: Branded presentations
- [ ] Brand settings (profile) + logo upload action (size/type checks, own row).
- [ ] `/presentations` list + create + revoke.
- [ ] `/c/[token]` partner branding switch + logo route.
- [ ] PRESENTATION_OPENED producer in the view route.
- [ ] Client detail shows presentation stats. Onboarding presentation step.
- [ ] Regression test: rendering decisions for a non-partner presentation are unchanged. Extract a pure `presentationBranding(presentation)` → `{ mode: "cve" | "partner", … }` and test both.

### Task 6: Wrap-up
- [ ] Full checks, PGlite check, demo smoke:
  - Telegram: route auth only; no real API calls.
  - A presentation created and rendered with partner branding (the HTML contains the partner's name and not the CVE WhatsApp number).
  - Match planner on demo data via a node script.
- [ ] Final whole-branch review, fix wave, push.
- [ ] Hand-over:
  - env `PARTNER_TELEGRAM_BOT_TOKEN`, `PARTNER_TELEGRAM_BOT_USERNAME`, `PARTNER_TELEGRAM_WEBHOOK_SECRET`, `PARTNER_MATCH_START`;
  - crontab `0 4 * * *` partner-match;
  - "Register webhook" in the CRM after deploy;
  - `CVP_RUN_MIGRATE=1`.
