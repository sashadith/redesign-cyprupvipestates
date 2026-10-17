# CRM v2 + Partner Portal — Design

Date: 2026-10-17 · Status: approved by operator 2026-10-17 (incl. section 10 additions)
Owner: Sascha (operator) · Built on: origin/main 2f7bf063

## 1. Goal

Replace the current admin CRM with a fast, team-capable, mobile-friendly CRM that looks
and feels premium, and add a partner portal where external partners register, submit
clients, follow them through the pipeline and see their commission.

The operator is dissatisfied with the current CRM on every axis: dated look, too many
clicks, no overview, no multi-employee model, poor on mobile.

Non-goals: replacing lead intake channels (Meta, web forms, IMAP, WhatsApp, MCP) — they
stay as they are and feed the new CRM. No partner-recruits-partner bonus. No webinars.
No multi-currency (EUR only). Broker tours for our own agents are a possible later CRM
module, not part of this scope. Hebrew is out of scope for the portal (see memory rule).

## 2. Decisions taken (brainstorming log)

| Topic | Decision |
|---|---|
| Lead distribution | All leads (every source) land in an **Unassigned inbox**; the system **suggests** an owner; operator/admin clicks Assign; owner is notified (Telegram + email). |
| Team size | Up to 10 employees within a year. |
| Visibility | An employee sees **only own leads** by default. Two per-employee switches: **"See colleagues' leads"** and **"Edit colleagues' leads"** (edit implies see). |
| Partner share | Default **30 % of our commission** (handover mode), overridable per partner and per deal. |
| Developer rates | Our contractual commission rate per **developer** (e.g. BBF 10 %), overridable per **project** (e.g. Eden Coast 5 %); project rate wins. |
| Rate visibility for partners | Default: partner sees **only their own effective rate** ("1.5 % of price"). Per-partner **trust mode** additionally shows our rate and their share. |
| Commission lifecycle | Four stages visible to the partner: **Expected → Earned → Developer paid → Paid out**, plus **Cancelled**. |
| Estimate before reservation | Yes — shown as "approx." based on the lead's interest project and budget. |
| Duplicates / client protection | First come first served, **operator review** when the contact is already known. Protection lasts **6 months from the last real contact** (call / email / WhatsApp), not from submission. Never reveal to a partner whether or from where we know a contact. |
| Partner registration | Free self-registration + email verification → status **Pending** → operator **approves**. Rates and submission only after approval. |
| Partner agreement | Accepted online at registration; store agreement version, timestamp, IP. |
| Partner view of a lead | Stage + curated milestone timeline (type + date, never note/email/WhatsApp content) + their CVE contact + explicit **"Message to partner"** entries. |
| Partner notifications | Email on every stage change, in the partner's language. |
| Pipeline stages | New → Contacted → In talks → Viewing → Offer → **Reserved** (new) → Sold; outside the funnel: Keep contact, Lost (mandatory reason). |
| Deals | **Multiple deals per lead**, each with its own commission. |
| Architecture | Rebuild inside the existing Next.js app, same DB. Built **in parallel** to the old CRM. |
| Addresses | Old CRM stays at `/admin/crm`; new CRM at `/crm`; portal at **`partner.cyprusvipestates.com`**. |
| Visual direction | **Limestone** (original colours): cool light grey, brand green #1B4B43 for text/structure, per-stage colours, floating action dock. Champagne/bronze accents were tried and rejected. Mockup: https://claude.ai/artifact/FAmQpy3gu5DhicwAra8J4N |
| Payout | **Credit note (Gutschrift) basis**, no partner invoice. Profile stores bank details. System generates a numbered **credit-note PDF** on "Paid out". |
| Whitewill learnings adopted | Contact mode per client, personal manager, partner type, phone/type locked, archive with reason + reopen, period filter, live report/export, materials, automatic news, rating with prizes, **Fix mode**. |
| Fix mode | Second submission path: partner works the client personally, we only register with the developer and handle the paperwork. Own default share **50 %** (configurable, overridable per partner). |
| Partner-recruits-partner | No. |

