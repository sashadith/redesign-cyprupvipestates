# Developer client registration — design

Status: ready for operator approval, 2026-10-27. Source: conversation with the operator
(Sascha) on 2026-10-26/27, plus the Marinakis sales procedure he forwarded.

## 1. Why

Before we introduce a buyer to a developer (Bauträger), we must **register** the buyer
with that developer, or the commission is not ours. Today staff do this by hand, by email
or WhatsApp, with no record in the CRM. That causes three problems:

- Registrations are slow, so another agency can get there first. With Ben Wood at Pafilia,
  another agency had already made a preliminary registration.
- Nobody can see in the CRM whether a client is protected with a given developer.
- Confirmations get lost. They arrive by email or WhatsApp and are noted only in free text,
  if at all.

How registration works in practice (Marinakis procedure, Pafilia/BBF/Korantina notes):

1. We send the developer the client's name, phone, preferred project and budget.
2. The developer replies with a **preliminary** confirmation, or rejects because someone else
   registered the client first.
3. The registration becomes **fixed** once an introduction has happened: a meeting at the
   developer's office, a Zoom, or a conference call. Only then is the commission secured.

## 2. Goals

- One click on a lead registers the client with **one or more developers at once**.
- Each developer has its own channel, set once per developer:
  - **email** to an address, with an optional CC list, or
  - **WhatsApp** to a number.
- The message is sent **immediately and automatically**. There is no draft and no approval
  step.
- The client's phone number is **always masked**, and the full number never leaves our
  system. Format: country code, `XXXX`, last four digits. Example: `+35799278285` →
  `+357XXXX8285`.
- The lead cockpit has a small block on the right side showing, per developer:
  - date sent,
  - **Preliminary** with date,
  - **Fixed Registration** with date.
- Email replies from developers are analysed by Claude. A confirmation marks the
  registration **Preliminary** automatically.
- If a registration is still unconfirmed 2 days after sending, a reminder goes to **both**
  the operator (owner) and the lead's assigned staff member.

## 3. Non-goals

- Registering automatically when a lead is created or a project is set on it. A human
  always clicks.
- Developer portals or web forms. Only email and WhatsApp are in scope.
- Reading developer WhatsApp replies. The operator sees them on the phone and marks
  Preliminary by hand.
- Tracking how long a registration stays valid (expiry).
- Automating registration for partner-portal Fix-mode leads. That may come later and would
  reuse this feature.

## 4. Anti-goals (a failure even if it "works")

- Any outgoing registration containing the full phone number or the client's email.
- A developer email or WhatsApp counting as **client contact**:
  - in the SLA or "real contact" logic,
  - in the follow-up cadence,
  - in "lead replied" notifications,
  - in stale-lead detection.
  These are messages to a third party, not to the client.
- Auto-marking a **rejection** or an unclear reply as Preliminary.
- Registering the same client twice with the same developer by accident.

## 5. Decisions taken with the operator

| Topic | Decision |
|---|---|
| Channel | Per developer: email (To + CC list) **or** WhatsApp to one number |
| Office copy | Emails are sent FROM office@, so the office mailbox holds every registration and reply. WhatsApp has no copy, because the operator sees the chat |
| Sending | Fully automatic on click, no approval step |
| Email sender | **office@cyprusvipestates.com** (operator, 2026-10-27), signed with the clicking staff member's name; office@ is then the sender, not a CC |
| WhatsApp sender | The existing OpenWA connection (company number) |
| Message language | English |
| Required content | Full name and masked phone. Preferred project and budget are **optional** |
| Phone mask | `+<country code>XXXX<last 4 digits>` |
| Trigger | Staff clicks "Register" in the lead cockpit block and multi-selects developers and/or projects |
| Preliminary | Set automatically from an analysed email reply, or by hand |
| Fixed Registration | Set **by the operator himself**, by hand, after the physical or Zoom introduction |
| Reminder | Only for missing Preliminary. Goes to the operator **and** the assigned staff member |

## 6. Data model

### 6.1 Developer registration profile

New fields on `DeveloperAccount`:

```prisma
registrationChannel  RegistrationChannel @default(NONE)  // NONE | EMAIL | WHATSAPP
registrationEmailTo  String?              // one address
registrationEmailCc  String[]  @default([])
registrationWhatsApp String?              // E.164
```

