// Partner Telegram bot (partner portal phase 3e). Pure, no I/O: command parsing, link codes, channel
// routing, reply and notification texts, chat rate limit. The Bot API calls live in telegramApi.ts.
// Every outgoing text is Telegram HTML (parse_mode HTML): only <b>, <i> and <a href> are emitted, and
// every dynamic value is HTML-escaped. Texts carry only what the portal shows the partner.
import { randomInt } from "node:crypto";
import { dict, fmt, lookup, type PartnerLocale } from "./i18n";
import { escapeHtml } from "./mail";
import { formatShare, unhandledKind, type NotificationKind } from "./notify";
import { makeThrottle } from "./throttle";
import { hashToken } from "./tokens";

// ── Commands ────────────────────────────────────────────────────────────────

export const BOT_COMMANDS = ["start", "menu", "status", "commission", "help", "stop"] as const;
export type BotCommand = (typeof BOT_COMMANDS)[number] | "unknown";

const MAX_COMMAND_CHARS = 200;
const COMMAND_RE = /^\/([A-Za-z]+)(?:@[A-Za-z0-9_]{1,64})?(?:\s+([\s\S]*))?$/;

/** "/start CODE", "/status@BotName", case-insensitive. Anything else (or longer than 200 chars) is "unknown". */
export function parseBotCommand(text: string): { cmd: BotCommand; arg?: string } {
  if (typeof text !== "string") return { cmd: "unknown" };
  const t = text.trim();
  if (!t || t.length > MAX_COMMAND_CHARS) return { cmd: "unknown" };
  const m = COMMAND_RE.exec(t);
  if (!m) return { cmd: "unknown" };
  const cmd = m[1].toLowerCase();
  if (!(BOT_COMMANDS as readonly string[]).includes(cmd)) return { cmd: "unknown" };
  const arg = (m[2] ?? "").trim();
  return arg ? { cmd: cmd as BotCommand, arg } : { cmd: cmd as BotCommand };
}

// ── Link codes ──────────────────────────────────────────────────────────────

/** No 0/O/1/I/L: the code is also shown for typing. 31 symbols × 10 ≈ 49.5 bits; single-use, 30 min, hashed. */
export const LINK_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LINK_CODE_LENGTH = 10;
export const LINK_CODE_TTL_MINUTES = 30;

export function newLinkCode(): { code: string; hash: string } {
  let code = "";
  for (let i = 0; i < LINK_CODE_LENGTH; i++) code += LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)];
  return { code, hash: hashToken(code) };
}

/** Typed code → canonical form (upper case, spaces and dashes removed); null when it cannot be a code. Hash the result. */
export function normalizeLinkCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 40) return null;
  const c = raw.toUpperCase().replace(/[\s-]/g, "");
  if (c.length !== LINK_CODE_LENGTH) return null;
  for (const ch of c) if (!LINK_CODE_ALPHABET.includes(ch)) return null;
  return c;
}

// ── Channel routing ─────────────────────────────────────────────────────────

export type NotifyChannel = "EMAIL" | "TELEGRAM" | "BOTH";

/**
 * Channels for one outbox row. TELEGRAM/BOTH need a linked chat and a configured bot (botConfigured,
 * default true), otherwise the row falls back to email.
 * emailNotifications=false suppresses STAGE/MESSAGE email only (3d rule), never Telegram.
 */
export function routeNotification(input: {
  kind: NotificationKind;
  notifyChannel: NotifyChannel;
  chatLinked: boolean;
  /** partnerBotConfigured(): without the bot env no Telegram send is attempted. */
  botConfigured?: boolean;
  emailNotifications: boolean;
}): { email: boolean; telegram: boolean } {
  const { kind, notifyChannel, emailNotifications } = input;
  const reachable = input.chatLinked && input.botConfigured !== false;
  const telegram = notifyChannel !== "EMAIL" && reachable;
  let email = notifyChannel !== "TELEGRAM" || !reachable;
  if (!emailNotifications && (kind === "STAGE" || kind === "MESSAGE")) email = false;
  return { email, telegram };
}

// ── HTML helpers ────────────────────────────────────────────────────────────

/** Telegram's limit is 4096; we keep notifications short. */
export const TELEGRAM_MAX_CHARS = 1000;

