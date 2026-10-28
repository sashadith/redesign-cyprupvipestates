// Pure, client-safe core of developer client registration.
// Imports only libphonenumber-js: no prisma, no node: modules.
import { parsePhoneNumberFromString } from "libphonenumber-js";

export type RegChannel = "NONE" | "EMAIL" | "WHATSAPP";
export type RegStatus = "SENT" | "PRELIMINARY" | "FIXED" | "REJECTED" | "FAILED";
export type RegMark = "PRELIMINARY" | "FIXED" | "REJECTED";

export const REMINDER_AFTER_MS = 2 * 86_400_000;

const INTL_REASON = "Store the phone in international format (+country code) first.";

type Parsed = { ok: true; code: string; national: string } | { ok: false; reason: string };

function parseInternational(raw: string | null | undefined): Parsed {
  if (!raw) return { ok: false, reason: INTL_REASON };
  let s = String(raw).replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!s.startsWith("+")) return { ok: false, reason: INTL_REASON };
  const p = parsePhoneNumberFromString(s);
  if (!p || p.nationalNumber.length < 6) {
    return { ok: false, reason: "The phone number could not be read; check it." };
  }
  return { ok: true, code: String(p.countryCallingCode), national: String(p.nationalNumber) };
}

export function maskPhone(
  raw: string | null | undefined,
): { ok: true; masked: string } | { ok: false; reason: string } {
  const p = parseInternational(raw);
  if (!p.ok) return p;
  return { ok: true, masked: `+${p.code}XXXX${p.national.slice(-4)}` };
}

const eur = (n: number) => `€${n.toLocaleString("en-US")}`;

export function formatBudget(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return min === max ? eur(min) : `${eur(min)} – ${eur(max)}`;
  if (max != null) return `up to ${eur(max)}`;
  if (min != null) return `from ${eur(min)}`;
  return null;
}

export function parseBudgetInput(raw: unknown): { ok: true; value: number | null } | { ok: false } {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  if (typeof raw === "number") {
    return Number.isSafeInteger(raw) && raw >= 0 ? { ok: true, value: raw } : { ok: false };
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t === "") return { ok: true, value: null };
    if (!/^[0-9]+$/.test(t)) return { ok: false };
    const n = Number(t);
    return Number.isSafeInteger(n) ? { ok: true, value: n } : { ok: false };
  }
  return { ok: false };
}

export function buildRegistrationMessage(i: {
  clientName: string;
  maskedPhone: string;
  projects: string[];
  budget: string | null;
  contactPerson: string | null;
  staffName: string;
  // Several people read it (more than one address, or a group chat).
  plural?: boolean;
}): { subject: string; text: string } {
  const lines = [
    `Dear ${i.plural ? "all" : i.contactPerson || "Sales Team"},`,
    "",
    "We would like to register the following client with you:",
    "",
    `Full name: ${i.clientName}`,
    `Phone: ${i.maskedPhone}`,
  ];
  if (i.projects.length) lines.push(`Preferred project${i.projects.length > 1 ? "s" : ""}: ${i.projects.join(", ")}`);
  if (i.budget) lines.push(`Budget: ${i.budget}`);
  lines.push("", "Please confirm the registration.", "", "Kind regards,", i.staffName, "Cyprus VIP Estates");
  return {
    subject: `Client registration – ${i.clientName} – Cyprus VIP Estates`,
    text: lines.join("\n"),
  };
}

export const MESSAGE_MAX = 4000;

// A text the operator edited in the preview. Staff may reword anything, but the
// anti-goal stands: the client's full phone number or email never leaves.
export function checkEditedText(
  raw: unknown,
  lead: { phone: string | null; email: string | null },
): { ok: true; text: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "The message text is missing." };
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!text) return { ok: false, error: "The message text is empty." };
  if (text.length > MESSAGE_MAX) return { ok: false, error: `The message is too long (${MESSAGE_MAX} characters max).` };
  const email = (lead.email ?? "").trim().toLowerCase();
  if (email && text.toLowerCase().includes(email)) return { ok: false, error: "The message contains the client's email address — remove it." };
  const p = parseInternational(lead.phone);
  if (p.ok) {
    const runs = text.match(/\d[\d\s\-().\/+]{4,}\d/g) ?? [];
    if (runs.some((r) => r.replace(/\D/g, "").includes(p.national))) {
      return { ok: false, error: "The message contains the client's full phone number — keep it masked." };
    }
  }
  return { ok: true, text };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function uniq(a: string[]): string[] {
  return a.filter((v, idx) => a.indexOf(v) === idx);
}

