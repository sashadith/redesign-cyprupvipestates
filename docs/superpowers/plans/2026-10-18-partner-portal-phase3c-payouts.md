# Partner Portal Phase 3c (Payouts: bank details, credit notes, commissions, report) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Partners store bank and billing details safely. The operator pays out a partner deal, and the system issues a numbered credit note (Gutschrift) PDF. Partners see every deal and payout on a Commissions page, download their credit notes, and export a report.

**Architecture:**
- **Bank and billing details:** stored as one AES-256-GCM encrypted JSON blob on Partner (existing `src/lib/crypto/secretBox.ts`, key `SETTINGS_ENCRYPTION_KEY`). Only a masked IBAN (last 4) is stored in clear.
- **Credit notes:** immutable rows with a gap-free yearly sequence (counter row locked in the payout transaction). The PDF bytes are stored in the DB (`Bytes`), so they survive deploys.
- **PDF rendering:** happens in a short-lived child process (`scripts/credit-note-pdf-worker.mjs`, plain ESM + `@react-pdf/renderer` `createElement`). This follows the existing `scripts/pdf-*-worker.mjs` pattern and avoids react-pdf's font-subset state leaking between documents in one long-lived process (memory: react-pdf-gotchas).

**Tech Stack:** Next.js 14.2, Prisma 5.22 (additive migration), `@react-pdf/renderer` 4.5, Node `child_process`, node:test via tsx, PyMuPDF for the rasterised check (controller).

**Spec:** `docs/superpowers/specs/2026-10-17-crm-v2-partner-portal-design.md`. Relevant sections:
- §2 Payout (credit-note basis)
- §4 Partner bank fields + CreditNote
- §5.3 items 3 and 5
- §6.2 items 6, 7, 11 (bank details, accepted agreement)
- §7 bank-details rules + credit-note tax note
- §8 IBAN-change payout block test

## Global Constraints

- The local `.env.local` DATABASE_URL is the LIVE production database. Never run prisma migrate/db push/next build/next dev or anything connecting to a DB. `prisma generate`/`validate` only with `DATABASE_URL=postgresql://x:x@localhost:1/x`. Additive hand-written migration, verified by the controller on PGlite.
- Never send email/Telegram from tests or scripts. Never call cron routes.
- No changes under `src/app/admin/`. Partner copy en/de/pl/ru (never Hebrew), DE Sie / PL Państwo / RU Вы. CRM copy English. CI styles: portal.css (34b6c878) and crm.css (e8d96f7e).
- **Bank-detail rules (spec §7):**
  - Encrypted at rest; masked everywhere (`•••• 1234`). Full view is owner-only (`isOwner`) and audit-logged.
  - A change requires password re-entry and emails the partner (language of the partner, no IBAN in the mail beyond the last 4).
  - A change alerts the office (Telegram, last 4 only) and blocks "Paid out" for 7 days unless the operator explicitly confirms (audited).
- Plaintext bank data never appears in logs, audit `before/after`, Telegram, emails, URLs, client props of non-owners, or error messages.
- **Credit notes:**
  - Immutable once issued.
  - Number format `CVE-GS-<YYYY>-<NNNN>`, gap-free per year.
  - Issued only for deals with a partner commission (> 0) on a partner whose bank details are complete.
  - The PDF content is a **draft layout until the tax adviser confirms**. The document shows the watermark/footer "Draft — content to be confirmed by our tax adviser" unless env `CREDIT_NOTE_FINAL=1`.
  - Issuer data comes from env (`CVE_LEGAL_NAME`, `CVE_LEGAL_ADDRESS`, `CVE_VAT_ID`, `CVE_REG_NO`). A missing issuer env blocks issuing with a clear CRM error.
- Tests `npm test`; `npx tsc --noEmit` 0; `npm run lint` 0. Explicit-path commits, never `git add -A`, don't push, don't deploy.

## Decisions taken while planning

1. **Fields** (Partner, additive):
   - `bankDetailsEnc String?`: encrypted JSON `{ holder, iban, bic, billingName, billingAddress, vatId }`.
   - `ibanLast4 String?`, `bankDetailsUpdatedAt DateTime?`, `ibanChangedAt DateTime?` (set only when the IBAN itself changes, not on the first entry).
   - `vatMode PartnerVatMode @default(NONE)` with values NONE | CY_VAT | REVERSE_CHARGE. Set by the operator in /crm/partners, never by the partner. CY_VAT uses 19 % (constant `CY_VAT_RATE = 19`, changeable in one place).