## 3. Architecture and parallel operation

| Part | Address | Auth |
|---|---|---|
| Old CRM | `/admin/crm` (unchanged) | existing NextAuth admin login |
| New CRM | `/crm` (own route group + layout) | same staff login, no second password |
| Partner portal | `partner.cyprusvipestates.com` (host-routed in middleware to a `(partner)` route group) | separate partner accounts and session |

One database, two staff UIs. Hard rules:

1. **Additive DB changes only** — new tables and nullable/defaulted columns. Nothing in use
   is renamed or dropped while the old CRM lives.
2. **`RESERVED` enum value:** schema, migration and every reader (lists, filters, status
   popover, board, action-center rules, MCP tools) ship in ONE deploy with
   `CVP_RUN_MIGRATE=1`. The migration only adds the value and the new code is its only
   writer, so no row can hold it while an older client runs. (Lessons: Hebrew enum outage
   2026-09-21 = DB ahead of the deployed client; migrate-flag outage 2026-09-17.)
3. **Central access layer** `src/lib/crm/access.ts`: one function decides which leads a
   user may see/edit; used by new CRM, exports, search, MCP tools. The old CRM does not
   know the rules → employees with restricted visibility get **no access to `/admin/crm`**;
   it stays for owner/admins during the parallel phase.
4. **Partner isolation:** separate account table, separate session cookie bound to the
   partner host, separate login. Every portal query goes through
   `src/lib/partner/scope.ts`, which hard-filters by `partnerId` and maps rows through an
   explicit field allowlist (DTO). No admin model is ever serialised to the portal directly.
5. **Unambiguous "partner":** today `LeadSource.PARTNER` + the Partner bucket mean
   *applicants* from `/partners`. These become partner **registrations**. Partner-submitted
   leads carry a real FK (`Lead.partnerId`) instead of a text label. Existing `?ref=`
   attribution can be mapped to a partner account (`Partner.refCode`) so website leads
   arriving through a partner link are attributed automatically (same duplicate review).
6. **Timeline:** new code writes only `LeadInteraction`. Legacy `LeadActivity` keeps being
   written by old-CRM paths and is consolidated in the cutover cleanup, not in Phase 1.
7. **Cutover:** when the new CRM is accepted, `/admin/crm/*` 308-redirects to `/crm`
   equivalents and the old UI is removed.

DNS/TLS/nginx for the partner subdomain and middleware host routing are part of
Phase 3 (note the middleware gotcha documented for `/book/[token]`).

## 4. Data model (additions)

- **User** (existing): add `canSeeColleagues Boolean @default(false)`,
  `canEditColleagues Boolean @default(false)`, `languages String[]`,
  `specialties String[]` (regions / project ids), `acceptsLeads Boolean @default(true)`.
  Role model: owner (`isOwner`), ADMIN, EDITOR = employee.
- **LeadStatus**: add `RESERVED`. **Lead**: add `lostReason` (enum), `partnerId?`,
  `partnerMode?` (HANDOVER | FIX), `contactMode?` (DIRECT | VIA_PARTNER |
  VIA_PARTNER_REP | VIA_CLIENT_REP) + rep name/phone. "Last real contact" is computed from
  `LeadInteraction` (CALL / EMAIL_* / WHATSAPP_*) when needed, not stored.
- **Deal**: leadId, developmentId, unit label, price, ourRate, ourCommission (overridable),
  partnerRate, partnerCommission (overridable), commissionStatus
  (EXPECTED | EARNED | DEVELOPER_PAID | PAID_OUT | CANCELLED) with a timestamp per stage,
  rateSource (PROJECT | DEVELOPER | MANUAL | MISSING).
