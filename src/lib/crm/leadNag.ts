// Lead reminders (2026-10-31): the CRM nags on Telegram until overdue leads are dealt with. Pure, no I/O;
// the DB/Telegram side is leadNagSend.ts. The rule is the pipeline's own (cardUrgency): what is red or yellow
// on the board is exactly what the reminder lists — nothing else, so the two can never disagree.
//
// Operator decisions: 10:00, 12:00, 15:00 and 18:00 Cyprus time; a lead leaves the list only when it is dealt
// with (a real contact logged, or a new follow-up date — including the Telegram buttons "Tomorrow" / "+3 days");
// every employee gets their own leads; unassigned leads, and leads of someone without Telegram, go to the owner.
// Internal copy: English (project convention).
import { cardUrgency, type BoardLeadInput, type CardUrgency } from "./boardModel";
import { isLeadStatus } from "./leadStatus";
import { CRM_TZ, dayKey } from "./today";

/** Cyprus hours the reminder goes out. */
export const NAG_HOURS = [10, 12, 15, 18] as const;
/** Leads listed (and given buttons) per message; the rest are counted with a link to the board. */
export const NAG_MAX_LEADS = 30;
/** Room for the message text (Telegram's hard limit is 4096). */
export const NAG_TEXT_MAX = 3900;
/** From this many days late a lead is "left alone" and goes to the top in bold. */
export const NAG_ALARM_DAYS = 7;
/** From this many days late the mark doubles. */
export const NAG_LOUD_DAYS = 3;
/** Lead sources the reminders leave out: a newsletter signup is not an enquiry (operator, 2026-10-31). */
export const NAG_EXCLUDED_SOURCES = ["NEWSLETTER"] as const;
/** Snooze choices of the buttons, in days. */
export const NAG_SNOOZE_DAYS = [1, 3] as const;
/** Local time a snoozed follow-up is set to (it then turns yellow on that day and is in the 10:00 list). */
export const NAG_SNOOZE_HOUR = 9;

/** The Cyprus hour if it is one of NAG_HOURS, else null. */
export function nagSlot(now: Date, tz = CRM_TZ): number | null {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: tz }).format(now));
  return (NAG_HOURS as readonly number[]).includes(h) ? h : null;
}

export type NagLead = Pick<BoardLeadInput, "id" | "firstName" | "lastName" | "status" | "lastContactAt" | "createdAt" | "nextFollowUpAt" | "viewingScheduledAt"> & {
  assignedToId: string | null;
};

export type NagItem = { leadId: string; name: string; urgency: CardUrgency; ownerName: string | null };

const leadName = (l: { firstName: string; lastName: string }) => `${l.firstName} ${l.lastName}`.trim() || "(no name)";

/** The marked leads, most overdue first, then "act now"; ties by name. */
export function nagItems(leads: NagLead[], now: Date, ownerNameOf: (assignedToId: string | null) => string | null = () => null): NagItem[] {
  const out: NagItem[] = [];
  for (const l of leads) {
    if (!isLeadStatus(l.status)) continue;
    const u = cardUrgency({ ...l, source: "", languagePreference: null, assignedTo: null, projectLabel: null, deals: [], canEdit: false } as BoardLeadInput, l.status, now);
    if (u) out.push({ leadId: l.id, name: leadName(l), urgency: u, ownerName: ownerNameOf(l.assignedToId) });
  }
  const rank = (i: NagItem) => (i.urgency.level === "overdue" ? i.urgency.days : -1);
  return out.sort((a, b) => rank(b) - rank(a) || a.name.localeCompare(b.name, "en"));
}

export type NagUser = { id: string; name: string; isOwner: boolean; isActive: boolean; telegramChatId: string | null };

/**
 * Who hears about which lead: the assignee's own chat when linked; otherwise — unassigned, assigned to someone
 * without Telegram, or to an inactive user — the owner's chat (the owner's private chat when linked, else the
 * office chat). Never dropped. `foreign` marks leads the owner gets on someone else's behalf (named in the line).
 */
