import type { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import { applyFollowUpCadence } from "@/lib/crm/followUpCadence";
import { stripHtmlToText } from "@/lib/emailSignature";
import { canonicalizeEmail } from "./matchLead";
import { stripHtmlBlockquotes, stripQuotedReply, stripSignatureBlock } from "./quoteStrip";

/**
 * Mail the operator sent from their own mail program → EMAIL_OUT on the lead's timeline (2026-10-29).
 *
 * The inbox poll only ever saw the client's side. A mail written in Apple Mail / webmail to a lead
 * was invisible: no timeline row, no "real contact" for the SLA alerts and the follow-up cadence.
 * The Sent folder is read like the inbox — EXAMINE, never a flag or a move (see imapClient.ts).
 *
 * No cursor column: the poll re-reads a short window by date and the Message-ID (unique on
 * LeadInteraction) makes every repeat a no-op. A mail the CRM itself sent is already on file under
 * the same Message-ID, so it is never doubled either.
 */

export type LeadEmailIndex = Map<string, { leadId: string; rank: number }[]>;

/** Canonical lead address → leads, most recently active first (same tie-break as the inbound match). */
export async function loadLeadEmailIndex(): Promise<LeadEmailIndex> {
  const leads = await prisma.lead.findMany({
    where: { deletedAt: null, email: { not: null } },
    select: { id: true, email: true, createdAt: true, interactions: { select: { occurredAt: true }, orderBy: { occurredAt: "desc" }, take: 1 } },
  });
  const index: LeadEmailIndex = new Map();
  for (const l of leads) {
    const key = canonicalizeEmail(l.email);
    if (!key) continue;
    const rank = (l.interactions[0]?.occurredAt ?? l.createdAt).getTime();
    index.set(key, [...(index.get(key) ?? []), { leadId: l.id, rank }].sort((a, b) => b.rank - a.rank));
  }
  return index;
}

type Addr = { address?: string | null };

/**
 * The lead a sent mail was addressed to: the first To address that is a lead, else the first Cc.
 * Never the operator's own address (a copy to self is not contact with anyone).
 */
export function leadForRecipients(
  to: Addr[] | undefined,
  cc: Addr[] | undefined,
  index: LeadEmailIndex,
  ownAddress: string | null,
): { leadId: string; ambiguous: boolean } | null {
  const own = canonicalizeEmail(ownAddress);
  for (const group of [to ?? [], cc ?? []]) {
    for (const a of group) {
      const key = canonicalizeEmail(a.address);
      if (!key || key === own) continue;
      const hits = index.get(key);
      if (hits?.length) return { leadId: hits[0].leadId, ambiguous: hits.length > 1 };
    }
  }
  return null;
}

export type SentFileOpts = { live: boolean; ownAddress: string | null; index: LeadEmailIndex };
export type SentFileResult = { scanned: number; filed: number };

const MAX_BODY_LENGTH = 10_000;
const CADENCE_GAP_MS = 12 * 3_600_000;

/**
 * Files the sent mails among `uids` (in the already-open, read-only Sent mailbox) that went to a lead.
 * Envelopes first, so the full source is only downloaded for mail that will actually be filed.
 */
export async function fileSentMessages(client: ImapFlow, uids: number[], opts: SentFileOpts): Promise<SentFileResult> {
  if (uids.length === 0) return { scanned: 0, filed: 0 };
  const candidates: SentCandidate[] = [];
  for await (const m of client.fetch(uids, { uid: true, envelope: true }, { uid: true })) {
    const env = m.envelope;
    const messageId = env?.messageId;
    if (!env || !messageId) continue;
    const lead = leadForRecipients(env.to, env.cc, opts.index, opts.ownAddress);
    if (lead) candidates.push({ uid: m.uid, messageId, ...lead });
  }

  let filed = 0;
  for (const c of candidates) {
    try {
      if (await fileOneSent(client, c, opts)) filed++;
    } catch (e) {
      // One unreadable mail must not fail every poll for the two days it stays in the window.
      console.error(`sent-mail: UID ${c.uid} not filed:`, e instanceof Error ? e.message : e);
    }
  }
  return { scanned: uids.length, filed };
}

type SentCandidate = { uid: number; leadId: string; ambiguous: boolean; messageId: string };

async function fileOneSent(client: ImapFlow, c: SentCandidate, opts: SentFileOpts): Promise<boolean> {
  if (await prisma.leadInteraction.findFirst({ where: { messageId: c.messageId }, select: { id: true } })) return false;
  const msg = await client.fetchOne(String(c.uid), { source: true, internalDate: true }, { uid: true });
  if (!msg || !msg.source) return false;
  const parsed = await simpleParser(msg.source);
  let rawText = parsed.text ?? "";
  if (!rawText && parsed.html) rawText = stripHtmlToText(stripHtmlBlockquotes(parsed.html));
  const body = stripSignatureBlock(stripQuotedReply(rawText)).slice(0, MAX_BODY_LENGTH);
  const attachmentCount = parsed.attachments?.length ?? 0;
  const validDate = (d: Date | null | undefined) => (d && !Number.isNaN(d.getTime()) ? d : null);
  const occurredAt = validDate(parsed.date) ?? validDate(msg.internalDate ? new Date(msg.internalDate) : null) ?? new Date();

  const contactBefore = opts.live
    ? !!(await prisma.leadInteraction.findFirst({
        where: { leadId: c.leadId, type: { in: ["CALL", "WHATSAPP_OUT", "EMAIL_OUT"] }, occurredAt: { gte: new Date(occurredAt.getTime() - CADENCE_GAP_MS) } },
        select: { id: true },
      }))
    : true;

  try {
    await prisma.leadInteraction.create({
      data: {
        leadId: c.leadId,
        type: "EMAIL_OUT",
        direction: "OUTBOUND",
        channel: "EMAIL",
        subject: parsed.subject ?? null,
        body: attachmentCount > 0 ? `${body}\n\n[${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}]` : body,
        occurredAt,
        // Stored like a CRM send's, so the client's reply threads back to this lead (matchLead.ts).
        messageId: c.messageId,
        metadata: { via: opts.live ? "imap-sent" : "imap-sync", sentFromMailbox: true, attachmentCount, ...(c.ambiguous ? { ambiguousRecipientMatch: true } : {}) },
      },
    });
  } catch (e) {
    // P2002: a parallel run filed the same Message-ID a moment ago. Nothing to do.
    if ((e as { code?: string })?.code === "P2002") return false;
    throw e;
  }
  if (!contactBefore) await applyFollowUpCadence(c.leadId, "manual_contact", { leadReacted: false });
  return true;
}

/** UIDs of the open mailbox matching an IMAP search (empty when nothing matches). */
export async function searchUids(client: ImapFlow, query: Parameters<ImapFlow["search"]>[0]): Promise<number[]> {
  const r = await client.search(query, { uid: true });
  return Array.isArray(r) ? r : [];
}
