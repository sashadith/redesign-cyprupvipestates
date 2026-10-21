# Partner Portal Phase 3a (Accounts, Registration, Approval, Portal shell) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Partners can register at `partner.cyprusvipestates.com`, accept the partner agreement, verify their email, log in, and wait for approval; the operator approves, suspends and configures partners in the new CRM. This is the account foundation for client submission (3b) and payouts (3c).

**Architecture:** One Next.js app. Requests whose host is the partner host are rewritten by the middleware into an internal route segment `src/app/partner-portal/` (own `<html>` layout); that segment is unreachable on the main host. Partner auth is completely separate from staff NextAuth: own tables, bcrypt passwords, a random session token stored hashed in `PartnerSession`, an httpOnly `__Host-`-style cookie. Every partner data read goes through one scope module. The portal UI is localized (en/de/pl/ru) with a small typed dictionary; the CRM screen is English.

**Tech Stack:** Next.js 14.2 App Router, Prisma 5.22 (additive migration), bcryptjs, Node `crypto`, nodemailer via `src/lib/sendEmail.ts`, node:test via tsx.

**Spec:** `docs/superpowers/specs/2026-10-17-crm-v2-partner-portal-design.md` (§2 registration/agreement/visibility, §3 rules 4–5, §4 Partner/PartnerUser/PartnerAgreementAcceptance, §6.2 public + pending + profile basics, §7 security).

## Global Constraints

- The local `.env.local` DATABASE_URL is the LIVE production database. Never run `prisma migrate dev/reset/deploy`, `db push`, `next build`, `next dev`, or anything that connects to a DB. `npx prisma generate`/`validate` only with `DATABASE_URL=postgresql://x:x@localhost:1/x`. The migration is hand-written SQL; the controller verifies it on a throwaway PGlite database.
- Schema changes are **additive only**.
- No existing file under `src/app/admin/` may change.
- Partner-facing copy is localized **en/de/pl/ru** (never Hebrew); CRM copy is English.
- **Isolation:** partner sessions are never staff sessions and vice versa; no partner page or action may import `src/auth.ts`; every partner query filters by the session's `partnerId`; passwords are never emailed (activation/verify/reset mails contain single-use links only); tokens are stored hashed (SHA-256), never in plain text.
- Login and registration are rate-limited; error messages never reveal whether an email is registered.
- Visual direction: Limestone tokens (reuse `src/app/crm/crm.css` variables via a portal stylesheet that imports nothing from `/crm` routes — copy the token block), calmer and simpler than the CRM; responsive to 375 px.
- Tests: `npm test`, no DB. `npx tsc --noEmit` 0 errors. `npm run lint` exit 0. Commit with explicit paths; never `git add -A`. Do not push. Do not deploy.

## Decisions taken while planning

