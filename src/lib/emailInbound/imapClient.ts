// Read-only IMAP access for Phase 4 (email inbound) — this file exists to
// enforce ONE hard rule: Sascha's real mailbox, which he actively works in
// through Apple Mail, must never be modified by this system. No \Seen flag,
// no moves, no deletes, no flags of any kind.
//
// The guarantee is NOT "we politely avoid calling flag-changing methods" —
// it's that we open the mailbox with IMAP's EXAMINE command instead of
// SELECT (ImapFlow: `mailboxOpen(path, { readOnly: true })`). A mailbox
// opened via EXAMINE is read-only at the PROTOCOL level: a compliant IMAP
// server refuses any STORE/EXPUNGE/COPY/MOVE issued against it, regardless
// of what the client asks for. So even a bug in this code that tried to
// mark something read would be rejected by the server itself — this isn't
// client-side discipline alone.
//
// On top of that, as defense in depth, this module simply never imports or
// calls any of ImapFlow's mutating methods (messageFlagsAdd/Set/Remove,
// messageMove, messageCopy, messageDelete, mailboxOpen without readOnly).
// There is nothing in this file capable of writing to the mailbox even if
// the EXAMINE guarantee somehow weren't there.
import { ImapFlow } from "imapflow";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto/secretBox";

export class ImapNotConfiguredError extends Error {}

export type ImapCredentials = { host: string; port: number; user: string; pass: string };

export async function getImapCredentials(userId: string): Promise<ImapCredentials> {
  const row = await prisma.userEmailSettings.findUnique({ where: { userId } });
  if (!row?.imapHost || !row.imapPort || !row.imapUser || !row.imapPasswordEnc) {
    throw new ImapNotConfiguredError("IMAP is not configured for this user.");
  }
  return { host: row.imapHost, port: row.imapPort, user: row.imapUser, pass: decrypt(row.imapPasswordEnc) };
}

/**
 * Opens INBOX read-only (EXAMINE, not SELECT), runs `fn`, and always logs
 * out cleanly afterward — success or failure. `fn` receives the connected
 * client and the mailbox status (includes `uidValidity`/`uidNext`).
 */
export async function withReadOnlyInbox<T>(
  creds: ImapCredentials,
  fn: (client: ImapFlow, mailbox: Awaited<ReturnType<ImapFlow["mailboxOpen"]>>) => Promise<T>,
): Promise<T> {
  const client = new ImapFlow({
    host: creds.host,
    port: creds.port,
    secure: creds.port === 993,
    auth: { user: creds.user, pass: creds.pass },
    logger: false,
  });
  await client.connect();
  try {
    // The one line that matters: `readOnly: true` sends EXAMINE, not SELECT.
    const mailbox = await client.mailboxOpen("INBOX", { readOnly: true });
    // Hard assertion, not a comment-level promise: if the server (or a
    // future code change) ever results in a non-read-only mailbox, abort
    // before touching a single message rather than silently proceeding.
    // Verified live 2026-07-25 against the real mailbox: an unread test
    // message stayed unread (both server-side flags and in Apple Mail)
    // across an open+download+re-check cycle with this guard in place.
    if (client.mailbox && (client.mailbox as any).readOnly !== true) {
      throw new Error("IMAP mailbox did not open read-only (EXAMINE) — aborting without processing any message.");
    }
    return await fn(client, mailbox);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

export type FetchedMessage = { uid: number; source: Buffer; internalDate: Date | null };

export type FetchResult = {
  uidValidity: bigint;
  messages: FetchedMessage[];
  /** UIDVALIDITY changed (or this is the very first poll) — cursor was reset, no historical backfill performed. */
  cursorWasReset: boolean;
  /** The UID to persist as the new cursor once processing succeeds. */
  newLastUid: bigint;
};

/**
 * Fetches every message with UID strictly greater than `lastUid`, using the
 * SAME already-open (EXAMINE'd) client — never opens its own connection. If
 * `lastUidValidity` doesn't match the mailbox's current UIDVALIDITY (or is
 * null, meaning never polled before), the UID space has no relation to our
 * stored cursor: rather than guess and risk reprocessing or skipping a large
 * unknown range, we reset the cursor to "start from now" (mailbox.uidNext -
 * 1) with no historical backfill, and let normal polling pick up everything
 * from that point on.
 */
export async function fetchNewMessages(
  client: ImapFlow,
  mailbox: { uidValidity: bigint; uidNext: number },
  lastUid: bigint | null,
  lastUidValidity: bigint | null,
): Promise<FetchResult> {
  const uidValidityChanged = lastUidValidity == null || lastUidValidity !== mailbox.uidValidity;
  if (uidValidityChanged) {
    return { uidValidity: mailbox.uidValidity, messages: [], cursorWasReset: true, newLastUid: BigInt(mailbox.uidNext - 1) };
  }

  const startUid = lastUid! + BigInt(1);
  if (startUid >= BigInt(mailbox.uidNext)) {
    return { uidValidity: mailbox.uidValidity, messages: [], cursorWasReset: false, newLastUid: lastUid! };
  }

  const messages: FetchedMessage[] = [];
  let highestSeen = lastUid!;
  // `source: true` fetches the full raw RFC822 message. Because this client
  // is connected to a mailbox opened via EXAMINE (see withReadOnlyInbox
  // above), the server cannot set \Seen for this regardless — there is no
  // separate "peek" flag to set here, read-only-ness is a property of the
  // mailbox session itself, not of the individual fetch call.
  for await (const msg of client.fetch(`${startUid}:*`, { uid: true, source: true, internalDate: true }, { uid: true })) {
    if (!msg.source) continue;
    const internalDate = msg.internalDate ? new Date(msg.internalDate) : null;
    messages.push({ uid: msg.uid, source: msg.source, internalDate });
    if (BigInt(msg.uid) > highestSeen) highestSeen = BigInt(msg.uid);
  }

  return { uidValidity: mailbox.uidValidity, messages, cursorWasReset: false, newLastUid: highestSeen };
}