2. **Payout block:** `payoutBlockedUntil = ibanChangedAt + 7 days`. Setting PAID_OUT while blocked requires an explicit "override" flag in the action, plus an owner/manager confirm checkbox in the UI, plus an audit entry `partner.payout_override`.
3. **CreditNote model:**
   - `{ id, number @unique, year, seq, partnerId, dealId @unique, netAmount Int (whole euros = deal.partnerCommission), vatMode, vatRate Decimal(5,2)?, vatAmount Int, totalAmount Int, issuedAt, issuedById, pdf Bytes, pdfSha256 }`.
   - Plus `CreditNoteCounter { year Int @id, lastSeq Int }`.
   - The **number and the DB rows are written in the same transaction as the PAID_OUT stage change**. The PDF is rendered BEFORE the transaction, from the data model with a reserved number. Order:
     1. Lock the counter (`SELECT … FOR UPDATE` inside an interactive transaction).
     2. Compute the number.
     3. Render the PDF via the worker (the transaction timeout is raised to 60 s for this action only).
     4. Insert the CreditNote, update the deal to PAID_OUT, audit, outbox row.
   - If rendering fails, the transaction rolls back: no number is consumed and the deal stays unchanged.
4. **Credit-note content (draft):**
   - Title "Gutschrift / Credit note".
   - Issuer block (env).
   - Recipient block: billingName, billingAddress, vatId if set.
   - Number, issue date, service period / reference: "Referral commission — {project} {unit}, client {initials}" (client initials only, GDPR).
   - Net amount, VAT line by vatMode:
     - CY_VAT: "VAT 19 %" + amount.
     - REVERSE_CHARGE: "Reverse charge — VAT to be accounted for by the recipient (Art. 196 Directive 2006/112/EC)", 0.
     - NONE: "No VAT charged", 0.
   - Total, payment note "Paid by bank transfer to IBAN •••• 1234".
   - Statement "This credit note replaces an invoice from the recipient (self-billing)". Draft footer unless final.
   - Language: English + German line labels (bilingual, one layout). The tax adviser decides the final wording.
5. **Partner commissions page** (`/commissions`):
   - All deals of the partner's effectively-active claims (rule: `src/lib/partner/claimState.ts`), plus deals on claims that ended after a deal existed (deals never disappear; the 3b rule already keeps committed claims active).
   - Totals per stage (EXPECTED/EARNED/DEVELOPER_PAID/PAID_OUT).
   - Payout dates, a credit-note download per PAID_OUT deal, and "being calculated" for missing rates.
6. **Report export:**
   - `/commissions/export.csv?from=&to=` (route handler, partner session, partnerId filter).
   - Columns: client (submission name), project, unit, price, partner commission, stage, expected/earned/developer-paid/paid-out dates, credit-note number.
   - Semicolon-separated, UTF-8 BOM (Excel-friendly), formula-injection safe (prefix `'` for cells starting with `= + - @`).
   - A printable HTML report page `/commissions/report` (browser "Save as PDF") instead of a server PDF.
7. **Credit-note download:** route `/commissions/credit-note/[id]` (partner: own only) and `/crm/credit-notes/[id]` (staff: canAssignLeads, or owner of the lead). Both serve `application/pdf` with `Content-Disposition: attachment; filename="<number>.pdf"` and `Cache-Control: private, no-store`.
8. **Profile bank details (portal):**
   - A section "Bank & billing details" showing masked values plus an edit form.
   - Fields: holder, IBAN (validated mod-97, country length table for SEPA and common countries), BIC (8/11 format, optional for SEPA IBANs), billingName, billingAddress (multi-line ≤300), vatId (optional, ≤20, simple format).
   - The current password is required on save.
   - On success:
     - encrypt and save;
     - email the partner ("Your bank details were changed — if this was not you, contact us");
     - send a Telegram office alert ("Partner {name} changed bank details (IBAN •••• 1234) — payouts blocked until {date}");
     - write an audit row without values.
9. **CRM partner bank view:**
   - In /crm/partners the expanded row shows masked details, vatMode select, "payout blocked until" and "bank details incomplete" badges.
   - "Reveal" button for `isOwner` only: a server action decrypts and returns the full details to the owner's client, and writes an audit entry `partner.bank_viewed`.