1. **Partner host** = env `PARTNER_HOST` (prod: `partner.cyprusvipestates.com`); additionally any host starting with `partner.localhost` counts in development. Middleware: partner host → rewrite `/x` to `/partner-portal/x` (static assets are already excluded by the matcher); main host + path starting `/partner-portal` → rewrite to the gated 404 (`/_gated-locale-404`, same trick as the Hebrew gate). DNS, TLS and nginx for the subdomain are an operator task, documented in the hand-over.
2. **Session:** `PartnerSession { id, partnerUserId, tokenHash, createdAt, expiresAt (30 d), lastSeenAt, revokedAt }`; cookie `cve_partner` (httpOnly, Secure in prod, SameSite=Lax, path `/`, host-only). Suspending a partner revokes all its sessions.
3. **Tokens:** `PartnerToken { id, partnerUserId, kind: VERIFY_EMAIL | RESET_PASSWORD, tokenHash, expiresAt, usedAt }` — verify 48 h, reset 1 h, single use.
4. **Agreement:** version constant `PARTNER_AGREEMENT_VERSION = "2026-10-draft"`; the text lives in `src/lib/partner/agreement/{en,de,pl,ru}.md`-style TS strings, rendered on `/agreement` (public) and linked from the registration form. The draft text is clearly marked "Draft — to be replaced by the final agreement"; the operator/lawyer supplies the final text before launch (hand-over item). Acceptance stores version, timestamp and IP (`x-forwarded-for` first hop, else `x-real-ip`).
5. **Registration fields:** first/last name, company (optional), country (ISO-2 select), phone, email, language (en/de/pl/ru), partner type (`REAL_ESTATE`, `PRIVATE_BROKER`, `BANK`, `INVESTMENT`, `FAMILY_OFFICE`, `TOURISM`, `DESIGN`, `LEGAL`, `OTHER` — no lead generators, per the agreement), password (≥ 10 chars, not all digits), agreement checkbox. Status starts `PENDING`; verifying the email does not approve.
6. **Approval** in CRM `/crm/partners` (managers only): Approve (status ACTIVE, approvedAt, approvedById, generates `refCode` if missing, sends a localized "You're approved" email with a login link), Suspend (status SUSPENDED, revoke sessions), Reactivate, and edit `handoverShare` (default 30), `fixShare` (default 50), `trustMode`, `managerUserId`. Every change audited via `writeAudit`. A Telegram notice to the office on each new verified registration ("New partner registration: {company/name}, {country} → /crm/partners").
7. **Existing `/partners` applicants** (old CRM `LeadSource.PARTNER` bucket) are not migrated in 3a; the public `/partners` page link to the portal is a later content change.
8. **Portal pages in 3a:** `/` (public landing: programme, 3 steps, CTA; logged-in users are redirected to `/home`), `/register`, `/verify?token=…`, `/login`, `/logout` (POST action), `/forgot`, `/reset?token=…`, `/agreement`, `/home` (pending: "We're reviewing your registration"; active: welcome + personal ref link + manager card; suspended: neutral message), `/profile` (name, company, phone shown, language switch, password change). Client submission and lists come in 3b.

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma`, `prisma/migrations/20261019100000_partner_portal_accounts/migration.sql` | Partner models + Lead partner fields |
| `src/lib/partner/host.ts` | Pure: `isPartnerHost(host, env)` |
| `src/middleware.ts` | Partner-host rewrite + main-host block (top of the function) |
| `src/lib/partner/password.ts` | Pure: password policy; bcrypt hash/verify wrappers |
| `src/lib/partner/tokens.ts` | Pure: random token + SHA-256 hash; expiry helpers |
| `src/lib/partner/throttle.ts` | Pure in-memory limiter (per key) |
| `src/lib/partner/session.ts` | Server: create/read/revoke session, `getPartner()`, `requirePartner()` |
| `src/lib/partner/i18n/{index,en,de,pl,ru}.ts` | Typed dictionary + `pickPartnerLocale()` |
| `src/lib/partner/registration.ts` | Pure: `validateRegistration()` |
| `src/lib/partner/mail.ts` | Localized verify / reset / approved emails (text + simple HTML) |
| `src/lib/partner/agreement.ts` | Version constant + draft texts |
| `src/app/partner-portal/**` | Portal layout, pages, actions |
| `src/app/crm/partners/{page.tsx,actions.ts}`, `src/app/crm/components/PartnersTable.tsx`, `Shell.tsx` (nav "Partners" for managers) | CRM partner management |
| Tests: `partnerHost`, `partnerPassword`, `partnerTokens`, `partnerThrottle`, `partnerI18n`, `partnerRegistration`, `partnerMiddleware` | Pure tests |

---

### Task 1: Schema and migration

**Files:** Modify `prisma/schema.prisma`; create `prisma/migrations/20261019100000_partner_portal_accounts/migration.sql`.

**Interfaces (Prisma):**
```prisma
enum PartnerStatus { PENDING ACTIVE SUSPENDED }
enum PartnerType { REAL_ESTATE PRIVATE_BROKER BANK INVESTMENT FAMILY_OFFICE TOURISM DESIGN LEGAL OTHER }
enum PartnerTokenKind { VERIFY_EMAIL RESET_PASSWORD }
enum PartnerMode { HANDOVER FIX }
enum ContactMode { DIRECT VIA_PARTNER VIA_PARTNER_REP VIA_CLIENT_REP }
enum PartnerClaimState { ACTIVE IN_REVIEW REJECTED EXPIRED }

model Partner {
  id             String        @id @default(uuid())
  status         PartnerStatus @default(PENDING)
  type           PartnerType
  firstName      String
  lastName       String
  company        String?
  country        String        // ISO 3166-1 alpha-2
  phone          String
  language       Locale        @default(en)
  handoverShare  Decimal       @default(30) @db.Decimal(5, 2)
  fixShare       Decimal       @default(50) @db.Decimal(5, 2)
  trustMode      Boolean       @default(false)
  refCode        String?       @unique
  managerUserId  String?
  manager        User?         @relation("PartnerManager", fields: [managerUserId], references: [id], onDelete: SetNull)
  approvedAt     DateTime?
  approvedById   String?
  suspendedAt    DateTime?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  users          PartnerUser[]
  acceptances    PartnerAgreementAcceptance[]
  leads          Lead[]
  claims         PartnerClaim[]
  @@index([status])
  @@map("partners")
}

model PartnerUser {
  id              String         @id @default(uuid())
  partnerId       String
  partner         Partner        @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  email           String         @unique   // stored lower-cased
  passwordHash    String
  emailVerifiedAt DateTime?
  lastLoginAt     DateTime?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  sessions        PartnerSession[]
  tokens          PartnerToken[]
  @@map("partner_users")
}

model PartnerSession {
  id            String      @id @default(uuid())
  partnerUserId String
  partnerUser   PartnerUser @relation(fields: [partnerUserId], references: [id], onDelete: Cascade)
  tokenHash     String      @unique
  createdAt     DateTime    @default(now())
  expiresAt     DateTime
  lastSeenAt    DateTime    @default(now())
  revokedAt     DateTime?
  @@index([partnerUserId])
  @@map("partner_sessions")
}

model PartnerToken {
  id            String           @id @default(uuid())
  partnerUserId String
  partnerUser   PartnerUser      @relation(fields: [partnerUserId], references: [id], onDelete: Cascade)
  kind          PartnerTokenKind
  tokenHash     String           @unique
  expiresAt     DateTime
  usedAt        DateTime?
  createdAt     DateTime         @default(now())
  @@index([partnerUserId, kind])
  @@map("partner_tokens")
}

model PartnerAgreementAcceptance {
  id         String   @id @default(uuid())
  partnerId  String
  partner    Partner  @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  version    String
  acceptedAt DateTime @default(now())
  ip         String?
  @@index([partnerId])
  @@map("partner_agreement_acceptances")
}

model PartnerClaim {
  id          String            @id @default(uuid())
  leadId      String
  lead        Lead              @relation(fields: [leadId], references: [id], onDelete: Cascade)
  partnerId   String
  partner     Partner           @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  state       PartnerClaimState
  createdAt   DateTime          @default(now())
  reviewedAt  DateTime?
  reviewedById String?
  @@index([leadId])
  @@index([partnerId, state])
  @@map("partner_claims")
}
```
`Lead` gains: `partnerId String?` + relation `partner Partner?` (onDelete SetNull), `partnerMode PartnerMode?`, `contactMode ContactMode?`, `contactRepName String?`, `contactRepPhone String?`, `claims PartnerClaim[]`, `@@index([partnerId])`. `User` gains `managedPartners Partner[] @relation("PartnerManager")`.

- [ ] **Step 1:** Add the enums and models above (with the Lead/User back-relations) to `schema.prisma`; keep existing formatting untouched (do not run `prisma format` over unrelated models).
- [ ] **Step 2:** Write the migration SQL by hand: `CREATE TYPE` for each enum; `CREATE TABLE` for each model with Prisma's naming (`<table>_pkey`, `<table>_<col>_key`, `<table>_<cols>_idx`, `<table>_<col>_fkey`), FK actions exactly as in the models (`ON DELETE CASCADE|SET NULL ON UPDATE CASCADE`); `ALTER TABLE "leads" ADD COLUMN …` for the five new columns + index + FK; `Decimal(5,2)` defaults `30`/`50`; `Locale` default `'en'`. Header comment: additive only; written only by code shipping in the same deploy.
- [ ] **Step 3:** `DATABASE_URL=postgresql://x:x@localhost:1/x npx prisma validate && … npx prisma generate`; `npx tsc --noEmit`; `npm test`.
- [ ] **Step 4:** Commit `"Partner portal: accounts, sessions, tokens, agreement acceptances, claims; lead partner fields (additive)"`. The controller then applies all migrations to a throwaway PGlite DB and runs `prisma migrate diff --from-url <pglite> --to-schema-datamodel` (must be empty).

---

### Task 2: Pure building blocks — host, password, tokens, throttle, registration validation, i18n

**Files:** Create `src/lib/partner/{host,password,tokens,throttle,registration}.ts`, `src/lib/partner/i18n/{index,en,de,pl,ru}.ts`; tests `src/lib/__tests__/partner{Host,Password,Tokens,Throttle,Registration,I18n}.test.ts`.

**Interfaces:**
- `isPartnerHost(host: string | null, env: { PARTNER_HOST?: string; NODE_ENV?: string }): boolean` — strips port, case-insensitive; true when equal to `PARTNER_HOST`, or when `NODE_ENV !== "production"` and the host is `partner.localhost`.
- `passwordProblem(pw: string): "too_short" | "digits_only" | "too_long" | null` (10–200 chars); `hashPassword(pw): Promise<string>` (bcrypt cost 12); `verifyPassword(pw, hash): Promise<boolean>`.
- `newToken(): { token: string; hash: string }` (32 random bytes base64url; hash = SHA-256 hex); `hashToken(token: string): string`; `addHours(d: Date, h: number): Date`.
- `makeThrottle(max: number, windowMs: number): { hit(key: string, now?: number): boolean /* true = allowed */; reset(key: string): void }` — refused calls don't extend the window.
- `validateRegistration(raw: unknown): { ok: true; data: RegistrationInput } | { ok: false; field: string; code: string }` — fields per decision 5; email lower-cased/trimmed and simple-checked; phone 6–20 digits; country = two uppercase letters; language ∈ en/de/pl/ru; type ∈ PartnerType; `acceptAgreement === true` required; unknown keys rejected; `code` is a dictionary key (e.g. `"err.email"`), never an English sentence.
- i18n: `type PartnerLocale = "en" | "de" | "pl" | "ru"`; `PARTNER_LOCALES`; `dict(locale): PartnerDict` (all four files export the same `PartnerDict` shape — TypeScript enforces completeness); `pickPartnerLocale({ cookie?: string | null; acceptLanguage?: string | null; partnerLanguage?: string | null }): PartnerLocale` — priority partner setting > cookie `cve_partner_lang` > Accept-Language best match > `en`.

- [ ] **Step 1: Failing tests** covering: host (prod host with port, uppercase, dev `partner.localhost:3000`, `partner.localhost` rejected in production, main host false, null false); password policy edges and that `verifyPassword` accepts its own hash and rejects another password; token hash is 64 hex chars, deterministic for the same token, different tokens differ; throttle allows `max` then blocks within window, resets after window, refused calls don't extend; registration happy path + each failure code + unknown key + Hebrew rejected + agreement unchecked; `pickPartnerLocale` priority order and `de-CH,de;q=0.9` → `de`, `he` → `en`; every dictionary has the same keys (compare `Object.keys` deeply for all four).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. The dictionary covers every string used in 3a pages and emails (landing, register, verify, login, forgot/reset, agreement page chrome, pending/active/suspended home, profile, nav, footer, all error codes, email subjects/bodies). Write natural, polite partner-facing copy: EN; DE in formal "Sie"; PL formal "Pan/Pani"-neutral ("Państwo"); RU formal "Вы". **Step 4:** Run → PASS.
- [ ] **Step 5:** `npm test && npx tsc --noEmit && npm run lint`; commit `"Partner portal: host detection, password policy, tokens, throttle, registration validation, 4-language dictionary"`.

---

### Task 3: Middleware routing, partner session, portal shell

**Files:** Modify `src/middleware.ts` (top of the default function only); create `src/lib/partner/session.ts`, `src/app/partner-portal/layout.tsx`, `src/app/partner-portal/portal.css`, `src/app/partner-portal/components/PortalShell.tsx`; test `src/lib/__tests__/partnerMiddleware.test.ts` (pure helper `partnerRewritePath(host, pathname, env): string | null | "block"` exported from `src/lib/partner/host.ts`).

**Interfaces:**
- `partnerRewritePath(host, pathname, env)`: partner host → `"/partner-portal" + (pathname === "/" ? "" : pathname)` (unless the path already starts with `/partner-portal`, which on the partner host is blocked to avoid double prefixes); main host + path starts with `/partner-portal` → `"block"`; else `null`.
- `session.ts` (server only): `createPartnerSession(partnerUserId): Promise<void>` (sets cookie), `getPartner(): Promise<{ user: { id; email }; partner: { id; status; firstName; lastName; company; language; refCode; managerUserId } } | null>` (valid, unexpired, unrevoked session; updates `lastSeenAt` at most every 5 min), `requirePartner(opts?: { active?: boolean }): Promise<…>` (redirects to `/login`, or to `/home` when `active` required but status ≠ ACTIVE), `revokeCurrentSession()`, `revokeAllSessionsForPartner(partnerId)`.
- Layout: own `<html lang={locale}>`, `robots: noindex`, Limestone tokens in `portal.css`; `PortalShell` with logo "Cyprus VIP Estates · Partner", language switcher (sets cookie via a server action), and — when logged in — nav Home, Profile, Log out.

- [ ] **Step 1: Failing test** for `partnerRewritePath` (root, nested, query untouched by design — middleware keeps `search`, main-host block, double-prefix block, non-partner path null).
- [ ] **Step 2–4:** implement helper → PASS; wire middleware: at the very top of `middleware()`, compute `partnerRewritePath(request.headers.get("host"), request.nextUrl.pathname, process.env)`; `"block"` → rewrite to `/_gated-locale-404`; string → `NextResponse.rewrite(url with that pathname)`; and `return` before any locale logic. The matcher already excludes `_next`, `api`, assets.
- [ ] **Step 5:** session.ts + layout + shell; `npm test && npx tsc --noEmit && npm run lint`; commit `"Partner portal: host routing, separate partner sessions, portal shell"`.

---

### Task 4: Registration, verification, login, password reset, agreement, home, profile

**Files:** Create `src/lib/partner/mail.ts`, `src/lib/partner/agreement.ts`, `src/app/partner-portal/{page.tsx,register/page.tsx,verify/page.tsx,login/page.tsx,forgot/page.tsx,reset/page.tsx,agreement/page.tsx,home/page.tsx,profile/page.tsx,actions.ts}` and small client form components under `src/app/partner-portal/components/`.

**Interfaces (`actions.ts`, `"use server"`):** `registerAction(raw)`, `loginAction(raw)`, `logoutAction()`, `forgotAction(raw)`, `resetAction(raw)`, `setLanguageAction(locale)`, `changePasswordAction(raw)`, `updateProfileAction(raw)` (first/last name, company, language only — phone and type are locked, per spec). All return `{ ok: true } | { error: dictKey, field?: string }`.

Behaviour:
- **register:** throttle per IP (5/h) and per email (3/h); `validateRegistration`; if the email exists → respond exactly like success ("Check your inbox") but send nothing new (no enumeration); else create Partner (PENDING) + PartnerUser + acceptance (version, IP) in one transaction, create VERIFY_EMAIL token, send the localized verify email (`sendEmail({ to, subject, text, html })`, link `https://${PARTNER_HOST}/verify?token=…`; in dev `http://partner.localhost:3000`).
- **verify:** valid unused unexpired token → set `emailVerifiedAt`, mark used, send the office Telegram notice (decision 6), create a session, redirect to `/home`. Invalid → localized message + "send a new link" form (rate-limited).
- **login:** throttle per email (5 per 15 min) and per IP (20 per 15 min); generic error on any failure; unverified email → error `err.verify_first` with a resend button; SUSPENDED → generic error; success → session + `lastLoginAt`.
- **forgot/reset:** always "If this email is registered, we've sent a link"; reset token 1 h single-use; on success revoke all sessions of that user and log in fresh.
- **home:** PENDING → review message (+ "We usually reply within 24 hours"); ACTIVE → welcome, personal ref link `https://cyprusvipestates.com/?ref=<refCode>` with copy button, manager card (name, phone, email of `managerUserId`, else the office contact from env `PARTNER_OFFICE_EMAIL`/`PARTNER_OFFICE_PHONE` if set); SUSPENDED → neutral message with office contact.
- **agreement:** renders the current version's text in the visitor's language with the version label; registration links to it (opens in a new tab).
- Emails: plain text + minimal HTML, from the existing SMTP sender, localized subject/body, no tracking.

