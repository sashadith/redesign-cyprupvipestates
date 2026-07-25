# Email inbound (Phase 4, 2026-07-25)

Reads Sascha's real mailbox (same IMAP account already configured for
Compose/Booking outbound mail — `UserEmailSettings.imapHost/imapPort/
imapUser/imapPasswordEnc`, no separate config, no new env vars) on a
5-minute poll and files matched lead replies onto the right timeline as
`EMAIL_IN` interactions. Sascha keeps using this same mailbox in Apple Mail
for everything else — the system only ever reads from it.

## The read-only guarantee

The mailbox is opened via IMAP's `EXAMINE` command (`ImapFlow.mailboxOpen(path,
{ readOnly: true })`), not `SELECT`. A mailbox opened this way is read-only
at the protocol level — a compliant IMAP server refuses any
`STORE`/`EXPUNGE`/`COPY`/`MOVE` issued against it, regardless of what the
client asks for. `src/lib/emailInbound/imapClient.ts` additionally asserts
`client.mailbox.readOnly === true` right after opening and aborts before
processing anything if that's ever not the case — a hard runtime check, not
just a comment-level promise. Verified live (2026-07-25) against the real
mailbox: a genuinely unread test message stayed unread — both in the raw
IMAP flags and in Apple Mail — across an open → download → re-check cycle.

## How a reply gets matched to a lead

1. **Message-ID threading (primary).** Every outbound Compose/Booking email
   captures its own Message-ID onto the `LeadInteraction` row it creates
   (`LeadInteraction.messageId`, additive + unique). When a lead replies,
   their client sets `In-Reply-To` (and adds to `References`) pointing at
   that Message-ID — this is the actual RFC 5322 mechanism every mail client
   implements for "Reply", not a convention. `matchLead.ts` checks
   `In-Reply-To` first, then walks `References` (the full ancestor chain, so
   multi-hop threads still resolve).
2. **Sender-address fallback.** If no threading match, normalized address
   match against `Lead.email` — Gmail-aware (gmail.com/googlemail.com
   aliased, dots in the local part ignored, since both are Gmail-specific
   delivery quirks, not universal ones). Multiple leads sharing an address →
   assigned to whichever was most recently contacted, flagged
   `ambiguousSenderMatch` in the interaction's `metadata`.
3. **No match** → silently skipped, per spec (Sascha uses this inbox for
   other correspondence too) — but the UID cursor still advances past it so
   it's never re-checked.

The same `messageId` column also gives inbound idempotency for free: an
`EMAIL_IN` row stores the Message-ID of the email *received*, so the same
message can never create two timeline entries.

## Tracking what's already been processed

Can't use the `\Seen` flag (the whole point is not touching it), so
`UserEmailSettings.imapLastUid`/`imapUidValidity` track a UID-based cursor
instead — only UIDs strictly greater than `imapLastUid` are fetched next
poll. If `imapUidValidity` doesn't match the mailbox's current value (or is
null — never polled before), the stored UID has no relation to the current
UID space: rather than guess and risk reprocessing or skipping an unknown
range, the cursor resets to "start from now" (`uidNext - 1`) with **no
historical backfill**. Concretely: whatever's already sitting in the
mailbox at the moment this feature first goes live is never processed —
only mail arriving after that first poll.

The cursor advances after **each** message succeeds, not once at the end of
a batch — a mid-run crash never causes messages already handled that run to
be reprocessed. A single unparseable message halts that run (logged, cursor
stays put) rather than being silently skipped forever or endlessly
reprocessed; later messages retry alongside it next poll.

## Quote stripping

`src/lib/emailInbound/quoteStrip.ts` cuts everything from the first
recognized quote boundary onward: Apple Mail/Outlook "Am ... schrieb ...:"
(German), Gmail/Apple Mail "On ... wrote:" (English), Polish "W dniu ...
napisał", Russian "... писал(а):", a generic Outlook "-----Original
Message-----" block, or the first line starting with `>`. For HTML mail,
`<blockquote>` blocks are stripped before HTML-to-text conversion (covers
Gmail's `gmail_quote` and Apple Mail's `type="cite"` wrapping). Doesn't aim
to be perfect — covers the common client/language mix this business
actually gets replies in; an exotic client falling through is an accepted
residual risk, not a bug to chase.

## Cron

`/api/cron/email-inbound`, same `CronRunLog`-wrapped + `?key=$CRON_SECRET`
pattern as every other cron job. Polls every advisor with IMAP configured
(currently just Sascha) independently — one mailbox being unreachable never
blocks another's, and never crashes the whole run; it's logged and retried
next poll. Scheduled every 5 minutes, offset from `publish-scheduled`'s
identical `*/5` cadence purely to avoid both firing in the same wall-clock
second (harmless either way — separate stateless requests).