10. **Notifications:** on PAID_OUT the outbox gets `refKey "paid:<dealId>"`, kind `PAYOUT` (new enum value). The partner email (localized) says the commission was paid and the credit note is in the portal. No PDF attachment; the link is to /commissions.

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma`, `prisma/migrations/20261019120000_partner_payouts/migration.sql` | Partner bank fields, vatMode, CreditNote, CreditNoteCounter, PAYOUT enum value |
| `src/lib/partner/bank.ts` | Pure: IBAN/BIC/VAT validation, masking, `validateBankDetails`, `payoutBlockedUntil`, encrypt/decrypt wrappers |
| `src/lib/partner/creditNote.ts` | Pure: number format, VAT computation, `creditNoteModel(...)` (everything the PDF shows), client initials |
| `scripts/credit-note-pdf-worker.mjs` | Child-process renderer: JSON model on stdin → PDF bytes on stdout |
| `src/lib/partner/creditNotePdf.ts` | Server: spawn worker with timeout, return Buffer |
| `src/lib/crm/payout.ts` | Server: `markPaidOut(actor, dealId, { onDate, override })` transaction |
| `src/app/crm/commissions/*` (PAID_OUT path), `src/app/crm/partners/*` (bank view, vatMode), `src/app/crm/credit-notes/[id]/route.ts` | CRM |
| `src/app/partner-portal/{commissions/page.tsx, commissions/report/page.tsx, commissions/export.csv/route.ts, commissions/credit-note/[id]/route.ts}`, profile bank section | Portal |
| `src/lib/partner/notify*.ts` | PAYOUT email |
| Tests: `partnerBank`, `partnerCreditNote`, `partnerCommissionsCsv`, `crmPayout` (pure parts) | |

---

### Task 1: Schema and migration

- [ ] Add to Partner: `bankDetailsEnc String?`, `ibanLast4 String?`, `bankDetailsUpdatedAt DateTime?`, `ibanChangedAt DateTime?`, `vatMode PartnerVatMode @default(NONE)`. Add enum `PartnerVatMode { NONE CY_VAT REVERSE_CHARGE }`.
- [ ] Add `PAYOUT` to `PartnerNotificationKind` (SQL `ALTER TYPE … ADD VALUE 'PAYOUT'`. It must not run inside a transaction block together with usage. Put it at the top, and the file must not use the value. Check the PGlite apply.)
- [ ] Add CreditNote and CreditNoteCounter per Decision 3 (`pdf Bytes` → BYTEA; FK dealId → deals ON DELETE RESTRICT, partnerId → partners ON DELETE RESTRICT, issuedById → users SET NULL). Back-relations on Partner, Deal (`creditNote CreditNote?`), User.
- [ ] Validate and generate with the dummy URL; run tsc and npm test.
- [ ] Commit. The controller runs the PGlite apply + `migrate diff`.

### Task 2: Pure logic: bank details, credit-note model, CSV

**Files:** `src/lib/partner/bank.ts`, `src/lib/partner/creditNote.ts`, `src/lib/partner/commissionsCsv.ts`. Tests: `partnerBank`, `partnerCreditNote`, `partnerCommissionsCsv`. Add dict keys (profile bank section, errors, commissions page, report, payout email) in all 4 locales.

**Interfaces:**
- `ibanValid(s)`: strip spaces, uppercase, country length table, mod-97 === 1.
- `normaliseIban(s)`.
- `maskIban(iban)` → `"•••• 1234"`.
- `bicValid(s)`.
- `vatIdValid(s)`: 4–20 chars of A–Z0–9, starting with 2 letters.
- `validateBankDetails(raw)` → `{ok,data}|{ok:false,field,code}`. Keys holder ≤80, iban, bic optional, billingName ≤120, billingAddress ≤300 (newlines allowed), vatId optional. Unknown keys rejected; control chars rejected.
- `encryptBankDetails(d)` / `decryptBankDetails(s)`: these wrap secretBox; they live in a server module, not imported by client code.
- `payoutBlockedUntil(ibanChangedAt: Date | null): Date | null` and `isPayoutBlocked(at, now)`.
- `creditNoteNumber(year, seq)` → `CVE-GS-2026-0001`.
- `vatFor(mode, net)` → `{ rate: number | null; vat: number; total: number }`. Whole euros, rounding via the same basis-point helper style as commission.ts.
- `clientInitials(first, last)` → "N. B.". Non-Latin letters stay as their first letter.
- `creditNoteModel({ issuer, partner billing, number, issuedAt, deal: { projectName, unitLabel }, clientInitials, net, vatMode, ibanLast4, final })` → plain JSON model (all strings preformatted, euro formatting `€ 12,345` en-GB style + German labels).
- `commissionsCsv(rows, locale)`: BOM, semicolons, quoting, formula-injection guard.

- [ ] Tests first:
  - IBAN valid/invalid samples: DE, CY, PL, GB, wrong checksum, wrong length, lowercase with spaces.
  - Masking.
  - VAT for all three modes, including rounding of halves.
  - Number padding and year.
  - Model contains the draft footer unless final, and never the full IBAN.
  - CSV injection and BOM.
- [ ] Implement; run `npm test && tsc && lint`; commit.

### Task 3: Portal: bank details in profile, office alert, partner email

**Files:** profile page section + action (`src/app/partner-portal/profile/*` or `bankActions.ts`), server module `src/lib/partner/bankStore.ts` (encrypt/save/load masked), mail builder `buildBankChangedEmail` in mail.ts/notify.ts, Telegram notice builder.

Behaviour (Decision 8):
- `requirePartner({ active: true })`. Pending partners see the section disabled ("available after approval").
- Throttle 5/h per partner.
- `verifyPassword` against the PartnerUser hash; a wrong password returns `err.currentPassword`.
- Validate, then encrypt and save in one update. `ibanChangedAt = now` only when a previous IBAN existed and differs.
- Then email (to the partner user, background), Telegram (background), and audit (`writeAudit` actor = partner? It is staff-only, so instead write a SYSTEM LeadInteraction? No: write `writeAudit` with a null actor if supported, else a dedicated log line). Check `writeAudit`'s signature. If it needs a staff user, store a `PartnerAgreementAcceptance`-style row? Not suitable. Ruling: add `audit_logs`-compatible entry with `actorType: "partner"` if the table allows it, else log via `console.info` with partnerId + "bank details changed" only.
- The form never pre-fills the IBAN (masked display only). Holder/billing fields pre-fill from the decrypted details for the partner themself (their own data). Decryption happens server-side on the profile page render for that partner only.
- Tests: pure helpers (change detection `ibanChanged(prev, next)`, email/Telegram builders with no full IBAN).

### Task 4: CRM: bank view, vatMode, payout with credit note

**Files:** `src/lib/crm/payout.ts`, `src/lib/partner/creditNotePdf.ts`, `scripts/credit-note-pdf-worker.mjs`, `src/app/crm/commissions/actions.ts` (PAID_OUT → `markPaidOut`), `src/app/crm/components/DealsTable.tsx` (override checkbox when blocked, credit-note link), `src/app/crm/partners/*` (masked bank view, vatMode select, Reveal for owner), `src/app/crm/credit-notes/[id]/route.ts`.

Behaviour (Decisions 2, 3, 4, 7, 9, 10):
- `setDealStageAction(dealId, "PAID_OUT", onDate)` routes to `markPaidOut`.
- **Deals without a partner** (no partnerCommission or no ACTIVE-effective claim at payout) keep the current behaviour (no credit note).
- **Partner deals:**
  - Require bank details complete and issuer env present.
  - Require not blocked, unless `override` (only `canAssignLeads` and the explicit checkbox).
  - Then the Decision 3 transaction.
- The worker:
  - Reads the JSON model from stdin.
  - Renders A4 with the static TTF `public/fonts/DejaVuSans.ttf` (registered once in the worker; covers Latin, Polish and Cyrillic — partner names can be any script). Headline colour bronze #8E6B3D, text ink #221C15, no alpha colours in borders (react-pdf gotcha).
  - Writes the PDF to stdout and exits 0; on error, prints to stderr and exits 1.
  - Spawned with `process.execPath` and a 20 s timeout.
- Verify by rendering a sample model through the worker in a test-free controller step (the controller rasterises with PyMuPDF and checks the text layer).
- Reveal action: owner only, audit `partner.bank_viewed` (no values in the audit), returns the details to the client once (not cached).
- Tests: pure `payoutDecision({ hasPartnerShare, bankComplete, issuerComplete, blockedUntil, now, override, canOverride })`; worker input validation (pure part); route auth helpers.

### Task 5: Portal: Commissions page, report, CSV, credit-note download, PAYOUT email

**Files:** `src/app/partner-portal/commissions/{page.tsx, report/page.tsx, export.csv/route.ts, credit-note/[id]/route.ts}`, scope additions in `src/lib/partner/scope.ts` (`myCommissions(partnerId, { from, to })`), PortalShell nav "Commissions", notify PAYOUT builder + producer (in `markPaidOut`) + sender support.

- Scope: deals joined through the partner's claims (partnerId filter), using `activeSince` + effective-state rules from `claimState.ts`. Never ourCommission or ourRate.
- Credit-note route: `findFirst({ where: { id, partnerId } })` else 404. The PDF comes from the DB bytes.
- Report page: printable (print CSS), period filter, totals.
- Isolation tests for the new scope where-builders and DTO (no ourCommission, no other partner's notes, no full IBAN).

### Task 6: Wrap-up

- [ ] Full checks; no `src/app/admin` changes; PGlite migration check.
- [ ] Controller: render a sample credit note through the worker and rasterise every page (PyMuPDF). Compare the text layer with the model strings (react-pdf gotchas). Smoke on the demo DB: partner sets bank details; staff pay out (if CRM login is feasible on the demo, else exercise `markPaidOut` via a node script against the demo DB only); partner downloads the credit note; CSV opens.
- [ ] Final whole-branch review (most capable model); one fix wave; re-review; push.
- [ ] Hand-over:
  - Env `SETTINGS_ENCRYPTION_KEY` (already exists in prod for email settings, so verify) and `CVE_LEGAL_*`.
  - `CREDIT_NOTE_FINAL=1` only after the tax adviser signs off.
  - `CVP_RUN_MIGRATE=1`.
  - Then Phase 3d (Telegram bot, digest, calculator, onboarding, materials, match alerts, branded presentations).
