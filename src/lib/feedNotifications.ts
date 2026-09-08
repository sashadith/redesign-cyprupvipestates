import { sendTelegramMessage } from "@/lib/telegram";
import { sendEmail } from "@/lib/sendEmail";
import { DEV_ACCOUNT } from "@/lib/feedSync";
import { absUrl } from "./indexnow";

/* Inventory-change notifications for the 4am feed-sync cron (see
   src/app/api/cron/feed-sync/route.ts) — the event-driven half of the
   "unlisted" scheme, docking into the existing generic sendTelegramMessage/
   sendEmail helpers (already used elsewhere, e.g. booking-reminders) rather
   than building new transport. All text here is admin/internal-facing (the
   Telegram group + Sascha's inbox), so English only per project convention —
   distinct from the client-facing src/app/c/[token]/copy.ts strings. */

export function devLabel(dev: string): string {
  return DEV_ACCOUNT[dev]?.name || dev;
}

export type RemovedUnitLine = {
  // Carried since the digest links each development; the sync's UnitChangeLine
  // has always provided it, the old count-only message just never used it.
  developmentId: string;
  development: string;
  ref: string;
  label: string;
};

const MAX_LISTED_LINES = 15;
const pluralUnit = (n: number) => (n === 1 ? "unit" : "units");

/* ── One digest, rendered three ways ────────────────────────────────────────
   The nightly run used to send a separate message per developer per event
   type, each carrying a bare count with no way to tell WHICH units without
   opening the admin and hunting. This builds a single message covering every
   developer, itemized and linked.

   Sections are ordered by what they ask of the reader:
     1. blocked      — nothing was written, needs a decision
     2. new projects — saved as drafts, only YOU can put them on the site
     3. removed      — the live catalogue already changed, nothing to do
     4. new units    — already live, nothing to do, shown to spot-check

   The order matters more than it looks. Sections 3 and 4 are reports; only
   1 and 2 are work. An earlier version put "publish these" wording on new
   units, which was wrong in every case: unitsCreatedLines is only ever
   populated on the publishStatus === "published" branch of syncOneProject,
   so a listed unit is by construction already on the site. Verified against
   production on 2026-09-08 (Eden Golf C202, Synergy 4.40/4.48/4.51 were all
   live within the hour the email called them "not live yet").

   One model, three renderers. Telegram takes a narrow HTML subset with no
   block tags, email takes a real document, and text is the fallback that
   also has to stay readable on its own — writing the sections three times
   is how they drift apart, so they are built once as data. */

export type NewUnitLine = RemovedUnitLine;
export type NewProjectLine = { developmentId: string; name: string };

export type FeedDigestInput = {
  newProjects: { dev: string; projects: NewProjectLine[] }[];
  newUnits: { dev: string; lines: NewUnitLine[] }[];
  removed: { dev: string; lines: RemovedUnitLine[]; nowSoldOut: string[] }[];
  blocked: { dev: string; missing: number; total: number; message?: string }[];
};

const devUrl = (dev: string) => absUrl(`/admin/developments?dev=${encodeURIComponent(dev)}`);
const projectUrl = (id: string) => absUrl(`/admin/developments/${id}`);