- Only developers with a channel other than NONE and a complete target can be selected.
- Edited on the existing admin developer page, next to the developer contact
  (`src/app/admin/(panel)/developments/developers/[id]/DeveloperContact.tsx`, action
  `saveDeveloperContact`).
- Validation rules:
  - each address must be a valid email,
  - office@ is added at send time, so it is never stored in the CC list,
  - the WhatsApp number is normalised with libphonenumber-js.

### 6.2 Registration record

```prisma
model DeveloperRegistration {
  id                  String   @id @default(uuid())
  leadId              String
  developerAccountId  String
  developmentIds      String[] @default([])   // projects named in the message (may be empty)
  channel             RegistrationChannel     // EMAIL | WHATSAPP at send time
  status              DeveloperRegistrationStatus // SENT | PRELIMINARY | FIXED | REJECTED | FAILED
  sentAt              DateTime?
  sentById            String?
  sendError           String?
  outboundInteractionId String?              // the lead-timeline row of the sent message
  preliminaryAt       DateTime?
  preliminarySource   String?                // "manual" | "auto"
  preliminaryById     String?
  fixedAt             DateTime?
  fixedById           String?
  rejectedAt          DateTime?
  reminderSentAt      DateTime?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  @@unique([leadId, developerAccountId])
}
```

- **Re-sending:** allowed only from FAILED or REJECTED. It resets the record to SENT.
- **Undo:** each manual mark (Preliminary, Fixed, Rejected) can be undone back to the
  previous state. A wrong auto-Preliminary must be correctable.
- **History:** every state change also writes a `SYSTEM` LeadInteraction, so the timeline
  shows the full history (who, when, auto or manual).

## 7. Flow

### 7.1 Register

1. The cockpit block's **Register** button opens a dialog.
2. The dialog has two grouped, searchable multi-select lists:
   - **Developers** that have a profile,
   - **Projects** (Developments), each mapped to its developer through
     `developerAccountId`.
   Picking a project implies its developer. Several projects of one developer go into **one**
   message. Developers the lead already has a non-failed, non-rejected registration with are
   shown as "already registered" and cannot be picked.
3. Optional inputs:
   - **Budget**, prefilled from `budgetMin`/`budgetMax`,
   - **Preferred project**, the picked projects of that developer.
4. The dialog shows a read-only preview of the exact message per developer, including the
   masked phone, so staff see what leaves the building.
5. **Send** sends each message one by one. Each developer's result is shown: sent, or
   failed with the reason. A failure for one developer does not stop the others.

**Blocked when:**
- the lead has no phone number, or the phone cannot be parsed into a country code plus at
  least 4 trailing digits. Staff fix the phone first.
- the user cannot edit the lead (`canEditLead`).

### 7.2 Message

```
Subject: Client registration – <Full name> – Cyprus VIP Estates

Dear <developer contactPerson, else "Sales Team">,

We would like to register the following client with you:

Full name: <first last>
Phone: <+357XXXX8285>
Preferred project: <names, comma-separated>    ← line omitted if none
Budget: <€X – €Y | up to €Y | from €X>         ← line omitted if none

Please confirm the registration.

Kind regards,
<staff member name>
Cyprus VIP Estates
```

WhatsApp uses the same text without the subject line.

### 7.3 Phone mask

- Parse with `libphonenumber-js`, using the lead's phone as typed.
- Output: `+<countryCallingCode>XXXX<last 4 of national number>`. The `XXXX` is always four
  X, whatever the real length.
- Unit-tested cases:
  - the operator's example: `+35799278285` → `+357XXXX8285`,
  - a DE number,
  - a UK number,
  - spaces and dashes in the input,
  - an `00` prefix,
  - unparseable input, which is refused.

### 7.4 Sending: email

- A new sender. The existing `sendLeadEmail` always sends to the lead.
- `to = registrationEmailTo`, `cc = registrationEmailCc + office@cyprusvipestates.com`
  (deduplicated).
- The Message-ID must be returned and stored on the lead-timeline row, because reply
  matching depends on it.
- The timeline row is type `SYSTEM`, with metadata
  `{ kind: "developer_registration", registrationId, channel: "email", to, cc }`.
  It is not `EMAIL_OUT`, so that it never counts as client contact (§4).
- The follow-up cadence is **not** advanced.
- **Sender: the office mailbox** (`EMAIL_USER` = office@cyprusvipestates.com on Hostinger SMTP, already used by `src/lib/sendEmail.ts`). `sendEmail` has no CC and returns no Message-ID, so add a sibling (or extend it without changing existing callers) that takes `to`, `cc`, sets/returns the Message-ID. Because office@ is the sender, it is not added as CC; the configured developer CC list still is. `Reply-To` stays office@.

