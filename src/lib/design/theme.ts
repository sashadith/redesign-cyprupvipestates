// Pure design-theme module: colour roles, sets, validation, contrast, CSS vars.
// No Prisma / Next imports.

export const ROLE_KEYS = ["page", "surface", "card", "text", "muted", "accent", "accentText", "accentHover", "gold", "border", "onAccent", "field"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];
export type SetValues = Record<RoleKey, string>;

export const HEADING_FONTS = ["Fraunces", "Playfair Display", "Cormorant Garamond", "Bodoni Moda", "EB Garamond", "Spectral"] as const;
export const BODY_FONTS = ["Mulish", "Manrope", "Onest", "Commissioner", "Tenor Sans"] as const;
export type HeadingFont = (typeof HEADING_FONTS)[number];
export type BodyFont = (typeof BODY_FONTS)[number];

export type GlobalSettings = {
  headingFont: HeadingFont;
  bodyFont: BodyFont;
  crmBase: number;
  portalBase: number;
  emailBase: number;
  headingScale: number;
  radius: number;
  derivedAccent: boolean;
};

function fromList(list: string): SetValues {
  const parts = list.split(/\s+/);
  const out = {} as SetValues;
  ROLE_KEYS.forEach((k, i) => { out[k] = parts[i]; });
  return out;
}

export const CLASSIC: SetValues = fromList("#F5F1E8 #EDE7D9 #FBF9F3 #221C15 #59534C #8E6B3D #7A5A30 #6E512B #C29A5E #E4DCCB #FFFFFF #FFFFFF");
export const WEBSITE: SetValues = fromList("#081512 #0C1E1B #102826 #EFE9DB #AEAEA3 #C29A5E #C29A5E #D8B268 #C29A5E #2D3732 #081512 #0B1A17");

export const STARTER_SETS: { name: string; values: SetValues }[] = [
  { name: "Stone grey", values: fromList("#F2F3F4 #E6E8EA #FAFBFB #1E2124 #4F555B #2F5D62 #2A5357 #23464A #A9B4B8 #D9DDE0 #FFFFFF #FFFFFF") },
  { name: "Navy", values: fromList("#F4F6F9 #E8ECF2 #FBFCFD #18202B #4D5664 #1F3A5F #1F3A5F #172C48 #B89B5E #DCE1E8 #FFFFFF #FFFFFF") },
  { name: "Anthracite gold", values: fromList("#16181A #1D2023 #23272A #ECE7DD #A9A49A #C29A5E #C9A46A #D8B47A #C29A5E #363A3E #16181A #1B1E21") },
];

export const DEFAULT_GLOBAL: GlobalSettings = {
  headingFont: "Fraunces", bodyFont: "Mulish",
  crmBase: 14, portalBase: 16, emailBase: 15,
  headingScale: 1, radius: 16, derivedAccent: true,
};

export const RANGES = {
  crmBase: [12, 18], portalBase: [14, 20], emailBase: [13, 18], headingScale: [0.8, 1.3], radius: [0, 24],
} as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function normalizeSetValues(raw: unknown): SetValues {
  const out = { ...CLASSIC };
  if (!isObj(raw)) return out;
  for (const k of ROLE_KEYS) {
    const v = raw[k];
    if (typeof v === "string" && HEX.test(v)) out[k] = v.toUpperCase();
  }
  return out;
}

export function validateSetValues(raw: unknown): { ok: true; values: SetValues } | { ok: false; errors: Partial<Record<RoleKey, string>> } {
  const errors: Partial<Record<RoleKey, string>> = {};
  const values = {} as SetValues;
  const src = isObj(raw) ? raw : {};
  for (const k of ROLE_KEYS) {
    const v = src[k];
    if (typeof v !== "string") errors[k] = "Required (#RRGGBB)";
    else if (!HEX.test(v)) errors[k] = "Must be a #RRGGBB colour";
    else values[k] = v.toUpperCase();
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values };
}

type NumKey = "crmBase" | "portalBase" | "emailBase" | "headingScale" | "radius";
const NUM_KEYS: NumKey[] = ["crmBase", "portalBase", "emailBase", "headingScale", "radius"];

function numOk(k: NumKey, v: unknown): v is number {
  const [lo, hi] = RANGES[k];
  return typeof v === "number" && isFinite(v) && v >= lo && v <= hi;
}
function headingOk(v: unknown): v is HeadingFont { return typeof v === "string" && (HEADING_FONTS as readonly string[]).includes(v); }
function bodyOk(v: unknown): v is BodyFont { return typeof v === "string" && (BODY_FONTS as readonly string[]).includes(v); }

