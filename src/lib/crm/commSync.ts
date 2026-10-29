import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import { createOpenWaClient } from "@/lib/openwa/client";
import { chatIdFor } from "@/lib/openwa/phoneMatch";
import { realTrackDeps, trackWhatsAppMessage, type TrackDeps, type WaMessage } from "@/lib/openwa/trackMessage";
import { findSentMailbox, getImapCredentials, withReadOnlyMailbox } from "@/lib/emailInbound/imapClient";
import { fileInboundEmail } from "@/lib/emailInbound/processInbound";
import { fileSentMessages, loadLeadEmailIndex, searchUids, type SentFileResult } from "@/lib/emailInbound/sentMail";

/**
 * Pulling a lead's WhatsApp and email history into the timeline on demand (cockpit "Sync") and for
 * the one-off backfill after the @lid outage (2026-10-29). Everything here writes history only:
 * no Telegram, no follow-up cadence — those belong to the live webhook/poll paths.
 */

const THREAD_LIMIT = 200;
const SYNC_DAYS = 120;
const LIVE_SENT_DAYS = 2;
const DAY_MS = 86_400_000;

export type WaSyncResult = { ok: true; logged: number; linked: number } | { ok: false; error: string };
export type MailSyncResult = { ok: true; inbound: number; outbound: number; mailboxes: number } | { ok: false; error: string };

/** A dry-run wrapper: counts what would be written, writes nothing. */
export function dryRunDeps(deps: TrackDeps): TrackDeps {
  return { ...deps, linkMessageId: async () => {}, create: async () => {}, applyCadence: async () => {} };
}

export async function syncLeadWhatsApp(phone: string | null, opts: { dryRun?: boolean } = {}): Promise<WaSyncResult> {
  const chatId = chatIdFor(phone);
  if (!chatId) return { ok: false, error: "No usable phone number." };
  try {
    const client = createOpenWaClient();
    const raw = (await client.fetchThread(chatId, THREAD_LIMIT)) as unknown as WaMessage[];
    const base = realTrackDeps((jid) => client.resolvePhone(jid));
    const deps = opts.dryRun ? dryRunDeps(base) : base;
    let logged = 0, linked = 0;
    for (const m of raw.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))) {
      const r = await trackWhatsAppMessage(m, { live: false, via: "openwa-sync" }, deps);
      if (r.status === "logged") logged++;
      else if (r.status === "linked") linked++;
    }
    return { ok: true, logged, linked };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "WhatsApp gateway error." };
  }
}

async function configuredMailboxes() {
  return prisma.userEmailSettings.findMany({
    where: { imapHost: { not: null }, imapUser: { not: null }, imapPasswordEnc: { not: null } },
    select: { userId: true, fromAddress: true },
  });
}

/** One lead's mail in every configured mailbox, inbox and sent folder, last SYNC_DAYS days. */
export async function syncLeadEmail(email: string | null): Promise<MailSyncResult> {
  const address = (email ?? "").trim();
  if (!address) return { ok: false, error: "No email address." };
  const since = new Date(Date.now() - SYNC_DAYS * DAY_MS);
  let inbound = 0, outbound = 0;
  try {
    const boxes = await configuredMailboxes();
    const index = await loadLeadEmailIndex();
    for (const box of boxes) {
      const creds = await getImapCredentials(box.userId);
      inbound += await withReadOnlyMailbox(creds, async () => "INBOX", async (client) => {
        let n = 0;
        for (const uid of await searchUids(client, { from: address, since })) {
          const msg = await client.fetchOne(String(uid), { source: true, internalDate: true }, { uid: true });
          if (!msg || !msg.source) continue;
          const r = await fileInboundEmail(await simpleParser(msg.source), msg.internalDate ? new Date(msg.internalDate) : null, { ownFromAddress: box.fromAddress, notify: false });
          if (r.status === "filed") n++;
        }
        return n;
      });
      const sent = await withReadOnlyMailbox(creds, findSentMailbox, async (client) => {
        const uids = await searchUids(client, { or: [{ to: address }, { cc: address }], since });
        return fileSentMessages(client, uids, { live: false, ownAddress: box.fromAddress, index });
      });
      outbound += sent.filed;
    }
    return { ok: true, inbound, outbound, mailboxes: boxes.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Mailbox error." };
  }
}

/** The live poll's share: mail sent from this user's mailbox in the last LIVE_SENT_DAYS days. */
export async function pollSentForUser(userId: string, fromAddress: string | null): Promise<SentFileResult> {
  const creds = await getImapCredentials(userId);
  const index = await loadLeadEmailIndex();
  return withReadOnlyMailbox(creds, findSentMailbox, async (client) => {
    const uids = await searchUids(client, { since: new Date(Date.now() - LIVE_SENT_DAYS * DAY_MS) });
    return fileSentMessages(client, uids, { live: true, ownAddress: fromAddress, index });
  });
}

/** Backfill: every configured mailbox's Sent folder for the last `days` days (history only). */
export async function backfillSentMail(days: number): Promise<SentFileResult> {
  const index = await loadLeadEmailIndex();
  let scanned = 0, filed = 0;
  for (const box of await configuredMailboxes()) {
    const creds = await getImapCredentials(box.userId);
    const r = await withReadOnlyMailbox(creds, findSentMailbox, async (client) => {
      const uids = await searchUids(client, { since: new Date(Date.now() - days * DAY_MS) });
      return fileSentMessages(client, uids, { live: false, ownAddress: box.fromAddress, index });
    });
    scanned += r.scanned;
    filed += r.filed;
  }
  return { scanned, filed };
}