const esc = escapeHtml;
const link = (href: string, label: string) => `<a href="${esc(href)}">${esc(label)}</a>`;
const join = (base: string, path: string) => `${(base ?? "").replace(/\/+$/, "")}${path}`;

/** Escape `raw` and cut it (by code point, never inside an entity) so the escaped text fits `max`, ending in "…". */
export function clipEscaped(raw: string, max: number): string {
  const full = esc(raw);
  if (full.length <= max) return full;
  let out = "";
  for (const ch of Array.from(raw)) {
    const e = esc(ch);
    if (out.length + e.length > max - 1) break;
    out += e;
  }
  return out + "…";
}

const text = (v: string | null | undefined, max: number) => {
  const s = (v ?? "").trim();
  return s ? clipEscaped(s, max) : "—";
};

// ── Bot replies ─────────────────────────────────────────────────────────────

export type BotReplyKind = "linked" | "invalidCode" | "unlinked" | "notLinked" | "help" | "status" | "commission" | "rateLimited";
export type BotReplyData = {
  portalUrl?: string;
  /** Effectively active clients: the name the partner submitted and a partner-dictionary stage key. */
  clients?: { name: string; stageKey: string }[];
  /** Clients beyond the list (the caller loads at most 10). */
  more?: number;
  /** Commission totals per stage (COMMISSION_STAGES key) with a pre-formatted amount. */
  totals?: { stage: string; amount: string }[];
  lastPayout?: { amount: string; creditNoteNumber: string } | null;
};

export const STATUS_LIST_MAX = 10;

export function buildBotReply(locale: PartnerLocale, reply: { kind: BotReplyKind; data?: BotReplyData }): string {
  const data = reply.data ?? {};
  const portal = data.portalUrl ?? "";
  const t = dict(locale).telegram.bot;
  const portalLink = (path = "") => (portal ? `\n\n${link(join(portal, path), t.openPortal)}` : "");
  switch (reply.kind) {
    case "linked":
      return esc(t.linked) + portalLink();
    case "invalidCode":
      return esc(t.invalidCode);
    case "unlinked":
      return esc(t.unlinked);
    case "rateLimited":
      return esc(t.rateLimited);
    case "notLinked":
      // Unknown chat: we do not know the partner's language — always English.
      return esc(fmt(dict("en").telegram.bot.notLinked, { url: portal }));
    case "help": {
      const lines = [`<b>${esc(t.helpTitle)}</b>`, esc(dict(locale).telegram.menu.helpMenu), esc(t.helpStatus), esc(t.helpCommission), esc(t.helpStop), "", esc(t.helpSubmit)];
      if (portal) lines.push(link(join(portal, "/submit"), t.openSubmit));
      return lines.join("\n");
    }
    case "status": {
      const clients = data.clients ?? [];
      if (!clients.length) return esc(t.statusEmpty) + portalLink("/clients");
      const shown = clients.slice(0, STATUS_LIST_MAX);
      const more = Math.max(0, data.more ?? 0) + (clients.length - shown.length);
      const stageOf = (k: string) => lookup(locale, k) ?? lookup(locale, "stages.onHold")!;
      const lines = [`<b>${esc(t.statusTitle)}</b>`, ...shown.map((c) => `• ${text(c.name, 80)} — ${esc(stageOf(c.stageKey))}`)];
      if (more > 0) lines.push(esc(fmt(t.statusMore, { n: more })));
      return lines.join("\n") + portalLink("/clients");
    }
    case "commission": {
      const totals = data.totals ?? [];
      const lines = [`<b>${esc(t.commissionTitle)}</b>`];
      if (!totals.length) lines.push(esc(t.commissionEmpty));
      for (const r of totals) lines.push(`${esc(lookup(locale, `commission.${r.stage}`) ?? r.stage)}: ${text(r.amount, 40)}`);
      if (data.lastPayout) {
        lines.push("", esc(fmt(t.lastPayout, { amount: data.lastPayout.amount, number: data.lastPayout.creditNoteNumber })));
      }
      return lines.join("\n") + portalLink("/commissions");
    }
    default:
      return unhandledReply(reply.kind);
  }
}

function unhandledReply(kind: never): never {
  throw new Error(`partner telegram: unhandled reply kind ${String(kind)}`);
}

// ── Notifications ───────────────────────────────────────────────────────────