export function normalizeGlobal(raw: unknown): GlobalSettings {
  const out: GlobalSettings = { ...DEFAULT_GLOBAL };
  if (!isObj(raw)) return out;
  if (headingOk(raw.headingFont)) out.headingFont = raw.headingFont;
  if (bodyOk(raw.bodyFont)) out.bodyFont = raw.bodyFont;
  for (const k of NUM_KEYS) if (numOk(k, raw[k])) out[k] = raw[k] as number;
  if (typeof raw.derivedAccent === "boolean") out.derivedAccent = raw.derivedAccent;
  return out;
}

export function validateGlobal(raw: unknown): { ok: true; value: GlobalSettings } | { ok: false; errors: Record<string, string> } {
  if (!isObj(raw)) return { ok: false, errors: { _: "Settings must be an object" } };
  const errors: Record<string, string> = {};
  if (!headingOk(raw.headingFont)) errors.headingFont = "Unknown heading font";
  if (!bodyOk(raw.bodyFont)) errors.bodyFont = "Unknown body font";
  for (const k of NUM_KEYS) {
    if (!numOk(k, raw[k])) errors[k] = `Must be a number from ${RANGES[k][0]} to ${RANGES[k][1]}`;
  }
  if (typeof raw.derivedAccent !== "boolean") errors.derivedAccent = "Must be true or false";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: normalizeGlobal(raw) };
}

// ---- contrast ----

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

export type ContrastWarning = { pair: string; fg: RoleKey; bg: RoleKey; ratio: number };

const PAIRS: { pair: string; fg: RoleKey; bg: RoleKey }[] = [
  { pair: "text/page", fg: "text", bg: "page" },
  { pair: "text/card", fg: "text", bg: "card" },
  { pair: "muted/card", fg: "muted", bg: "card" },
  { pair: "accentText/page", fg: "accentText", bg: "page" },
  { pair: "accentText/card", fg: "accentText", bg: "card" },
  { pair: "onAccent/accent", fg: "onAccent", bg: "accent" },
  { pair: "text/field", fg: "text", bg: "field" },
];

export function contrastWarnings(v: SetValues): ContrastWarning[] {
  const out: ContrastWarning[] = [];
  for (const p of PAIRS) {
    const ratio = contrastRatio(v[p.fg], v[p.bg]);
    if (ratio < 4.5) out.push({ ...p, ratio });
  }
  return out;
}

export function isDarkSet(v: SetValues): boolean {
  return luminance(v.card) < 0.4;
}

// ---- accent derivation ----

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map((x) => x / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

function fromHsl(h: number, s: number, l: number): string {
  const sat = s / 100, lig = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lig - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const hx = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return ("#" + hx(r) + hx(g) + hx(b)).toUpperCase();
}

export function deriveAccentVariants(accent: string, page: string, card: string): { accentText: string; accentHover: string } {
  const dir = luminance(page) >= 0.4 ? -1 : 1;
  const [h, s, l] = toHsl(accent);
  const at = (n: number) => (n === 0 ? accent.toUpperCase() : fromHsl(h, s, l + dir * 3 * n));
  const passes = (c: string) => contrastRatio(c, page) >= 4.5 && contrastRatio(c, card) >= 4.5;
  let n = 0;
  while (n < 30 && !passes(at(n))) n++;
  return { accentText: at(n), accentHover: at(n + 1) };
}

// ---- CSS vars / email ----

const CSS_NAMES: Record<RoleKey, string> = {
  page: "page", surface: "surface", card: "card", text: "text", muted: "muted", accent: "accent",
  accentText: "accent-text", accentHover: "accent-hover", gold: "gold", border: "border",
  onAccent: "on-accent", field: "field",
};

function num(x: number): string {
  return String(Number(x.toFixed(4)));
}

export function cssVars(v: SetValues, g: GlobalSettings): string {
  const parts: string[] = ROLE_KEYS.map((k) => `--ds-${CSS_NAMES[k]}:${v[k]}`);
  parts.push(`--ds-font-heading:'${g.headingFont}'`);
  parts.push(`--ds-font-body:'${g.bodyFont}'`);
  parts.push(`--ds-crm-scale:${num(g.crmBase / 14)}`);
  parts.push(`--ds-portal-scale:${num(g.portalBase / 16)}`);
  parts.push(`--ds-heading-scale:${num(g.headingScale)}`);
  parts.push(`--ds-radius-scale:${num(g.radius / 16)}`);
  return parts.join(";");
}

export type EmailTheme = {
  page: string; card: string; text: string; muted: string; accent: string; onAccent: string;
  gold: string; border: string; base: number; radius: number; headingFamily: string;
};

export function emailTheme(v: SetValues, g: GlobalSettings): EmailTheme {
  return {
    page: v.page, card: v.card, text: v.text, muted: v.muted, accent: v.accent, onAccent: v.onAccent,
    gold: v.gold, border: v.border, base: g.emailBase, radius: g.radius,
    headingFamily: "Georgia,'Times New Roman',serif",
  };
}

export const CLASSIC_EMAIL_THEME: EmailTheme = emailTheme(CLASSIC, DEFAULT_GLOBAL);