- [ ] **Step 1:** Write `mail.ts` builders as pure functions (`buildVerifyEmail(locale, link)`, `buildResetEmail`, `buildApprovedEmail(locale, name, loginLink)`) with tests (subject per locale, link present, no password, HTML-escaped name).
- [ ] **Step 2–n:** implement pages/actions per behaviour; server actions re-check throttles and never trust client state.
- [ ] **Final:** `npm test && npx tsc --noEmit && npm run lint`; commit `"Partner portal: registration with agreement, email verification, login, reset, home, profile"`.

---

### Task 5: CRM partner management `/crm/partners`

**Files:** Create `src/app/crm/partners/page.tsx`, `src/app/crm/partners/actions.ts`, `src/app/crm/components/PartnersTable.tsx`, `src/lib/partner/refCode.ts` (+ test); modify `src/app/crm/components/Shell.tsx` (nav "Partners" for managers, after Inbox).

**Interfaces:**
- `newRefCode(seed: { company?: string | null; lastName: string }, random: () => string): string` — lower-case slug of company or last name (≤ 16 chars, a–z0–9-) + "-" + 4 random base36 chars; caller retries on unique collision (max 5).
- Actions (all `requireCrmUser` + `canAssignLeads`, audited): `approvePartnerAction(id)`, `suspendPartnerAction(id)` (revokes sessions), `reactivatePartnerAction(id)`, `updatePartnerTermsAction(id, raw)` (handoverShare/fixShare via `parseRate` from `src/lib/crm/rateForm.ts`, trustMode boolean, managerUserId active user or null).
- Page: tabs "Pending" (verified first, then unverified, oldest first), "Active", "Suspended"; row shows name, company, type, country, language, email (+ verified badge), registered date, agreement version; expandable terms editor; Approve sends the approved email (localized) and shows a toast with the notification result.

- [ ] **Step 1:** Failing test for `newRefCode` (slugging, umlauts/Cyrillic → transliterate to ASCII or fall back to last name, length cap, suffix format). **Step 2–4:** implement → PASS.
- [ ] **Step 5:** actions + page + table; approval refuses unverified partners (`"Email not verified yet"`); `npm test && npx tsc --noEmit && npm run lint`; commit `"CRM v2: partner management — approve, suspend, terms, manager, ref code (audited)"`.

---

### Task 6: Phase 3a wrap-up

- [ ] `npm test && npx tsc --noEmit && npm run lint`; nothing under `src/app/admin` changed.
- [ ] Controller: PGlite migration check (all migrations apply, `migrate diff` empty).
- [ ] Final whole-branch review (most capable model) with special attention to isolation (partner ↔ staff), enumeration, token handling, middleware side effects on the main site; one fix wave; scoped re-review; push.
- [ ] Hand-over: env `PARTNER_HOST`, optional `PARTNER_OFFICE_EMAIL/PHONE`; DNS A record + TLS + nginx server block for the subdomain (operator); final agreement text needed before launch; deploy with `CVP_RUN_MIGRATE=1`; demo-DB preview offer.