- **CommissionRate**: developer-level default + optional project-level override
  (one default per account, one override per development). Keyed on **DeveloperAccount**:
  every Development has one, while the public Developer link is optional. Rates are
  admin-only, so the admin label is acceptable here.
- **Partner**: company, contact name, country, phone (locked after registration), email,
  language (en/de/pl/ru), partnerType, status (PENDING | ACTIVE | SUSPENDED),
  handoverShare (default 30 %), fixShare (default 50 %), trustMode, refCode,
  managerUserId, encrypted bank details (holder, IBAN, BIC, company, VAT id),
  ibanChangedAt.
- **PartnerUser**: email, password hash, emailVerifiedAt, partnerId (one login per partner
  in v1; table allows more later).
- **PartnerAgreementAcceptance**: partnerId, agreementVersion, acceptedAt, ip.
- **PartnerClaim** (client protection): leadId, partnerId, state (ACTIVE | IN_REVIEW |
  REJECTED | EXPIRED), createdAt, reviewedBy. Expiry computed from
  the last real contact + 6 months (computed).
- **PartnerMessage**: leadId, authorUserId, body, createdAt (the "Message to partner").
- **CreditNote**: partnerId, dealId, number (sequential), amount, issuedAt, pdf path.
- **Rating** (Phase 4): Season (start, end, prizes), point rules (configurable),
  PointEvent ledger.

## 5. Core flows

### 5.1 Lead distribution
1. Any intake → Unassigned inbox (`assignedToId = null`).
2. Suggestion: employees with `acceptsLeads` → language match → specialty match →
   fewest active leads. The reason is shown ("speaks RU · 9 active"). No language match →
   fall back to least loaded, flagged "no language match".
3. Assign (one click, or choose another) → Telegram + email to the owner → appears in the
   owner's Today.
4. Lead unassigned > 30 min (configurable) → reminder to operator.
5. Fix-mode partner leads skip the inbox's sales suggestion and go to the employee who
   handles developer registration.

### 5.2 Partner submits a client
1. Handover form: name, phone, email, language, budget, interest project(s) (multi, free
   text allowed), contact mode (+ rep fields), comment. Fix form: same, single project.