export type TelegramNotificationInput = {
  kind: NotificationKind;
  clientName?: string | null;
  stageKey?: string | null;
  messageBody?: string | null;
  accepted?: boolean;
  /** Pre-formatted amount (formatPayoutAmount). */
  amount?: string | null;
  creditNoteNumber?: string | null;
  projectName?: string | null;
  changeType?: string | null;
  /** Pre-formatted price. */
  priceFrom?: string | null;
  /** TIER_UP: the new tier's name and shares (percent). */
  tierName?: string | null;
  handoverShare?: number | null;
  fixShare?: number | null;
  /** STAGE (v2): extra lines under the headline (viewing date, expected commission), plain text. */
  extra?: string[];
  /** PROJECT_NEWS / WATCH: the projects, prices and rates pre-formatted. */
  projects?: { name: string; area?: string | null; detail: string; url: string }[];
  /** PROTECTION_ENDING: the end date, pre-formatted. */
  date?: string | null;
  /** BANK_MISSING: the developer has paid already (the second, more urgent wording). */
  developerPaid?: boolean;
  /** Target of the main link (client page, project page, presentations page). */
  url: string;
  portalUrl: string;
};

/** One outbox row as a Telegram HTML message (≤ TELEGRAM_MAX_CHARS). */
export function buildTelegramNotification(locale: PartnerLocale, input: TelegramNotificationInput): string {
  const d = dict(locale).telegram;
  const t = d.notify;
  const client = text(input.clientName, 120);
  // Escaped values are substituted into escaped templates (dictionary text has no markup).
  const line = (tpl: string, vars: Record<string, string> = {}) => fmt(esc(tpl), vars);
  const open = link(input.url, t.open);
  let out: string;
  switch (input.kind) {
    case "STAGE": {
      const stage = lookup(locale, input.stageKey ?? "") ?? lookup(locale, "stages.onHold")!;
      const extra = (input.extra ?? []).filter((x) => x.trim()).map((x) => text(x, 120));
      out = `<b>${line(t.stage, { client, stage: esc(stage) })}</b>${extra.length ? `\n${extra.join("\n")}` : ""}\n\n${open}`;
      break;
    }
    case "MESSAGE": {
      const head = `<b>${line(t.message, { client })}</b>\n\n`;
      const tail = `\n\n${open}`;
      const budget = TELEGRAM_MAX_CHARS - head.length - tail.length - "<i></i>".length;
      const body = (input.messageBody ?? "").trim();
      out = head + (body && budget > 1 ? `<i>${clipEscaped(body, budget)}</i>` : "") + tail;
      break;
    }
    case "CLAIM_OUTCOME":
      out = `<b>${line(input.accepted ? t.claimAccepted : t.claimRejected, { client })}</b>\n\n${open}`;
      break;
    case "PAYOUT": {
      const lines = [`<b>${line(t.payout, { client, amount: text(input.amount, 40) })}</b>`];
      if ((input.creditNoteNumber ?? "").trim()) lines.push(line(t.creditNote, { number: text(input.creditNoteNumber, 40) }));
      out = `${lines.join("\n")}\n\n${open}`;
      break;
    }
    case "MATCH": {
      const lines = [`<b>${line(t.match, { client, project: text(input.projectName, 160) })}</b>`];
      const change = (d.changeTypes as Record<string, string>)[input.changeType ?? ""];
      const price = (input.priceFrom ?? "").trim() ? line(t.priceFrom, { price: text(input.priceFrom, 40) }) : "";
      const detail = [change ? esc(change) : "", price].filter(Boolean).join(" · ");
      if (detail) lines.push(detail);
      out = `${lines.join("\n")}\n\n${link(input.url, t.viewProject)}\n${link(input.portalUrl, t.open)}`;
      break;
    }
    case "PRESENTATION_OPENED":
      out = `<b>${line(t.presentationOpened, { client })}</b>\n\n${open}`;
      break;
    case "TIER_UP": {
      const lines = [`<b>${line(t.tierUp, { tier: text(input.tierName, 40) })}</b>`];
      if (input.handoverShare != null && input.fixShare != null) {
        lines.push(line(t.tierShares, { handover: esc(formatShare(locale, input.handoverShare)), fix: esc(formatShare(locale, input.fixShare)) }));
      }
      out = `${lines.join("\n")}\n\n${open}`;
      break;
    }
    case "PROJECT_NEWS":
    case "WATCH": {
      const head = `<b>${esc(input.kind === "WATCH" ? t.watch : t.projectNews)}</b>`;
      const items = (input.projects ?? []).map((pr) => {
        const title = link(pr.url, [pr.name, pr.area].filter((x) => (x ?? "").trim()).join(", "));
        return pr.detail.trim() ? `• ${title}\n  ${text(pr.detail, 160)}` : `• ${title}`;
      });
      const tail = `\n\n${link(input.url, input.kind === "WATCH" ? t.open : t.openProjects)}`;
      // Drop projects from the end until it fits (a long URL list must never cut markup).
      while (items.length > 1 && [head, ...items].join("\n\n").length + tail.length > TELEGRAM_MAX_CHARS) items.pop();
      out = `${[head, ...items].join("\n\n")}${tail}`;
      break;
    }
    case "PROTECTION_ENDING":
      out = `<b>${line(t.protectionEnding, { client, date: text(input.date, 40) })}</b>\n${esc(t.protectionNote)}\n\n${open}`;
      break;
    case "CLIENT_QUIET":
      out = `<b>${line(t.clientQuiet, { client })}</b>\n${esc(t.clientQuietNote)}\n\n${open}`;
      break;
    case "BANK_MISSING":
      out = `<b>${line(input.developerPaid ? t.bankMissingDevPaid : t.bankMissing, { client })}</b>\n\n${link(input.url, t.addBank)}`;
      break;
    case "TIER_NEAR":
      out = `<b>${line(t.tierNear, { tier: text(input.tierName, 40) })}</b>\n\n${open}`;
      break;
    default:
      return unhandledKind(input.kind);
  }
  // The tagline closes every notification (2026-10-31) when it still fits.
  const tag = `\n\n<i>${esc(dict(locale).mail.footer.tagline)}</i>`;
  if (out.length + tag.length <= TELEGRAM_MAX_CHARS) out += tag;
  // Only reachable with an absurdly long URL: keep the (bounded) headline, drop the links rather than cut markup.
  return out.length <= TELEGRAM_MAX_CHARS ? out : out.split("\n")[0];
}

