import { prisma } from "@/lib/prisma";
import { canonicalizeEmail } from "./matchLead";

// Which developer registration does an email in the office inbox answer?
// (spec 2026-10-27 §7.6, §12.2). First by thread headers against the
// Message-ID of our registration email, then by sender among developers with
// a registration still waiting for an answer (status SENT).

export type RegCandidate = { registrationId: string; leadId: string; developerAccountId: string; developerName: string; addresses: string[] };
// matchedBy: "header" = a reply in our registration thread; "sender" = only the
// sender fits, so the email may well be about another client.
export type RegistrationReplyMatch =
  | { kind: "single"; registrationId: string; leadId: string; developerName: string; matchedBy: "header" | "sender" }
  | { kind: "several"; candidates: { registrationId: string; leadId: string }[] };

// A shared mailbox provider says nothing about who the sender works for, so
// these domains only ever match by exact address, never by domain.
export const PUBLIC_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "live.co.uk", "msn.com",
  "yahoo.com", "yahoo.co.uk", "ymail.com", "aol.com", "icloud.com", "me.com", "mac.com", "proton.me", "protonmail.com",
  // Cyprus ISPs — small developers use these
  "cytanet.com.cy", "primehome.com", "cablenet.com.cy", "logosnet.cy.net",
  // client markets
  "gmx.de", "gmx.net", "gmx.at", "web.de", "t-online.de", "freenet.de", "posteo.de",
  "wp.pl", "o2.pl", "onet.pl", "interia.pl", "op.pl", "gazeta.pl",
  "mail.ru", "bk.ru", "list.ru", "inbox.ru", "yandex.ru", "yandex.com", "ya.ru", "rambler.ru",
]);

const domainOf = (a: string) => a.slice(a.lastIndexOf("@") + 1);

export function pickBySender(sender: string, sentCandidates: RegCandidate[]): { kind: "single"; c: RegCandidate } | { kind: "several"; cs: RegCandidate[] } | null {
  const from = canonicalizeEmail(sender);
  if (!from.includes("@")) return null;
  let hits = sentCandidates.filter((c) => c.addresses.some((a) => canonicalizeEmail(a) === from));
  if (hits.length === 0) {
    const domain = domainOf(from);
    if (PUBLIC_MAIL_DOMAINS.has(domain)) return null;
    hits = sentCandidates.filter((c) => c.addresses.some((a) => domainOf(canonicalizeEmail(a)) === domain));
  }
  if (hits.length === 0) return null;
  return hits.length === 1 ? { kind: "single", c: hits[0] } : { kind: "several", cs: hits };
}

const metaRegistrationId = (m: unknown): string | null => {
  const v = m && typeof m === "object" ? (m as { registrationId?: unknown }).registrationId : undefined;
  return typeof v === "string" ? v : null;
};

export async function matchRegistrationReply(o: { inReplyTo: string | null; references: string[]; fromAddress: string }): Promise<RegistrationReplyMatch | null> {
  const ids = [o.inReplyTo, ...o.references].filter((id): id is string => !!id);
  for (const messageId of ids) {
    // Our registration email, or a developer reply we stored (a follow-up in that thread).
    const hit = await prisma.leadInteraction.findFirst({
      where: { messageId, type: "SYSTEM", OR: [
        { metadata: { path: ["kind"], equals: "developer_registration" } },
        { metadata: { path: ["kind"], equals: "developer_registration_reply" } },
      ] },
      select: { leadId: true, metadata: true },
    });
    const registrationId = hit ? metaRegistrationId(hit.metadata) : null;
    if (!hit || !registrationId) continue;
    const reg = await prisma.developerRegistration.findUnique({ where: { id: registrationId }, select: { developerAccount: { select: { name: true } } } });
    if (reg) return { kind: "single", registrationId, leadId: hit.leadId, developerName: reg.developerAccount.name, matchedBy: "header" };
  }

  const waiting = await prisma.developerRegistration.findMany({
    where: { status: "SENT", channel: "EMAIL", lead: { deletedAt: null } },
    select: { id: true, leadId: true, developerAccountId: true, developerAccount: { select: { name: true, registrationEmailTo: true, registrationEmailCc: true } } },
  });
  const picked = pickBySender(o.fromAddress, waiting.map((r) => ({
    registrationId: r.id, leadId: r.leadId, developerAccountId: r.developerAccountId, developerName: r.developerAccount.name,
    addresses: [...r.developerAccount.registrationEmailTo, ...r.developerAccount.registrationEmailCc],
  })));
  if (!picked) return null;
  if (picked.kind === "single") return { kind: "single", registrationId: picked.c.registrationId, leadId: picked.c.leadId, developerName: picked.c.developerName, matchedBy: "sender" };
  return { kind: "several", candidates: picked.cs.map((c) => ({ registrationId: c.registrationId, leadId: c.leadId })) };
}
