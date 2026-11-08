// One user's inbox AND sent folder on ONE IMAP connection (2026-11-08).
//
// The five-minute poll used to call pollInboundEmailForUser() and then
// pollSentForUser(), each of which opened its own connection: two TCP+TLS
// handshakes and two LOGINs against the same server, per user, per run. The
// cost that mattered was not the milliseconds — a handshake to the mail host
// measures 44-80 ms from the VPS — but the timeout surface: every connection
// is another chance to spend connectionTimeout (20 s) or socketTimeout (60 s)
// before giving up, and a run that opened three of them could outlive both the
// route's own maxDuration and the five-minute cadence that starts the next one.
//
// What is deliberately NOT shared: failure. A hiccup in the Sent folder must
// never hide whether the inbox poll worked, and vice versa — that is why the
// cron reports them as two separate entries, and why each phase below has its
// own catch. Only a failure to establish the session itself takes both down,
// which was equally true when they were two connections to the same host.
import { findSentMailbox, getImapCredentials, withImapSession, MailboxNotFoundError } from "./imapClient";
import { loadInboxCursor, pollInboxOnClient, type PollResult } from "./processInbound";
import { loadLeadEmailIndex, type SentFileResult } from "./sentMail";
import { pollSentOnClient } from "@/lib/crm/commSync";

/** Either the phase's result, a benign reason it did nothing, or why it failed. */
export type PhaseOutcome<T> =
  | { ok: true; result: T }
  | { ok: true; skipped: string }
  | { ok: false; error: string };

export type UserPollOutcome = { inbox: PhaseOutcome<PollResult>; sent: PhaseOutcome<SentFileResult> };

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Polls one user's INBOX and Sent folder on a single read-only session.
 *
 * Throws only for things that make the whole user a no-op or a dead end:
 * ImapNotConfiguredError (nothing to do) and any failure to connect/log in.
 * Everything after the session is open is reported per phase.
 */
export async function pollUserMailboxes(userId: string, fromAddress: string | null): Promise<UserPollOutcome> {
  // Both phases need these, and fetching them BEFORE the session opens keeps a
  // slow database round trip from being charged against IMAP socket time.
  const creds = await getImapCredentials(userId); // ImapNotConfiguredError propagates — a no-op, not a failure
  const [cursor, index] = await Promise.all([loadInboxCursor(userId), loadLeadEmailIndex()]);

  return withImapSession(creds, async (open, client) => {
    let inbox: PhaseOutcome<PollResult>;
    try {
      const mailbox = await open(async () => "INBOX");
      inbox = { ok: true, result: await pollInboxOnClient(client, mailbox, userId, cursor) };
    } catch (e) {
      console.error(`email-inbound: inbox poll failed for user ${userId}:`, e);
      inbox = { ok: false, error: reason(e) };
    }

    let sent: PhaseOutcome<SentFileResult>;
    try {
      // Same session, second EXAMINE. The read-only guarantee is enforced per
      // open (see imapClient.ts), so reusing the connection cannot weaken it.
      await open(findSentMailbox);
      sent = { ok: true, result: await pollSentOnClient(client, fromAddress, index) };
    } catch (e) {
      // No recognisable Sent folder is not an outage: a failed entry here would keep the whole
      // job red and mute the streak alert for a real inbox failure.
      if (e instanceof MailboxNotFoundError) {
        sent = { ok: true, skipped: "no sent folder" };
      } else {
        console.error(`email-inbound: sent-folder poll failed for user ${userId}:`, e);
        sent = { ok: false, error: reason(e) };
      }
    }

    return { inbox, sent };
  });
}