/** Room per message of the new-projects post (Telegram's hard limit is 4096). */
export const TELEGRAM_NEWS_CHUNK = 3800;

/**
 * New projects (PROJECT_NEWS) as one or more Telegram messages: the headline, then every project as a linked
 * name over its plain lines (projectNewsLines), split between projects so no message passes TELEGRAM_NEWS_CHUNK;
 * the last message ends with the link to all projects and the tagline.
 */
export function buildTelegramProjectNews(
  locale: PartnerLocale,
  projects: { name: string; url: string; lines: string[] }[],
  allProjectsUrl: string,
): string[] {
  const t = dict(locale).telegram.notify;
  const blocks = projects.map((pr) => [`<b>${link(pr.url, pr.name)}</b>`, ...pr.lines.map((l) => clipEscaped(l, 400))].join("\n"));
  const head = `<b>${esc(t.projectNews)}</b>`;
  const tail = `${link(allProjectsUrl, t.openProjects)}\n\n<i>${esc(dict(locale).mail.footer.tagline)}</i>`;
  const out: string[] = [];
  let cur = head;
  for (const b of blocks) {
    const block = b.length > TELEGRAM_NEWS_CHUNK ? b.split("\n")[0] : b;
    if (cur && cur.length + 2 + block.length > TELEGRAM_NEWS_CHUNK) {
      out.push(cur);
      cur = block;
    } else {
      cur = cur ? `${cur}\n\n${block}` : block;
    }
  }
  if (cur.length + 2 + tail.length > TELEGRAM_NEWS_CHUNK) {
    out.push(cur);
    cur = tail;
  } else {
    cur = `${cur}\n\n${tail}`;
  }
  out.push(cur);
  return out;
}

// ── Rate limit ──────────────────────────────────────────────────────────────

export const CHAT_LIMIT_MAX = 30;
export const CHAT_LIMIT_WINDOW_MS = 10 * 60_000;

/** 30 messages per chat id per 10 minutes (in-memory, per process). Over-limit messages are ignored. */
export function makeChatLimiter() {
  return makeThrottle(CHAT_LIMIT_MAX, CHAT_LIMIT_WINDOW_MS);
}