2. Duplicate check on email + phone (one shared implementation; consolidate
   `findDuplicateLead` and metaLeadgen's `findExistingLead`).
   - New → lead created, `partnerId` set, claim ACTIVE, inbox with partner badge.
   - Known → claim IN_REVIEW, partner sees "we are checking", operator decides
     Assign / Reject; partner learns only the outcome.
   - Two partners, same client → first wins; both visible in the review case.
3. Every stage change → milestone in portal + email in partner language.

### 5.3 Commission
1. Moving a lead/deal to Reserved opens the deal form (project, unit, price).
2. Rate lookup: project rate → developer rate → MISSING. Partner share from partner
   (handover or fix share) → per-deal override.
3. Reserved → EXPECTED; Sold → EARNED; Developer paid and Paid out set manually with date;
   Paid out generates a credit-note PDF.
4. Missing rate → deal saves, commission "rate missing", operator warned, partner sees
   "being calculated" (never a wrong number).
5. Cancellation after reservation → CANCELLED (kept, dated, visible to partner).
6. Estimate before reservation: interest project's rate × budget × partner share, labelled
   "approx.".

## 6. Screens

### 6.1 CRM (`/crm`, English UI)
1. **Today** — personal day plan: follow-ups due, viewings, overdue/stale leads, new
   assignments.
2. **Inbox** — distribution queue with suggestions; partner review cases (owner/admin).
3. **Pipeline** — drag-and-drop kanban (keyboard accessible) + list view; filters
   (everyone / mine / partner leads / stale 7d+); CLOSED/LOST/KEEP_CONTACT reachable.
4. **Lead** — cockpit: timeline, deals, property matching, presentations, booking,
   message to partner, partner + claim panel.
5. **Partners** — approvals, accounts, shares, trust mode, manager, bank details (masked).
6. **Commissions** — developer/project rates; all deals with commission stages; credit
   notes.
7. **Settings** — employees: rights switches, languages, specialties, accepts-leads.

Design system: Limestone tokens (cool light grey ground, white panels, brand green ink,
seven stage colours used identically everywhere), Bricolage Grotesque display, Hanken
Grotesk body, tabular numerals, floating action dock (search, new lead, today, export)
that becomes a bottom bar on phones, motion only where it explains a change (count-up,
card lift on drag, pop on drop, sliding tab indicator), `prefers-reduced-motion` honoured.
Responsive down to 375 px.

### 6.2 Partner portal (`partner.cyprusvipestates.com`, en/de/pl/ru)
Public: landing (programme, 3 steps, CTA; `/partners` on the site links here),
registration (incl. partner type and agreement PDF + checkbox), login, password reset.
Pending: waiting screen, profile only.
Active:
1. **Overview** — KPIs (active clients, viewings, commission expected/earned/paid),
   recent milestones, personal ref link with copy button, personal manager card.
2. **Submit client** — Handover / Fix tabs, both shares shown side by side.
3. **My clients** — list with stage chip, CVE contact, last milestone, commission;
   search, filters (active/closed/lost), period filter with "remember".
4. **Client detail** — 7-step progress bar, milestone timeline, messages from CVE,
   contact person, per-deal commission with stage, neutral lost reason, reopen visible.
5. **Projects & commissions** — published projects with "your commission: x % of price"
   (trust mode adds our rate and share), link to project page.
6. **Commissions** — all deals, totals per stage, payout dates, credit-note PDFs.
7. **Report** — live, exportable PDF/CSV (replaces Whitewill's "request a report").
8. **Materials** — agreement, advertising guidelines, how-to/FAQ, project exposés from our
   own DB.
9. **News** (Phase 4) — automatic: new projects, price changes, nearly sold out; unread
   counter.
10. **Rating** (Phase 4) — season ranking (others anonymised), points, countdown, prizes.
11. **Profile** — contact data, language, password, notification toggle, bank details,
    accepted agreement. Phone and partner type editable only by us.

## 7. Security and failure handling

Portal: separate sessions bound to the partner host; scope + DTO layer on every query;
login throttling; per-hour limits on registration and submissions; duplicate check never
leaks; suspending a partner kills sessions immediately, data stays.
Bank details: encrypted at rest; masked everywhere; full view owner-only (audit-logged);
IBAN change requires password re-entry, emails the partner, alerts the operator, and
blocks "Paid out" for 7 days unless the operator explicitly confirms.
Activation email contains a login link only — passwords are never emailed.
CRM: rights enforced server-side incl. export/search/MCP; audit log for rights changes,
approvals, commission edits, IBAN views.

| Case | Behaviour |
|---|---|
| Employee deactivated / on holiday | Their leads return to the inbox; holiday switch stops new suggestions. |
| No language match | Fallback to least loaded, flagged. |
| No commission rate | "Rate missing", operator warning, partner sees "being calculated". |
| Deal cancelled after reservation | CANCELLED, dated, visible to partner. |
| Partner email bounce | Milestone still in portal; send failure shown in CRM. |
| Two partners submit same client | First wins; second sees "checking"; both in review. |

Credit-note PDF: mandatory content (tax, reverse charge for foreign partners) to be
confirmed by the operator's tax adviser before Phase 3 ships; format follows that.

## 8. Testing

Automated tests in the existing runner (`npm test`) for: access layer (own / see / edit
matrix), partner isolation (partner A requesting partner B's client, by id and by list),
duplicate + claim logic incl. 6-month expiry from last real contact, commission
calculation (project vs developer vs missing vs override, handover vs fix share), stage →
commission status transitions, IBAN-change payout block. Client components tested with the
jsdom harness. Old-CRM `RESERVED` support verified before the enum migration ships.

## 9. Additions approved after the first draft

| # | Feature | Notes | Phase |
|---|---|---|---|
| 1 | **Partner Telegram bot** | Notifications (stage, messages, commission), `/status`, `/provision`, client submission in chat with the same duplicate check. Account linked once via a one-time code from the portal. Per-partner channel choice: email / Telegram / both. **No WhatsApp to partners** (OpenWA is unofficial → ban risk; later only via the official Business API). | 3 |
| 2 | Weekly partner digest (email) | Monday: clients' progress, expected commission, new projects matching their clients' budgets. Opt-out in profile. | 3 |
| 3 | Match alert for partner clients | New unit / price drop matching a partner client's budget + interest → partner + owner notified. Reuses property matching + inventory-change data. | 3b |
| 4 | Visible response time | Per client "contacted N min after submission"; programme average on the portal landing page. | 3 |
| 5 | Partner tiers | e.g. Silver 30 % / Gold 35 % / Platinum 40 % by closed deals per year; thresholds and shares configurable; progress bar in portal. **System proposes the upgrade, operator confirms.** Combinable with seasonal rating. | 4 |
| 6 | Partner-branded presentations | Partner builds a client presentation from the existing ClientPresentation system with their own name/logo and no CVE contact data; sees opens/views; enquiries from it auto-attribute to the partner. | 3b |
| 7 | Commission calculator | Price in → partner payout per project. | 3 |
| 8 | Partner onboarding checklist | Complete profile, connect Telegram, first client, first presentation. | 3 |
| 9 | SLA timers + escalation | Unassigned 30 min → operator; assigned but uncontacted 2 h → owner; 4 h → operator with reassign suggestion. Thresholds configurable. | 2 |
| 10 | Claude in the lead cockpit | Summary + next step at the top of every lead; intake from pasted text (WhatsApp chat, voice-note transcript) → fields prefilled, human confirms; reply drafts in client language (existing). Prompts carry no invented figures. | 2 |
| 11 | Lead temperature | Hot / warm / cold from budget, timeline and behaviour (presentation opened, project page visits, replies). Dot on pipeline cards. | 4 |
| 12 | Command palette ⌘K | Search + actions ("log call for Brenner"). | 2 |
| 13 | Mobile app (PWA + push) | **Deferred to the very end — build only when the operator explicitly asks.** The responsive web UI is in scope from Phase 2 regardless. | last |
| 14 | Partner quality | Per partner: submitted, reachable/valid, converted; flags low quality, proposes tier upgrades. | 4 |
| 15 | Commission forecast | Expected commission per month from reservations, contracts and payment plans. | 4 |
| 16 | Channel performance | Per source: leads, closes, earned commission (Meta vs partners vs web). | 4 |

## 10. Phases

1. **Foundation** — single status source, RESERVED, lost reason, rights model + access
   layer (incl. MCP), Deal, CommissionRate, commission maths.
   Plan: `docs/superpowers/plans/2026-10-17-crm-v2-phase1-foundation.md`.
2. **New CRM** — design system, Today, Inbox with suggestions + notifications, Pipeline,
   Lead cockpit, Partners/Commissions/Settings screens, responsive layout, SLA timers (#9),
   Claude in cockpit (#10), ⌘K (#12).
3. **Partner portal** — subdomain, auth, registration + agreement, approval, submit
   (handover + fix), duplicate review, tracking, emails, commissions + credit notes,
   report, materials, 4 languages, Telegram bot (#1), weekly digest (#2), response time
   (#4), calculator (#7), onboarding (#8).
   **3b** — match alerts (#3), partner-branded presentations (#6).
4. **Polish** — analytics, automatic news, rating seasons with prizes, tiers (#5), lead
   temperature (#11), partner quality (#14), forecast (#15), channel performance (#16).
5. **Mobile app** (#13) — only on the operator's explicit go.

Each phase gets its own implementation plan. Production deploys remain the operator's call.