export function routeNag(
  leads: NagLead[],
  users: NagUser[],
  officeChatId: string | null,
): Map<string, { leads: NagLead[]; foreign: Set<string> }> {
  const byId = new Map(users.map((u) => [u.id, u]));
  const owner = users.find((u) => u.isOwner && u.isActive);
  const ownerChat = owner?.telegramChatId || officeChatId || null;
  const out = new Map<string, { leads: NagLead[]; foreign: Set<string> }>();
  const add = (chat: string, l: NagLead, foreign: boolean) => {
    const box = out.get(chat) ?? { leads: [], foreign: new Set<string>() };
    box.leads.push(l);
    if (foreign) box.foreign.add(l.id);
    out.set(chat, box);
  };
  for (const l of leads) {
    const u = l.assignedToId ? byId.get(l.assignedToId) : undefined;
    if (u && u.isActive && u.telegramChatId) add(u.telegramChatId, l, false);
    else if (ownerChat) add(ownerChat, l, !!u && !u.isOwner);
  }
  return out;
}

// ── Message ─────────────────────────────────────────────────────────────────

export type InlineButton = { text: string; callback_data: string };
export type NagMessage = { text: string; keyboard: InlineButton[][] };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One lead's line: 🚨 from NAG_ALARM_DAYS (bold, "left alone"), 🔴🔴 from NAG_LOUD_DAYS, 🔴 overdue, 🟡 act now. */
export function nagLine(item: NagItem, leadUrl: string): string {
  const u = item.urgency;
  const who = item.ownerName ? ` <i>(${esc(item.ownerName)})</i>` : "";
  const name = `<a href="${esc(leadUrl)}">${esc(item.name)}</a>`;
  if (u.level === "now") return `🟡 ${name}${who} — ${esc(u.reason)}`;
  if (u.days >= NAG_ALARM_DAYS) return `🚨 <b>${name} — left alone for ${u.days} days</b>${who}\n      ${esc(u.reason)}`;
  return `${u.days >= NAG_LOUD_DAYS ? "🔴🔴" : "🔴"} ${name}${who} — <b>Overdue ${u.days}d</b> · ${esc(u.reason)}`;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** The Telegram message for one chat: headline, lines, buttons (Tomorrow / +3 days per lead); null when nothing is due. */
export function buildNagMessage(items: NagItem[], opts: { slot: number; crmBase: string }): NagMessage | null {
  if (!items.length) return null;
  const base = opts.crmBase.replace(/\/+$/, "");
  const overdue = items.filter((i) => i.urgency.level === "overdue").length;
  const now = items.length - overdue;
  const counts = [overdue ? `${plural(overdue, "lead")} overdue` : "", now ? `${now} due today` : ""].filter(Boolean).join(", ");
  const head = opts.slot === NAG_HOURS[0]
    ? `🔔 <b>Leads need you</b> — ${counts}`
    : `🔔 <b>Still open at ${String(opts.slot).padStart(2, "0")}:00</b> — ${counts}`;
  const foot = "<i>A lead leaves this list when you log a call, e-mail or WhatsApp, or set a new follow-up date.</i>";
  const render = (shown: NagItem[]) => {
    const lines = shown.map((i) => nagLine(i, `${base}/crm/leads/${encodeURIComponent(i.leadId)}`));
    const rest = items.length - shown.length;
    if (rest > 0) lines.push(`…and ${rest} more → <a href="${esc(`${base}/crm/pipeline?filter=due`)}">Needs action</a>`);
    return [head, lines.join("\n"), foot].join("\n\n");
  };
  // Telegram's limit is 4096 characters: list fewer leads (the most overdue stay) until it fits.
  let shown = items.slice(0, NAG_MAX_LEADS);
  let text = render(shown);
  while (text.length > NAG_TEXT_MAX && shown.length > 1) {
    shown = shown.slice(0, -1);
    text = render(shown);
  }
  const keyboard = shown.map((i) => [
    { text: `⏰ ${shortName(i.name)}: tomorrow`, callback_data: nagCallbackData(1, i.leadId) },
    { text: "+3 days", callback_data: nagCallbackData(3, i.leadId) },
  ]);
  return { text, keyboard };
}

/** First name plus initial, at most 24 characters (button labels are short). */
export function shortName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  const s = rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first ?? "";
  return s.length > 24 ? `${s.slice(0, 23)}…` : s;
}

// ── Buttons ─────────────────────────────────────────────────────────────────

const CB_RE = /^nag:(\d):([0-9a-f-]{36})$/;

export const nagCallbackData = (days: number, leadId: string) => `nag:${days}:${leadId}`;

/** "nag:<days>:<leadId>" → the snooze; null for anything else (unknown days, malformed id). */
export function parseNagCallback(data: string): { days: number; leadId: string } | null {
  const m = CB_RE.exec(data);
  if (!m) return null;
  const days = Number(m[1]);
  return (NAG_SNOOZE_DAYS as readonly number[]).includes(days) ? { days, leadId: m[2] } : null;
}

