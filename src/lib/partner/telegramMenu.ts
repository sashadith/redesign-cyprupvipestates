// Partner Telegram bot menu (notifications v2, 2026-10-30). Pure, no I/O: callback-data parsing and the
// screens (Telegram HTML + inline keyboard). The DB side and the Bot API calls live in telegramWebhook.ts.
// Every dynamic value is HTML-escaped; callback data never carries more than a screen name, a page, a
// claim id (checked against the linked partner on the server) or a setting value from a fixed list.
import { PARTNER_LOCALES, dict, fmt, lookup, type PartnerLocale } from "./i18n";
import { escapeHtml } from "./mail";
import { NOTIFY_SWITCHES, QUIET_PRESETS, parseQuietPreset, quietKey, quietLabel, type NotifySwitch, type NotifySwitches } from "./notifyPrefs";
import type { InlineKeyboard } from "./telegramApi";

const esc = escapeHtml;

// ── Callback data ───────────────────────────────────────────────────────────

export type MenuToggle = NotifySwitch | "digestOptIn";
export const MENU_TOGGLES: readonly MenuToggle[] = [...NOTIFY_SWITCHES, "digestOptIn"];

export type MenuAction =
  | { a: "main" } | { a: "overview" } | { a: "clients"; page: number } | { a: "client"; id: string } | { a: "commission" }
  | { a: "projects" } | { a: "settings" } | { a: "lang" } | { a: "setLang"; locale: PartnerLocale } | { a: "quiet" }
  | { a: "setQuiet"; window: [number, number] | null } | { a: "notify" } | { a: "toggle"; key: MenuToggle } | { a: "channel" }
  | { a: "setChannel"; channel: "TELEGRAM" | "BOTH" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CLIENTS_PER_PAGE = 8;
export const CLIENT_PAGES_MAX = 6;

/** Button data → action; null for anything not produced by this module (old or forged buttons). */
export function parseMenuAction(data: unknown): MenuAction | null {
  if (typeof data !== "string" || data.length > 64) return null;
  const parts = data.split(":");
  if (parts.length > 2) return null;
  const [head, arg] = parts as [string, string | undefined];
  switch (head) {
    case "m": return { a: "main" };
    case "o": return { a: "overview" };
    case "k": return { a: "commission" };
    case "p": return { a: "projects" };
    case "s": return { a: "settings" };
    case "c": {
      const page = Number(arg ?? "1");
      return Number.isInteger(page) && page >= 1 && page <= CLIENT_PAGES_MAX ? { a: "clients", page } : null;
    }
    case "cl": return arg && UUID.test(arg) ? { a: "client", id: arg.toLowerCase() } : null;
    case "sl":
      if (arg === undefined) return { a: "lang" };
      return (PARTNER_LOCALES as readonly string[]).includes(arg) ? { a: "setLang", locale: arg as PartnerLocale } : null;
    case "sq": {
      if (arg === undefined) return { a: "quiet" };
      const w = parseQuietPreset(arg);
      return w === undefined ? null : { a: "setQuiet", window: w };
    }
    case "sn": {
      if (arg === undefined) return { a: "notify" };
      const key = MENU_TOGGLES[Number(arg)];
      return /^\d$/.test(arg) && key ? { a: "toggle", key } : null;
    }
    case "sc":
      if (arg === undefined) return { a: "channel" };
      return arg === "T" ? { a: "setChannel", channel: "TELEGRAM" } : arg === "B" ? { a: "setChannel", channel: "BOTH" } : null;
    default:
      return null;
  }
}

// ── Screens ─────────────────────────────────────────────────────────────────

export type MenuScreen = { html: string; keyboard: InlineKeyboard };

const btn = (text: string, data: string) => ({ text, callback_data: data });
const urlBtn = (text: string, url: string) => ({ text, url });
const join = (base: string, path: string) => `${base.replace(/\/+$/, "")}${path}`;
const check = (on: boolean) => (on ? "✅" : "⬜️");
const tick = (on: boolean) => (on ? "✓ " : "");
const M = (l: PartnerLocale) => dict(l).telegram.menu;

/** URL buttons only when the portal URL is known (never a relative or localhost link). */
const portalRow = (l: PartnerLocale, portal: string) =>
  portal.startsWith("https://") ? [[urlBtn(M(l).submit, join(portal, "/submit")), urlBtn(M(l).portal, portal)]] : [];

export function mainMenu(l: PartnerLocale, portal: string): MenuScreen {
  const t = M(l);
  return {
    html: `<b>${esc(t.title)}</b>\n${esc(t.intro)}`,
    keyboard: [
      [btn(t.overview, "o"), btn(t.clients, "c:1")],
      [btn(t.commission, "k"), btn(t.projects, "p")],
      ...portalRow(l, portal),
      [btn(t.settings, "s")],
    ],
  };
}

const backTo = (l: PartnerLocale, data = "m") => [btn(M(l).back, data)];

export type OverviewData = {
  counts: { active: number; inReview: number; viewings: number; closed: number };
  commission: { stage: string; amount: string }[];
  tier: { name: string; next: { name: string; remaining: number } | null } | null;
};

export function overviewScreen(l: PartnerLocale, d: OverviewData): MenuScreen {
  const t = M(l);
  const lines = [
    `<b>${esc(t.overviewTitle)}</b>`,
    esc(fmt(t.activeClients, { n: d.counts.active })),
    esc(fmt(t.inReview, { n: d.counts.inReview })),
    esc(fmt(t.viewings, { n: d.counts.viewings })),
    esc(fmt(t.closed, { n: d.counts.closed })),
  ];
  if (d.commission.length) {
    lines.push("", `<b>${esc(t.commissionTitle)}</b>`);
    for (const r of d.commission) lines.push(`${esc(lookup(l, `commission.${r.stage}`) ?? r.stage)}: ${esc(r.amount)}`);
  }
  if (d.tier) {
    lines.push("", esc(fmt(t.tier, { tier: d.tier.name })));
    if (d.tier.next) lines.push(esc(fmt(t.tierNext, { tier: d.tier.next.name, n: d.tier.next.remaining })));
  }
  return { html: lines.join("\n"), keyboard: [[btn(t.clients, "c:1"), btn(t.commission, "k")], backTo(l)] };
}

export type ClientsData = { items: { id: string; name: string; stageKey: string }[]; page: number; pages: number; more: boolean };

const stageOf = (l: PartnerLocale, key: string) => lookup(l, key) ?? lookup(l, "stages.onHold")!;
const clip = (s: string, n: number) => (Array.from(s).length > n ? `${Array.from(s).slice(0, n - 1).join("")}…` : s);

export function clientsScreen(l: PartnerLocale, d: ClientsData): MenuScreen {
  const t = M(l);
  if (!d.items.length) return { html: `<b>${esc(t.clientsTitle)}</b>\n${esc(t.clientsEmpty)}`, keyboard: [backTo(l)] };
  const nav = [
    ...(d.page > 1 ? [btn(t.prev, `c:${d.page - 1}`)] : []),
    ...(d.page < d.pages ? [btn(t.next, `c:${d.page + 1}`)] : []),
  ];
  const lines = [`<b>${esc(t.clientsTitle)}</b>`];
  if (d.more && d.page === d.pages) lines.push(esc(t.clientsMore));
  return {
    html: lines.join("\n"),
    keyboard: [
      ...d.items.map((c) => [btn(`${clip(c.name.trim() || "—", 28)} · ${clip(stageOf(l, c.stageKey), 22)}`, `cl:${c.id}`)]),
      ...(nav.length ? [nav] : []),
      backTo(l),
    ],
  };
}

export function clientScreen(l: PartnerLocale, d: { name: string; stageKey: string; protectedUntil: string | null; url: string }): MenuScreen {
  const t = M(l);
  const lines = [`<b>${esc(d.name.trim() || "—")}</b>`, esc(stageOf(l, d.stageKey))];
  if (d.protectedUntil) lines.push(esc(fmt(t.protectedUntil, { date: d.protectedUntil })));
  return {
    html: lines.join("\n"),
    keyboard: [...(d.url.startsWith("https://") ? [[urlBtn(t.openClient, d.url)]] : []), backTo(l, "c:1")],
  };
}

export function commissionScreen(l: PartnerLocale, d: { totals: { stage: string; amount: string }[]; lastPayout: string | null }): MenuScreen {
  const t = M(l);
  const b = dict(l).telegram.bot;
  const lines = [`<b>${esc(t.commissionTitle)}</b>`];
  if (!d.totals.length) lines.push(esc(b.commissionEmpty));
  for (const r of d.totals) lines.push(`${esc(lookup(l, `commission.${r.stage}`) ?? r.stage)}: ${esc(r.amount)}`);
  if (d.lastPayout) lines.push("", esc(d.lastPayout));
  return { html: lines.join("\n"), keyboard: [backTo(l)] };
}

export function projectsScreen(l: PartnerLocale, d: { items: { name: string; town: string | null; detail: string; url: string }[] }): MenuScreen {
  const t = M(l);
  if (!d.items.length) return { html: `<b>${esc(t.projectsTitle)}</b>\n${esc(t.projectsEmpty)}`, keyboard: [backTo(l)] };
  const lines = [`<b>${esc(t.projectsTitle)}</b>`];
  for (const p of d.items) {
    lines.push("", `• <a href="${esc(p.url)}">${esc([p.name, p.town].filter(Boolean).join(", "))}</a>`);
    if (p.detail) lines.push(`  ${esc(p.detail)}`);
  }
  return { html: lines.join("\n"), keyboard: [backTo(l)] };
}

/** A language's own name, capitalised ("Deutsch", "Polski", "Русский"). */
export function languageName(l: PartnerLocale): string {
  const n = new Intl.DisplayNames([l], { type: "language" }).of(l) ?? l;
  return n.charAt(0).toLocaleUpperCase(l) + n.slice(1);
}

export type SettingsData = {
  language: PartnerLocale;
  quiet: [number, number] | null;
  channel: "EMAIL" | "TELEGRAM" | "BOTH";
  switches: NotifySwitches & { digestOptIn: boolean };
};

const channelLabel = (l: PartnerLocale, c: SettingsData["channel"]) =>
  c === "TELEGRAM" ? M(l).channelTelegram : c === "BOTH" ? M(l).channelBoth : dict(l).telegram.channel.EMAIL;

export function settingsScreen(l: PartnerLocale, d: SettingsData, saved = false): MenuScreen {
  const t = M(l);
  const lines = [
    `<b>${esc(t.settingsTitle)}</b>${saved ? ` · ${esc(t.saved)}` : ""}`,
    esc(fmt(t.languageLine, { value: languageName(d.language) })),
    esc(fmt(t.quietLine, { value: quietLabel(d.quiet, dict(l).profileSettings.quietOff) })),
    esc(fmt(t.channelLine, { value: channelLabel(l, d.channel) })),
  ];
  return {
    html: lines.join("\n"),
    keyboard: [[btn(t.language, "sl"), btn(t.quiet, "sq")], [btn(t.notifications, "sn"), btn(t.channel, "sc")], backTo(l)],
  };
}

export function languageScreen(l: PartnerLocale, current: PartnerLocale): MenuScreen {
  return {
    html: `<b>${esc(M(l).language)}</b>`,
    keyboard: [
      PARTNER_LOCALES.slice(0, 2).map((x) => btn(`${tick(x === current)}${languageName(x)}`, `sl:${x}`)),
      PARTNER_LOCALES.slice(2).map((x) => btn(`${tick(x === current)}${languageName(x)}`, `sl:${x}`)),
      backTo(l, "s"),
    ],
  };
}

export function quietScreen(l: PartnerLocale, current: [number, number] | null): MenuScreen {
  const S = dict(l).profileSettings;
  const cur = quietKey(current);
  const options: ([number, number] | null)[] = [null, ...QUIET_PRESETS.map((p) => [p[0], p[1]] as [number, number])];
  const buttons = options.map((w) => btn(`${tick(quietKey(w) === cur)}${quietLabel(w, S.quietOff)}`, `sq:${quietKey(w)}`));
  return {
    html: `<b>${esc(S.quiet)}</b>\n${esc(S.quietHint)}`,
    keyboard: [buttons.slice(0, 2), buttons.slice(2, 4), buttons.slice(4), backTo(l, "s")].filter((r) => r.length),
  };
}

export function notifyScreen(l: PartnerLocale, s: SettingsData["switches"]): MenuScreen {
  const S = dict(l).profileSettings;
  const label = (k: MenuToggle) => (k === "digestOptIn" ? M(l).digest : S[k]);
  return {
    html: `<b>${esc(M(l).notifications)}</b>\n${esc(S.alwaysOn)}`,
    keyboard: [...MENU_TOGGLES.map((k, i) => [btn(`${check(s[k])} ${label(k)}`, `sn:${i}`)]), backTo(l, "s")],
  };
}

export function channelScreen(l: PartnerLocale, current: SettingsData["channel"]): MenuScreen {
  const t = M(l);
  return {
    html: `<b>${esc(t.channel)}</b>\n${esc(t.channelHint)}`,
    keyboard: [
      [btn(`${tick(current === "BOTH")}${t.channelBoth}`, "sc:B")],
      [btn(`${tick(current === "TELEGRAM")}${t.channelTelegram}`, "sc:T")],
      backTo(l, "s"),
    ],
  };
}

/** The bot's "/" command list per Telegram language code ("" = default, English). */
export function botCommandLists(): Record<string, { command: string; description: string }[]> {
  const list = (l: PartnerLocale) => {
    const t = M(l);
    return [
      { command: "menu", description: t.cmdMenu },
      { command: "status", description: t.cmdStatus },
      { command: "commission", description: t.cmdCommission },
      { command: "help", description: t.cmdHelp },
      { command: "stop", description: t.cmdStop },
    ];
  };
  return { "": list("en"), de: list("de"), pl: list("pl"), ru: list("ru") };
}