### 7.5 Sending: WhatsApp

- `createOpenWaClient().sendText(chatIdFor(registrationWhatsApp), text)`.
- This path deliberately skips the "thread must already exist" guard, which protects
  *clients* from cold messages and does not apply to a developer's sales number.
- It must still respect the daily send cap.
- Timeline row: `SYSTEM`, same metadata with `channel: "whatsapp"`.

### 7.6 Reply analysis (email only)

1. **New: read-only polling of the office mailbox.** Today only per-user mailboxes (`UserEmailSettings`) are polled. Add an office-mailbox poll to the existing 5-minute `email-inbound` cron, reusing `withReadOnlyInbox` (EXAMINE, read-only, never flags/moves/deletes) with credentials from env: `EMAIL_USER` / `EMAIL_PASSWORD`, host `OFFICE_IMAP_HOST` (default `imap.hostinger.com`), port `OFFICE_IMAP_PORT` (default 993). Store the UID cursor (`lastUid`, `uidValidity`) in a small persisted state row. On first run start at the current highest UID (no backfill).
   The office inbox receives a lot of unrelated mail (lead notifications, newsletters). The office poll handles **only** emails that resolve to a developer registration (header match against registration Message-IDs, or the sender fallback in §12.2); everything else is skipped untouched — it must never create `EMAIL_IN` rows or "lead replied" pings for ordinary office mail.
2. Matching by In-Reply-To/References against `LeadInteraction.messageId` (same logic as `matchLeadForInboundEmail`, extended to return the matched interaction).
3. When that interaction's metadata has `kind: "developer_registration"`:
   - store the reply on the lead timeline as a **developer reply**, not as a client reply.
     There is no "lead replied" Telegram, no cadence change and no contact credit.
   - classify it with Claude: `createToolCall` with `AI_MODEL_FAST` and a forced tool
     returning `{ verdict: "confirmed" | "rejected" | "unclear", evidence: string }`, where
     evidence is a short quote from the reply.
   - act on the verdict:
     - `confirmed` and the record is SENT: set PRELIMINARY with `preliminarySource: "auto"`
       and log the evidence.
     - `rejected` or `unclear`: change nothing, and send an office Telegram alert "Developer
       reply needs a look" with a deep link.
     - Claude unavailable or erroring: treat as `unclear`.
4. Rejection is only ever marked by a human (anti-goal §4).

### 7.7 Reminders

- **Condition:** status SENT, `sentAt` more than 2 days ago, `reminderSentAt` is null.
- **Action:** one email to the owner(s) and the lead's assigned staff member (if any), plus
  one office Telegram message. Then set `reminderSentAt`.
  - There is no per-user Telegram in the system today. Staff are reached by email, and the
    office Telegram reaches the operator.
- **Where it runs:** inside the existing `crm-sla` cron (every 10 minutes), so no new
  crontab entry is needed.
- **Action Center:** an item stays while the condition holds (without the
  `reminderSentAt` test), so it does not disappear after the one email.

## 8. Cockpit block

- **Placement:** in `<aside className="crm-ck-aside">` on `src/app/crm/leads/[id]/page.tsx`,
  as a new `CockpitRegistrations` component, styled like the existing aside blocks.
  Copy is English (internal CRM).

Content per registration, one compact row:
- developer name and channel icon,
- status chip,
- dates: Sent · Preliminary (auto/manual) · Fixed.

Actions:
- **Mark preliminary**: anyone who can edit the lead.
- **Mark rejected**: anyone who can edit the lead.
- **Mark fixed**: operator (owner) only.
- **Undo**: whoever may set that state.
- **Resend**: FAILED or REJECTED only.
- **Register**: opens the dialog. Disabled with a reason when the lead has no usable phone
  or no developer has a profile yet.

## 9. Permissions and safety

- Every server action calls `requireCrmUser()` and checks `canEditLead`. Fixed and its undo
  also require `isOwner`. See `admin-server-actions-need-own-guard`: middleware does not
  protect these.
- Masking happens **server-side** at send time. The client never receives a pre-built
  message it could alter, and the preview is built by the same function.
- Sending is rate-limited by the existing OpenWA daily cap. Email has no extra cap.

## 10. Rollout