/** NAG_SNOOZE_HOUR Cyprus time, `days` Cyprus days after today (DST-safe: the offset is read for that day). */
export function snoozeUntil(now: Date, days: number, tz = CRM_TZ): Date {
  const [y, mo, d] = dayKey(now, tz).split("-").map(Number);
  const target = new Date(Date.UTC(y, mo - 1, d + days, NAG_SNOOZE_HOUR, 0, 0));
  // Offset of tz at that wall time: format the UTC guess in tz and shift by the difference.
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(target)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  const asLocal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(target.getTime() - (asLocal - target.getTime()));
}

/**
 * May this chat snooze this lead? The owner's chat (office chat, or the owner's linked private chat) may snooze
 * any lead; an employee's chat only their own leads.
 */
export function maySnooze(input: { chatId: string; officeChatId: string | null; chatUser: NagUser | null; leadAssignedToId: string | null }): boolean {
  if (input.officeChatId && input.chatId === input.officeChatId) return true;
  const u = input.chatUser;
  if (!u || !u.isActive) return false;
  if (u.isOwner) return true;
  return input.leadAssignedToId === u.id;
}

/** Remove a snoozed lead's button row from a message's keyboard. */
export function withoutLeadRow(keyboard: InlineButton[][], leadId: string): InlineButton[][] {
  return keyboard.filter((row) => !row.some((b) => b.callback_data.endsWith(`:${leadId}`)));
}

/** The banner/tab counts for one CRM user: the same items the reminder would list for them. */
export function nagCounts(items: NagItem[]): { overdue: number; now: number } {
  let overdue = 0;
  for (const i of items) if (i.urgency.level === "overdue") overdue++;
  return { overdue, now: items.length - overdue };
}

// ── Webhook updates ─────────────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const chatIdOf = (id: unknown) =>
  typeof id === "number" && Number.isSafeInteger(id) ? String(id) : typeof id === "string" && /^-?\d{1,20}$/.test(id) ? id : null;

export type NagCallback = { id: string; chatId: string; messageId: number; data: string; keyboard: InlineButton[][]; fromName: string };

/** A button press from a private chat or a group (the office chat is a group); the message's own keyboard is kept (callback buttons only). */
export function extractNagCallback(update: unknown): NagCallback | null {
  if (!isObj(update) || !isObj(update.callback_query)) return null;
  const q = update.callback_query;
  if (typeof q.id !== "string" || !q.id || q.id.length > 100) return null;
  if (typeof q.data !== "string" || !q.data || q.data.length > 64) return null;
  if (!isObj(q.message) || !isObj(q.message.chat) || !["private", "group", "supergroup"].includes(String(q.message.chat.type))) return null;
  const chatId = chatIdOf(q.message.chat.id);
  const messageId = q.message.message_id;
  if (!chatId || typeof messageId !== "number" || !Number.isSafeInteger(messageId) || messageId <= 0) return null;
  const rows = isObj(q.message.reply_markup) && Array.isArray(q.message.reply_markup.inline_keyboard) ? q.message.reply_markup.inline_keyboard : [];
  const keyboard = rows.slice(0, 100).map((row: unknown) =>
    (Array.isArray(row) ? row : []).flatMap((b: unknown): InlineButton[] =>
      isObj(b) && typeof b.text === "string" && typeof b.callback_data === "string" ? [{ text: b.text.slice(0, 64), callback_data: b.callback_data.slice(0, 64) }] : [],
    ),
  ).filter((r) => r.length);
  const from = isObj(q.from) ? [q.from.first_name, q.from.last_name].filter((x) => typeof x === "string" && x.trim()).join(" ") : "";
  return { id: q.id, chatId, messageId, data: q.data, keyboard, fromName: from || "Telegram" };
}

/** "/start CODE" → the code; "/start" alone → ""; "/stop" → null with stop=true; anything else → neither. */
export function parseOfficeCommand(text: string): { start?: string; stop?: true } {
  const m = /^\/(start|stop)(?:@[A-Za-z0-9_]{1,64})?(?:\s+(\S+))?\s*$/i.exec(text.trim());
  if (!m) return {};
  return m[1].toLowerCase() === "stop" ? { stop: true } : { start: m[2] ?? "" };
}