/** Groups a developer's unit lines by development, preserving first-seen order. */
function byDevelopment<T extends RemovedUnitLine>(lines: T[]) {
  const out = new Map<string, { name: string; id: string; lines: T[] }>();
  for (const l of lines) {
    const hit = out.get(l.developmentId);
    if (hit) hit.lines.push(l);
    else out.set(l.developmentId, { name: l.development, id: l.developmentId, lines: [l] });
  }
  return Array.from(out.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// The shape every renderer reads. A group is one linked thing (a project, or
// a developer's feed); its lines are the units under it.
type DigestGroup = { title: string; url: string; lines: string[]; more: number };
type DigestDev = { label: string; groups: DigestGroup[]; notes: string[] };
type DigestSection = { icon: string; title: string; note: string; devs: DigestDev[] };

const sortByDev = <T extends { dev: string }>(xs: T[]) => [...xs].sort((a, b) => devLabel(a.dev).localeCompare(devLabel(b.dev)));

/** Shared builder for the two unit sections (removed, new) — identical shape,
    different wording, so they must not be two near-copies of the same loop. */
function unitSection(
  icon: string,
  title: string,
  note: string,
  blocks: { dev: string; lines: RemovedUnitLine[]; nowSoldOut?: string[] }[],
): DigestSection | null {
  const devs: DigestDev[] = [];
  for (const d of sortByDev(blocks)) {
    if (!d.lines.length) continue;
    const groups: DigestGroup[] = byDevelopment(d.lines).map((g) => ({
      title: `${g.name} (${g.lines.length})`,
      url: projectUrl(g.id),
      lines: g.lines.slice(0, MAX_LISTED_LINES).map((l) => l.label || l.ref),
      more: Math.max(0, g.lines.length - MAX_LISTED_LINES),
    }));
    devs.push({
      label: devLabel(d.dev),
      groups,
      notes: (d.nowSoldOut ?? []).map((n) => `${n} now shows as sold out.`),
    });
  }
  return devs.length ? { icon, title, note, devs } : null;
}

function buildSections(input: FeedDigestInput): DigestSection[] {
  const sections: DigestSection[] = [];

  if (input.blocked.length) {
    sections.push({
      icon: "⛔",
      title: `NEEDS A DECISION — ${input.blocked.length} feed${input.blocked.length === 1 ? "" : "s"} refused`,
      note: "Nothing was written for these. The sync will keep refusing until the feed recovers or you clear it.",
      devs: sortByDev(input.blocked).map((b) => ({
        label: devLabel(b.dev),
        groups: [{
          title: `${b.missing} of ${b.total} units missing (${b.total > 0 ? Math.round((b.missing / b.total) * 100) : 0} %)`,
          url: devUrl(b.dev),
          lines: [],
          more: 0,
        }],
        notes: [],
      })),
    });
  }

  const projectTotal = input.newProjects.reduce((n, d) => n + d.projects.length, 0);
  if (projectTotal) {
    sections.push({
      icon: "\u{1F195}",
      title: `NEW PROJECTS — ${projectTotal} awaiting your review`,
      note: "Saved as drafts, not on the site. Open each one, check the content, then publish it.",
      devs: sortByDev(input.newProjects)
        .filter((d) => d.projects.length)
        .map((d) => ({
          label: devLabel(d.dev),
          groups: [...d.projects]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((pr) => ({ title: pr.name, url: projectUrl(pr.developmentId), lines: [], more: 0 })),
          notes: [],
        })),
    });
  }

  const removed = unitSection(
    "\u{1F4E4}",
    `REMOVED FROM THE CATALOGUE — ${input.removed.reduce((n, d) => n + d.lines.length, 0)} ${pluralUnit(input.removed.reduce((n, d) => n + d.lines.length, 0))}`,
    "Already hidden from the public site. They return automatically if the developer lists them again.",
    input.removed,
  );
  if (removed) sections.push(removed);

  const newTotal = input.newUnits.reduce((n, d) => n + d.lines.length, 0);
  const added = unitSection(
    "➕",
    `NEW UNITS — ${newTotal} already live`,
    "No action needed — these went live with the sync. Listed so you can spot-check price, area and photos.",
    input.newUnits.map((d) => ({ dev: d.dev, lines: d.lines })),
  );
  if (added) sections.push(added);

  return sections;
}

// ── Renderers ──────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function renderText(sections: DigestSection[]): string {
  const out: string[] = [];
  for (const s of sections) {
    out.push(`${s.icon} ${s.title}`);
    out.push(`   ${s.note}`);
    for (const d of s.devs) {
      out.push("");
      out.push(`   ${d.label}`);
      for (const g of d.groups) {
        out.push(`      ${g.title}`);
        out.push(`      ${g.url}`);
        for (const l of g.lines) out.push(`         · ${l}`);
        if (g.more) out.push(`         … and ${g.more} more`);
      }
      for (const n of d.notes) out.push(`      ${n}`);
    }
    out.push("");
    out.push("");
  }
  return out.join("\n").trimEnd();
}

/* Telegram's HTML is a narrow subset: inline tags only, no block elements,
   no lists — layout is literal newlines and spaces. It also parses EVERY
   message as HTML (parse_mode is always on in sendTelegramMessage), so an
   unescaped developer name like "G&V Hadjidemosthenous" is a parse failure
   waiting to happen, not a cosmetic issue. */
function renderTelegram(sections: DigestSection[]): string {
  const out: string[] = [];
  for (const s of sections) {
    out.push(`${s.icon} <b>${esc(s.title)}</b>`);
    out.push(`<i>${esc(s.note)}</i>`);
    for (const d of s.devs) {
      out.push("");
      out.push(`<b>${esc(d.label)}</b>`);
      for (const g of d.groups) {
        out.push(`  • <a href="${esc(g.url)}">${esc(g.title)}</a>`);
        for (const l of g.lines) out.push(`     · ${esc(l)}`);
        if (g.more) out.push(`     … and ${g.more} more`);
      }
      for (const n of d.notes) out.push(`  ${esc(n)}`);
    }
    out.push("");
  }
  return out.join("\n").trimEnd();
}

/* Telegram rejects anything over 4096 characters outright, and this digest
   grows with the catalogue — a developer's first import can list dozens of
   projects at once. Rather than let sendMessage throw (which would lose the
   whole notification), drop the unit-level detail first, since the project
   links alone still get the reader to the right place. */
const TELEGRAM_LIMIT = 3900;
function fitTelegram(sections: DigestSection[]): string {
  const full = renderTelegram(sections);
  if (full.length <= TELEGRAM_LIMIT) return full;
  const trimmed = sections.map((s) => ({
    ...s,
    devs: s.devs.map((d) => ({ ...d, groups: d.groups.map((g) => ({ ...g, lines: [], more: 0 })) })),
  }));
  const short = renderTelegram(trimmed);
  const note = "\n\n<i>Shortened to fit Telegram — the full list is in the email.</i>";
  if (short.length + note.length <= TELEGRAM_LIMIT) return short + note;
  return short.slice(0, TELEGRAM_LIMIT - note.length).replace(/\n[^\n]*$/, "") + note;
}

function renderEmailHtml(sections: DigestSection[]): string {
  const P = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const out: string[] = [
    `<div style="${P};font-size:15px;line-height:1.5;color:#111827;max-width:640px;margin:0 auto;padding:8px 4px">`,
  ];
  for (const s of sections) {
    out.push(`<div style="margin:0 0 28px">`);
    out.push(
      `<div style="font-size:15px;font-weight:600;letter-spacing:.02em;color:#111827;padding:0 0 2px">${s.icon} ${esc(s.title)}</div>`,
    );
    out.push(`<div style="font-size:13px;color:#6B7280;padding:0 0 12px">${esc(s.note)}</div>`);
    for (const d of s.devs) {
      out.push(
        `<div style="border-left:3px solid #E5E7EB;padding:2px 0 2px 14px;margin:0 0 14px">`,
        `<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#6B7280;padding:0 0 6px">${esc(d.label)}</div>`,
      );
      for (const g of d.groups) {
        out.push(
          `<div style="padding:0 0 8px">`,
          `<a href="${esc(g.url)}" style="color:#1B4B43;font-weight:600;text-decoration:none">${esc(g.title)}</a>`,
        );
        if (g.lines.length) {
          out.push(`<div style="font-size:13px;color:#4B5563;padding:3px 0 0">`);
          for (const l of g.lines) out.push(`<div style="padding:1px 0">· ${esc(l)}</div>`);
          if (g.more) out.push(`<div style="padding:1px 0;color:#6B7280">… and ${g.more} more</div>`);
          out.push(`</div>`);
        }
        out.push(`</div>`);
      }
      for (const n of d.notes) out.push(`<div style="font-size:13px;color:#4B5563;padding:0 0 6px">${esc(n)}</div>`);
      out.push(`</div>`);
    }
    out.push(`</div>`);
  }
  out.push(`</div>`);
  return out.join("");
}

export function buildFeedDigestMessage(
  input: FeedDigestInput,
): { subject: string; text: string; html: string; telegram: string } | null {
  const sections = buildSections(input);
  if (!sections.length) return null;

  // The subject has to survive a phone's notification line, so it carries the
  // counts in the order the body uses them and nothing else.
  const newProjectTotal = input.newProjects.reduce((n, d) => n + d.projects.length, 0);
  const removedTotal = input.removed.reduce((n, d) => n + d.lines.length, 0);
  const newTotal = input.newUnits.reduce((n, d) => n + d.lines.length, 0);
  const bits: string[] = [];
  if (input.blocked.length) bits.push(`${input.blocked.length} feed${input.blocked.length === 1 ? "" : "s"} refused`);
  if (newProjectTotal) bits.push(`${newProjectTotal} new project${newProjectTotal === 1 ? "" : "s"}`);
  if (removedTotal) bits.push(`${removedTotal} removed`);
  if (newTotal) bits.push(`${newTotal} new ${pluralUnit(newTotal)}`);

  return {
    subject: `Feed sync: ${bits.join(", ")}`,
    text: renderText(sections),
    html: renderEmailHtml(sections),
    telegram: fitTelegram(sections),
  };
}


// Drive-sync failure (2026-08-11, Olias incident) — `dev` here is already the
// DeveloperAccount's own display name (e.g. "Olias Homes (drive)"), not a
// feed-sync dev-key, so unlike the messages above this does NOT go through
// devLabel()/DEV_ACCOUNT (that map is keyed by feed-sync's short slugs and
// wouldn't recognize a Drive developer's name). Throttled by
// shouldNotifyFailureStreak (src/lib/cronLog.ts) — fires once when the
// failure starts, then at most weekly while it continues, per developer.
export function buildDriveSyncFailureMessage(dev: string, message: string): { subject: string; text: string } | null {
  if (!message) return null;
  const text = [
    `🔌 ${dev} — Drive sync failed`,
    message,
    `It will keep retrying automatically (daily). You'll only be notified again if it's still failing in a week.`,
  ].join("\n");
  return { subject: `${dev}: Drive sync failed`, text };
}

// Generic per-cron-job failure notification (2026-08-13, GROSSER AUFTRAG
// Teil 4) — for cron routes with a single linear pipeline or a simple
// partial-failure summary, where a bespoke per-developer message (like
// buildDriveSyncFailureMessage's) isn't worth the extra code. Same throttle
// contract as every other failure message here: caller checks
// shouldNotifyFailureStreak first, calls markFailureStreakNotified after.
export function buildCronFailureMessage(job: string, message: string): { subject: string; text: string } {
  const text = [
    `⚠️ ${job} — cron failed`,
    message,
    `It will keep retrying automatically on its normal schedule. You'll only be notified again if it's still failing in a week.`,
  ].join("\n");
  return { subject: `${job}: cron failed`, text };
}

/* opts carries the richer bodies when the caller has them (only the feed
   digest does today). Without them the plain text is HTML-escaped before it
   reaches Telegram: sendTelegramMessage always sets parse_mode HTML, so an
   error string containing "<" or "&" — a cron failure message quoting a URL
   or a developer name like "G&V Hadjidemosthenous" — would otherwise be
   swallowed or rejected outright. The 11 failure-message callers get that
   fix for free by passing nothing. */
export async function sendFeedNotification(
  text: string,
  subject: string,
  opts: { html?: string; telegram?: string } = {},
): Promise<void> {
  await sendTelegramMessage(opts.telegram ?? esc(text));
  await sendEmail({ subject, text, ...(opts.html ? { html: opts.html } : {}) });
}