- One migration: an enum plus the `DeveloperAccount` fields plus the new table. The deploy
  needs `CVP_RUN_MIGRATE=1`.
- No new cron entry. Optional env `OFFICE_IMAP_HOST` / `OFFICE_IMAP_PORT` (defaults fit Hostinger); verify on the VPS that `EMAIL_PASSWORD` also works for IMAP before relying on auto-Preliminary.
- At deploy, no developer has a profile yet. The operator fills profiles on the admin
  developer page, starting with Marinakis: `sales@marinakisproperty.com`, CC
  `mvenizelou@marinakisproperty.com`.

## 11. Operator answers

- Email sender: office@ (option 2 of 3, 2026-10-27), with office-mailbox polling built as part of this feature (§7.4, §7.6).

## 12. Calls made by Claude after the builder check (operator may override)

1. **Timeline row types and direction.**
   - The outbound registration row is a `SYSTEM` row with `direction = null`.
   - A developer reply is stored as a `SYSTEM` row with `direction = null` and metadata
     `{ kind: "developer_registration_reply", registrationId, verdict, evidence, from, subject }`.
     It is never stored as `EMAIL_IN`.
   - Regression tests prove these rows are ignored by:
     - SLA and "real contact" logic,
     - the follow-up cadence,
     - stale detection,
     - the "lead replied" notification.
2. **Replies that are not threaded.** If header matching fails, fall back to the sender:
   - Match the sender address against `registrationEmailTo`/`registrationEmailCc` of
     developers that have SENT registrations. If the address doesn't match, match the
     sender domain against those addresses' domains.
   - Exactly one SENT registration for that developer: treat the email as its reply.
   - Several SENT registrations: classify the email, but never auto-mark. Send the office
     Telegram alert listing the candidate leads instead.
   - No match: the email is ignored, as today.
3. **Auto-replies.**
   - The classifier gets a fourth verdict, `autoreply`.
   - Emails with an `Auto-Submitted` header other than `no`, or with that verdict, are
     stored but trigger no alert.
   - Otherwise there is at most one "needs a look" alert per incoming email.
4. **Phone parsing.**
   - Without a `+` or `00` prefix, the number is not parsed with a guessed country.
   - Registration stays blocked until the phone is stored in international format, so a
     wrong country code is never sent.
   - A national number with fewer than 6 digits is refused.
5. **Reminder recipients.**
   - Recipients: the owner(s) (`User.isOwner`, active) plus `Lead.assignedToId` if set,
     active and not already an owner.
   - Sent through the office SMTP (`sendEmail`).
   - Skipped for leads that are deleted, CLOSED or LOST.
6. **Send ordering.**
   - The record is created first, with status SENT but `sentAt = null`.
   - It is then sent. Success fills `sentAt` and the outbound row. Failure sets FAILED and
     `sendError`.
   - Hitting the unique constraint (double click) is reported as "already registered".
   - SMTP and OpenWA calls get a 30 s timeout and no automatic retry. Staff resend from
     FAILED.
7. **State transitions.**
   - Allowed: SENT→PRELIMINARY, SENT→FIXED, PRELIMINARY→FIXED, SENT/PRELIMINARY→REJECTED.
     SENT→FIXED exists because an introduction may happen before a written confirmation.
   - Undo of the most recent mark: PRELIMINARY→SENT (clears the preliminary fields),
     FIXED→the state before (PRELIMINARY if `preliminaryAt` is set, else SENT),
     REJECTED→SENT or PRELIMINARY, again depending on `preliminaryAt`.
   - No history column. The `SYSTEM` timeline rows are the audit trail.
   - Resend from FAILED/REJECTED clears all dates.
8. **Projects without a developer profile.** The dialog shows them disabled, labelled "no
   registration channel set", so staff know why.
9. **WhatsApp cap.** The OpenWA daily cap is shared with client messages, intentionally,
   because it protects the number. If the cap is hit, the registration is FAILED with
   "daily WhatsApp limit reached" and can be resent later.

## 13. Left to the builder

- Exact component split and CSS, within the existing cockpit look.
- Whether the email sender is a new function or a generalised `sendUserEmail` with
  To/CC/Message-ID. Either way, no behaviour change for existing callers.
- Prompt wording for the classifier, plus tests with real-looking confirmation, rejection
  and out-of-office replies.
- Check that `matchLeadForInboundEmail` does not filter by interaction type. If it does,
  extend it to include these `SYSTEM` rows.
