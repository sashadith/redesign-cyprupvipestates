// Weekly partner digest (partner portal phase 3d): week key, content model, e-mail. Pure, no I/O.
// Only the partner's own items are passed in; the mail carries no internal fields (no our-rate, no lead data).
import { cyprusDateParts } from "./creditNote";
import { publicProjectUrl } from "./clientDto";
import { PARTNER_LOCALES, dict, fmt, lookup, type PartnerLocale } from "./i18n";
import { greet, partnerBaseUrl, renderPartnerEmail, type BuiltEmail } from "./mail";

export const DIGEST_MAX_UPDATES = 10;
export const DIGEST_MAX_PROJECTS = 5;

/** ISO-8601 week of the Cyprus calendar date (Asia/Nicosia), e.g. "2026-W43". Weeks start on Monday. */
export function isoWeekKey(date: Date): string {
  const { year, month, day } = cyprusDateParts(date);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dow = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dow); // the Thursday of this week decides the year
  const isoYear = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(isoYear, 0, 1)) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

export type DigestUpdate = { clientName: string; key: string; vars?: Record<string, string>; at: Date };
export type DigestTotals = { expected: number; earned: number; developerPaid: number; paidOut: number };
export type DigestProject = { name: string; town: string | null; handoverRate: number | null; url: string };
export type DigestContent = { updates: DigestUpdate[]; totals: DigestTotals; newProjects: DigestProject[] };

/** null when there is nothing to report (no updates, all totals 0, no projects). Caps 10 updates / 5 projects. */
export function digestContent(input: { updates: DigestUpdate[]; totals: DigestTotals; newProjects: DigestProject[] }): DigestContent | null {
  const totalsSum = input.totals.expected + input.totals.earned + input.totals.developerPaid + input.totals.paidOut;
  if (!input.updates.length && totalsSum === 0 && !input.newProjects.length) return null;
  return {
    updates: input.updates.slice(0, DIGEST_MAX_UPDATES),
    totals: input.totals,
    newProjects: input.newProjects.slice(0, DIGEST_MAX_PROJECTS),
  };
}

export function buildDigestEmail(
  locale: PartnerLocale,
  p: { partnerFirstName: string; content: DigestContent; portalUrl: string; profileUrl: string },
): BuiltEmail {
  const d = dict(locale);
  const t = d.digest;
  const euro = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  const date = (at: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Asia/Nicosia" }).format(at);
  const { updates, totals, newProjects } = p.content;
  const sections: string[] = [];
  if (updates.length) {
    sections.push(
      [
        t.updatesTitle,
        ...updates.map((u) => {
          const label = fmt(lookup(locale, u.key) ?? lookup(locale, "stages.onHold")!, u.vars ?? {});
          return `• ${u.clientName.trim() || "—"}: ${label} (${date(u.at)})`;
        }),
      ].join("\n"),
    );
  }
  if (totals.expected + totals.earned + totals.developerPaid + totals.paidOut > 0) {
    sections.push(
      [
        t.totalsTitle,
        `• ${t.expected}: ${euro(totals.expected)}`,
        `• ${t.earned}: ${euro(totals.earned)}`,
        `• ${t.developerPaid}: ${euro(totals.developerPaid)}`,
        `• ${t.paidOut}: ${euro(totals.paidOut)}`,
      ].join("\n"),
    );
  }
  if (newProjects.length) {
    sections.push(
      [
        t.projectsTitle,
        ...newProjects.map((pr) => {
          const rate = pr.handoverRate == null ? t.onRequest : fmt(t.rate, { rate: pr.handoverRate });
          return `• ${[pr.name, pr.town].filter(Boolean).join(", ")} — ${rate}\n  ${pr.url}`;
        }),
      ].join("\n"),
    );
  }
  return renderPartnerEmail({
    subject: t.subject,
    greeting: greet(t.greeting, p.partnerFirstName),
    intro: t.intro,
    quote: sections.join("\n\n"),
    button: t.button,
    link: p.portalUrl,
    notes: [`${t.optOut}\n${p.profileUrl}`],
    signature: d.mail.signature,
  });
}

/** Portal profile page (the opt-out link target). */
export const digestProfileLink = (base: string = partnerBaseUrl()) => `${base}/profile`;

// ── Send planning (pure; the DB side is digestSend.ts) ──────────────────────

/** Errors that close a week's log row for good: never retried in the same week. */
export const DIGEST_NOTHING_NEW = "nothing new";
export const DIGEST_NO_RECIPIENT = "no recipient";
export const DIGEST_TERMINAL_ERRORS = [DIGEST_NOTHING_NEW, DIGEST_NO_RECIPIENT] as const;
/** Marker in `error` while a run holds the row (sentAt null). Never retried: the run may still be mailing. */
export const DIGEST_SENDING = "sending";

export function isTerminalDigestError(e: string | null | undefined): boolean {
  return !!e && (DIGEST_TERMINAL_ERRORS as readonly string[]).includes(e);
}

export type DigestLogState = { sentAt: Date | null; error: string | null };

/**
 * What to do with a partner's log row for this week:
 * - none → create (the unique (partnerId, weekKey) insert is the claim);
 * - sent, terminal, or held by a run ("sending") → skip;
 * - an earlier failure (sentAt null, other error, or none) → retry via a guarded update.
 */
export function digestLogAction(existing: DigestLogState | null | undefined): "create" | "retry" | "skip" {
  if (!existing) return "create";
  if (existing.sentAt) return "skip";
  if (isTerminalDigestError(existing.error) || existing.error === DIGEST_SENDING) return "skip";
  return "retry";
}

export type DigestCandidateRow = {
  id: string;
  status: string;
  digestOptIn: boolean;
  createdAt: Date;
  digestLogs: (DigestLogState & { weekKey: string })[];
};

/** Recipients of this week's run: ACTIVE, opted in, created before `now`, and this week's row not closed. */
export function digestCandidates<T extends DigestCandidateRow>(rows: T[], weekKey: string, now: Date): T[] {
  return rows.filter(
    (r) =>
      r.status === "ACTIVE" &&
      r.digestOptIn &&
      r.createdAt.getTime() < now.getTime() &&
      digestLogAction(r.digestLogs.find((l) => l.weekKey === weekKey)) !== "skip",
  );
}

/** Main-site project page in the partner's language (en without prefix; unknown/he → en). */
export function newProjectUrl(lang: string | null | undefined, slug: string): string {
  const locale = (PARTNER_LOCALES as readonly string[]).includes(lang ?? "") ? (lang as string) : "en";
  return publicProjectUrl(locale, slug)!;
}

/** PARTNER_DIGEST_START (ISO); null = unset/invalid → the job does nothing. */
export function digestStartFromEnv(env: Record<string, string | undefined>): Date | null {
  const s = env.PARTNER_DIGEST_START?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/** Overview commission stages → digest totals. */
export function digestTotals(t: { EXPECTED: number; EARNED: number; DEVELOPER_PAID: number; PAID_OUT: number }): DigestTotals {
  return { expected: t.EXPECTED, earned: t.EARNED, developerPaid: t.DEVELOPER_PAID, paidOut: t.PAID_OUT };
}
