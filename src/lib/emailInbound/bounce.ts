// Delivery failure reports in the operator's mailbox (2026-11-04). Until now the poller fetched them
// and skipped them — the sender is mailer-daemon, which matches no lead — so a dead address stayed
// invisible. Pure: reads what mailparser gives and says whether this is a HARD bounce, for which
// address, and (when the report carries the original headers) which of our messages it was.
//
// Only permanent failures count: a DSN Status 5.x.x, or an SMTP 550/551/553/5.1.x reply, or the
// usual "user unknown" wordings. A 4.x.x (mailbox full, try again) is not a dead address.

export type BounceInput = {
  from: string | null;
  subject: string | null;
  text: string | null;
  failedRecipientsHeader: string | null;
  contentType: string | null;
  attachments: { contentType: string; content: string }[];
};

/** structured: a real delivery report (multipart/report or a delivery-status part), not just a
 *  daemon-looking sender and subject, which anyone can forge. */
export type Bounce = { recipient: string | null; status: string | null; reason: string; originalMessageId: string | null; structured: boolean };

const DAEMON = /^(mailer-daemon|postmaster|mail-daemon|mailerdaemon)@/i;
const SUBJECT = /(undeliver|delivery status notification \(failure\)|mail delivery (failed|failure|subsystem)|returned mail|failure notice|delivery has failed|nicht zustellbar|unzustellbar)/i;
const HARD_TEXT = /(\b55[0-4]\b|\b5\.[1-7]\.\d{1,3}\b|user unknown|unknown user|no such user|does not exist|address not found|recipient address rejected|mailbox unavailable|invalid recipient|account (has been )?disabled|address couldn'?t be found)/i;
const SOFT_STATUS = /^4\./;
const EMAIL = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

function field(text: string, name: string): string | null {
  const m = new RegExp(`^${name}:\\s*(.+)$`, "im").exec(text);
  return m ? m[1].trim() : null;
}

const isStructured = (b: BounceInput) =>
  (/multipart\/report/i.test(b.contentType ?? "") && /delivery-status/i.test(b.contentType ?? "")) || b.attachments.some((a) => /message\/delivery-status/i.test(a.contentType));

export function isBounceReport(b: BounceInput): boolean {
  return isStructured(b) || (DAEMON.test(b.from ?? "") && SUBJECT.test(b.subject ?? ""));
}

/** A hard bounce, or null (not a bounce, or only a temporary failure). */
export function parseBounce(b: BounceInput): Bounce | null {
  if (!isBounceReport(b)) return null;
  const text = b.text ?? "";
  // mailparser folds a message/delivery-status part into the text; some clients keep it apart.
  const dsn = b.attachments.find((a) => /message\/delivery-status/i.test(a.contentType))?.content ?? text;
  const original = b.attachments.find((a) => /message\/rfc822|text\/rfc822-headers/i.test(a.contentType))?.content ?? "";

  const status = field(dsn, "Status");
  const diagnostic = field(dsn, "Diagnostic-Code");
  if (status && SOFT_STATUS.test(status)) return null;
  const hard = (status && /^5\./.test(status)) || HARD_TEXT.test(diagnostic ?? "") || HARD_TEXT.test(text);
  if (!hard) return null;

  const fromDsn = field(dsn, "Final-Recipient") ?? field(dsn, "Original-Recipient");
  const recipient = (b.failedRecipientsHeader?.match(EMAIL)?.[0] ?? fromDsn?.match(EMAIL)?.[0] ?? text.match(EMAIL)?.[0] ?? null)?.toLowerCase() ?? null;
  const idLine = field(original, "Message-ID") ?? field(text, "Message-ID");
  const originalMessageId = idLine?.match(/<[^>]+>/)?.[0] ?? null;
  const reason = (diagnostic ?? text.split("\n").map((l) => l.trim()).find((l) => HARD_TEXT.test(l)) ?? status ?? "Permanent delivery failure")
    .replace(/^smtp;\s*/i, "").slice(0, 300);
  return { recipient, status, reason, originalMessageId, structured: isStructured(b) };
}