// A WhatsApp group chat id as the gateway reports it.
export const isGroupChatId = (s: string) => /^\d{6,40}(-\d{6,20})?@g\.us$/.test(s);
const GROUP_NAME_MAX = 120;

export function normalizeProfile(
  input: { channel: string; emailTo: string; emailCc: string; whatsApp: string; whatsAppGroupId?: string; whatsAppGroupName?: string },
  officeAddress: string,
):
  | { ok: true; value: { channel: RegChannel; emailTo: string[]; emailCc: string[]; whatsApp: string[]; whatsAppGroupId: string | null; whatsAppGroupName: string | null } }
  | { ok: false; error: string } {
  if (input.channel !== "NONE" && input.channel !== "EMAIL" && input.channel !== "WHATSAPP") {
    return { ok: false, error: "Unknown channel." };
  }
  const channel = input.channel as RegChannel;
  const office = officeAddress.trim().toLowerCase();

  const split = (s: string) => uniq((s || "").split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean));
  const emailTo = split(input.emailTo);
  let emailCc = split(input.emailCc);
  for (const a of [...emailTo, ...emailCc]) {
    if (!EMAIL_RE.test(a)) return { ok: false, error: `Not a valid email address: ${a}` };
  }
  if (emailCc.includes(office)) return { ok: false, error: "office@ is the sender; remove it from CC." };
  if (emailTo.includes(office)) return { ok: false, error: "office@ is the sender; remove it from To." };
  emailCc = emailCc.filter((a) => !emailTo.includes(a));

  const waRaw = (input.whatsApp || "").split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
  const whatsApp: string[] = [];
  for (const w of waRaw) {
    const p = parseInternational(w);
    if (!p.ok) return { ok: false, error: `${w}: ${p.reason}` };
    whatsApp.push(`+${p.code}${p.national}`);
  }
  const wa = uniq(whatsApp);

  const groupId = (input.whatsAppGroupId || "").trim() || null;
  const groupName = groupId ? (input.whatsAppGroupName || "").trim().slice(0, GROUP_NAME_MAX) || null : null;
  if (groupId && !isGroupChatId(groupId)) return { ok: false, error: "Not a WhatsApp group — pick one from the list." };
  if (groupId && !groupName) return { ok: false, error: "The WhatsApp group has no name — pick it from the list again." };

  if (channel === "EMAIL" && emailTo.length === 0) return { ok: false, error: "Add at least one address." };
  if (channel === "WHATSAPP" && wa.length === 0 && !groupId) return { ok: false, error: "Add a WhatsApp number or pick a group." };
  return { ok: true, value: { channel, emailTo, emailCc, whatsApp: wa, whatsAppGroupId: groupId, whatsAppGroupName: groupName } };
}

export function isRegistrable(d: {
  registrationChannel: RegChannel;
  registrationEmailTo: string[];
  registrationWhatsApp: string[];
  registrationWhatsAppGroupId?: string | null;
}): boolean {
  if (d.registrationChannel === "EMAIL") return d.registrationEmailTo.length > 0;
  if (d.registrationChannel === "WHATSAPP") return d.registrationWhatsApp.length > 0 || !!d.registrationWhatsAppGroupId;
  return false;
}

export function canMark(from: RegStatus, mark: RegMark): boolean {
  if (mark === "PRELIMINARY") return from === "SENT";
  if (mark === "FIXED") return from === "SENT" || from === "PRELIMINARY";
  return from === "SENT" || from === "PRELIMINARY"; // REJECTED
}

export function undoTarget(current: RegStatus, hasPreliminary: boolean): RegStatus | null {
  if (current === "PRELIMINARY") return "SENT";
  if (current === "FIXED" || current === "REJECTED") return hasPreliminary ? "PRELIMINARY" : "SENT";
  return null;
}

export function canResend(s: RegStatus): boolean {
  return s === "FAILED" || s === "REJECTED";
}
