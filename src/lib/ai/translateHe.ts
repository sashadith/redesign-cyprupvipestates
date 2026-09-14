import { anthropic, AI_MODEL } from "./anthropic";
import { heSystemBlock } from "./heContext";
import { hasHebrew, scriptLeaks } from "./localeTextGuards";
import { styleViolations } from "@/lib/heStyleRules";

/* EN→HE translator for the VOLUME content — development descriptions and their
 * SEO pairs, area texts, developer profiles. Everything the site has hundreds of
 * and nobody is going to hand-author (the hand-authored pages live in
 * `content/he/**` instead).
 *
 * Two model calls per attempt, deliberately:
 *   Pass A — translate the EN payload into Hebrew, same JSON shape.
 *   Pass B — a critic re-reads Pass A against styleguide §7 (banned AI patterns)
 *            and §11 (Pass B learnings) and returns a CORRECTED payload plus the
 *            list of what it changed. That list is surfaced as `critique` so the
 *            admin sample view shows what the second pass caught.
 *
 * Then the machine guards run (Hebrew present, no script leak, no style-rule hit,
 * meta inside 60/155 graphemes, no digits in evergreen prose). A violation buys
 * exactly ONE more full A+B attempt with the violations named; after that this
 * throws rather than writing half-good Hebrew into a row nobody re-reads. Same
 * posture as generateProjectDescription/generateSeoMeta: a visible failure in the
 * queue beats a silent bad save.
 */

export type HeTranslateKind =
  | "developmentDescription"
  | "developmentSeo"
  | "areaText"
  | "developerProfile";

export type HeTranslatePayload = {
  /** Running prose (development description, area text). */
  text?: string;
  /** Meta title (developmentSeo) or the developer's Latin name (developerProfile — never translated). */
  title?: string;
  /** Meta description (developmentSeo) or an HTML/plain-string profile body. */
  description?: string;
  /** Developer profile teaser. */
  excerpt?: string;
  /** Latin slug — copied through untouched. */
  slug?: string;
  /** Sanity-style portable text: only `children[].text` is translated. */
  portableText?: unknown;
  /** Developer profile SEO pair. */
  seo?: { metaTitle?: string; metaDescription?: string };
};

export type HeTranslateInput = {
  kind: HeTranslateKind;
  en: HeTranslatePayload;
  /** Short factual bullets the translator may lean on; never invented from. */
  facts?: string[];
};

export type HeTranslateResult = {
  he: HeTranslatePayload;
  critique: string[];
  attempts: number;
};

type AnthropicMessage = { content: unknown[]; stop_reason?: string | null };
export type AnthropicLike = {
  messages: { create(args: Record<string, unknown>): Promise<AnthropicMessage> };
};

export type TranslateHeDeps = { client?: AnthropicLike };

export class HeTranslationError extends Error {
  violations: string[];
  attempts: number;
  constructor(violations: string[], attempts: number) {
    super(`Hebrew translation failed after ${attempts} attempt(s): ${violations.join("; ")}`);
    this.name = "HeTranslationError";
    this.violations = violations;
    this.attempts = attempts;
  }
}

export const TITLE_GRAPHEME_MAX = 60;
export const DESC_GRAPHEME_MAX = 155;
const MAX_TOKENS = 4000;

/** Grapheme count (what a Hebrew meta field is actually budgeted in). */
export function graphemeLength(s: string): number {
  const t = String(s ?? "");
  try {
    const Seg = (Intl as any).Segmenter;
    if (Seg) return Array.from(new Seg("he", { granularity: "grapheme" }).segment(t) as Iterable<unknown>).length;
  } catch {
    /* fall through */
  }
  return Array.from(t).length;
}

// Letter test without the /u flag (tsconfig has no `target`, so ES5 rules apply):
// Latin, Latin-1/extended, Greek, Cyrillic, Hebrew — everything an EN source row
// or a Hebrew output can realistically contain.
const LETTER_RE = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF]/;
const hasLetters = (s: unknown): boolean => typeof s === "string" && LETTER_RE.test(s);

// ── payload plumbing ────────────────────────────────────────────────────────

/** The fields this kind actually carries — everything else is dropped from the prompt. */
const FIELDS: Record<HeTranslateKind, (keyof HeTranslatePayload)[]> = {
  developmentDescription: ["text"],
  developmentSeo: ["title", "description"],
  areaText: ["text"],
  developerProfile: ["slug", "title", "excerpt", "description", "portableText", "seo"],
};

function payloadFor(input: HeTranslateInput): HeTranslatePayload {
  const out: HeTranslatePayload = {};
  for (const f of FIELDS[input.kind]) {
    const v = input.en[f];
    if (v === undefined || v === null) continue;
    (out as any)[f] = v;
  }
  return out;
}

/* Keys that are pure structure/styling: they are copied from the English
   verbatim and NOT compared against whatever the model returned. A model that
   drops `marks` or rewrites `markDefs` is not breaking the translation — those
   values simply never come from it. Only text-bearing containers (`children`)
   are structurally compared, because a changed length there means a lost or
   invented sentence. */
const KEEP_FROM_EN = ["_key", "_type", "style", "level", "listItem", "marks", "markDefs", "asset", "href"];

/** Deep-clone the EN portable text, substituting only the Hebrew span texts. */
export function mergePortableText(
  en: unknown,
  he: unknown,
  problems: string[],
  path = "portableText",
): unknown {
  if (Array.isArray(en)) {
    if (!Array.isArray(he) || he.length !== en.length) {
      problems.push(`portable text: array length changed at ${path} (${Array.isArray(he) ? he.length : "missing"} vs ${en.length})`);
      return en;
    }
    return en.map((v, i) => mergePortableText(v, he[i], problems, `${path}[${i}]`));
  }
  if (en && typeof en === "object") {
    if (!he || typeof he !== "object" || Array.isArray(he)) {
      problems.push(`portable text: object missing at ${path}`);
      return en;
    }
    const enObj = en as Record<string, unknown>;
    const heObj = he as Record<string, unknown>;
    const out: Record<string, unknown> = { ...enObj };
    for (const k of Object.keys(enObj)) {
      const v = enObj[k];
      if (k === "text" && typeof v === "string") {
        const hv = heObj[k];
        if (typeof hv !== "string" || (hasLetters(v) && !hv.trim())) {
          problems.push(`portable text: missing Hebrew text at ${path}.text`);
        } else {
          out[k] = hv;
        }
      } else if (v && typeof v === "object" && KEEP_FROM_EN.indexOf(k) === -1) {
        out[k] = mergePortableText(v, heObj[k], problems, `${path}.${k}`);
      }
      // Everything else (KEEP_FROM_EN, numbers, booleans) stays as the English has it.
    }
    return out;
  }
  return en;
}

/** Every Hebrew string in an output payload, as `[label, value]` pairs. */
export function outputStrings(p: HeTranslatePayload): [string, string][] {
  const out: [string, string][] = [];
  for (const k of ["text", "excerpt", "description", "title"] as const) {
    const v = p[k];
    if (typeof v === "string" && v) out.push([k, v]);
  }
  if (p.seo) {
    if (p.seo.metaTitle) out.push(["seo.metaTitle", p.seo.metaTitle]);
    if (p.seo.metaDescription) out.push(["seo.metaDescription", p.seo.metaDescription]);
  }
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === "text" && typeof v === "string" && v) out.push([`${path}.text`, v]);
        else if (v && typeof v === "object") walk(v, `${path}.${k}`);
      }
    }
  };
  if (p.portableText !== undefined) walk(p.portableText, "portableText");
  return out;
}

// ── prompts ─────────────────────────────────────────────────────────────────

const KIND_RULES: Record<HeTranslateKind, string> = {
  developmentDescription: [
    "This is a property description that is SAVED ONCE and never regenerated, while the project's real numbers move with every feed sync.",
    "NEVER write a digit: no unit counts, no prices, no completion dates or quarters, no square metres, no percentages. Do not spell a figure out in words to get around this either — drop the fact instead.",
    "Keep the paragraph structure of the English: the same number of paragraphs, separated by a blank line.",
    "Never name the project or the developer.",
  ].join(" "),
  developmentSeo: [
    `"title" is a meta title: at most ${TITLE_GRAPHEME_MAX} characters. "description" is a meta description: at most ${DESC_GRAPHEME_MAX} characters. Count the characters you actually type.`,
    "Hebrew runs shorter than English for the same content — the risk is under-filling, not overshooting; aim for the middle of the band.",
    "Any {placeholder} token (for example {priceFrom}, {unitsAvailable}, {completion}) must be reproduced EXACTLY, braces included, and must not be the last thing in the description. A placeholder counts as the literal characters you type.",
    "Write no digits of your own; the placeholders are the only way a figure reaches the page.",
  ].join(" "),
  areaText: [
    "This is an evergreen neighbourhood description. Translate the meaning, not the word order.",
    "Do not add a fact the English does not state.",
  ].join(" "),
  developerProfile: [
    '"slug" and "title" are Latin identifiers and a brand name: copy them through UNCHANGED, do not transliterate them into Hebrew.',
    'Translate "excerpt", the text inside "description"/"portableText", and the "seo" pair.',
    'If "portableText" is present it is Sanity portable text: return the SAME structure with the SAME number of array entries, and translate ONLY the string under each `children[].text`. Never change, drop or renumber `_key`, `_type`, `marks`, `markDefs`, `style`.',
    'If "description" is an HTML or plain string, translate the text nodes only and leave every tag and attribute untouched.',
    `In "seo", metaTitle stays at most ${TITLE_GRAPHEME_MAX} characters and metaDescription at most ${DESC_GRAPHEME_MAX}.`,
  ].join(" "),
};

function passAPrompt(input: HeTranslateInput, corrections: string[]): string {
  const parts = [
    "You translate English website copy into native Hebrew for an Israeli audience buying property in Cyprus.",
    "",
    "The binding Hebrew style guide and glossary are in the system prompt. Follow them; the glossary wins over your own word choice.",
    "",
    `Content kind: ${input.kind}.`,
    KIND_RULES[input.kind],
    "",
    "General rules:",
    "- Write Hebrew that reads as if it was written in Hebrew, not translated. Rework the word order; do not mirror the English syntax.",
    "- Change no facts. Add no fact the English does not contain. Drop nothing the English does contain (except a figure a rule above forbids).",
    "- Latin proper names (project names, developer names, Cyprus VIP Estates, GDPR) stay in Latin script.",
    "- Western digits, the currency symbol before the number, no em dash, no exclamation marks, no slash gender forms.",
    "",
    input.facts?.length ? `Facts you may rely on (never invent beyond them):\n${input.facts.map((f) => `- ${f}`).join("\n")}\n` : "",
    "English payload (JSON):",
    "```json",
    JSON.stringify(payloadFor(input), null, 2),
    "```",
    "",
    "Return ONLY a JSON object with EXACTLY the same keys and the same structure, with the Hebrew values in place of the English ones. No prose before or after it, no markdown fences around anything else.",
  ];
  if (corrections.length) {
    parts.push(
      "",
      "Your previous attempt was rejected. Fix every one of these and do not reintroduce them:",
      ...corrections.map((v) => `- ${v}`),
    );
  }
  return parts.filter((p) => p !== "").join("\n");
}

function passBPrompt(input: HeTranslateInput, draft: HeTranslatePayload): string {
  return [
    "Read the Hebrew below as an Israeli copy editor reviewing a translation.",
    "",
    "Mark every anglicism, calque, gender error, unnatural word order, marketing cliché, and every breach of §7 (banned AI patterns) or §11 (Pass B learnings) of the style guide in the system prompt.",
    "Rewrite each marked passage so it reads as if it had been written in Hebrew from the start. Change NO facts, add none, drop none.",
    "Keep every structural element identical: the same JSON keys, the same array lengths, the same `_key`/`_type`/`marks`/`markDefs`, the same Latin identifiers, the same {placeholder} tokens.",
    "",
    "English source (JSON):",
    "```json",
    JSON.stringify(payloadFor(input), null, 2),
    "```",
    "",
    "Hebrew draft (JSON):",
    "```json",
    JSON.stringify(draft, null, 2),
    "```",
    "",
    'Return ONLY a JSON object of the form {"violations": ["short English note per change"], "corrected": { …the corrected Hebrew payload, same shape as the draft… }}.',
    'If the draft needs no change, return an empty "violations" array and the draft unchanged as "corrected".',
  ].join("\n");
}

// ── response parsing ────────────────────────────────────────────────────────

function textOf(msg: AnthropicMessage): string {
  const blocks = Array.isArray(msg?.content) ? msg.content : [];
  return blocks
    .map((b) => (b && typeof b === "object" && (b as { type?: string }).type === "text" ? String((b as { text?: unknown }).text ?? "") : ""))
    .join("\n")
    .trim();
}

/** Pull the first top-level JSON object out of a model reply (fences tolerated). */
export function parseJsonReply(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("model reply contained no JSON object");
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("model reply was not a JSON object");
  return parsed as Record<string, unknown>;
}

// ── assembly + guards ───────────────────────────────────────────────────────

/** Build the output payload from the model's JSON, keeping EN structure where it must be kept. */
function assemble(input: HeTranslateInput, raw: Record<string, unknown>, problems: string[]): HeTranslatePayload {
  const en = payloadFor(input);
  const out: HeTranslatePayload = {};
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

  if (en.text !== undefined) out.text = str(raw.text);
  if (en.excerpt !== undefined) out.excerpt = str(raw.excerpt);

  if (input.kind === "developerProfile") {
    // Latin identity is not the model's to change (styleguide: proper names stay Latin).
    if (en.slug !== undefined) out.slug = en.slug;
    if (en.title !== undefined) out.title = en.title;
  } else if (en.title !== undefined) {
    out.title = str(raw.title);
  }

  if (en.description !== undefined) out.description = str(raw.description);

  if (en.portableText !== undefined) {
    out.portableText = mergePortableText(en.portableText, (raw as { portableText?: unknown }).portableText, problems);
  }

  if (en.seo !== undefined) {
    const rawSeo = (raw.seo && typeof raw.seo === "object" ? raw.seo : {}) as Record<string, unknown>;
    out.seo = {
      ...(en.seo?.metaTitle !== undefined ? { metaTitle: str(rawSeo.metaTitle) } : {}),
      ...(en.seo?.metaDescription !== undefined ? { metaDescription: str(rawSeo.metaDescription) } : {}),
    };
  }
  return out;
}

/** Every reason this Hebrew payload may not be saved. Empty = clean. */
export function guardViolations(input: HeTranslateInput, he: HeTranslatePayload): string[] {
  const problems: string[] = [];
  const en = payloadFor(input);
  const heStrings = outputStrings(he);

  // 1. Every field whose English had letters must come back with Hebrew in it.
  const enPairs = outputStrings(en);
  const heMap = new Map(heStrings);
  for (const [label, enValue] of enPairs) {
    if (input.kind === "developerProfile" && (label === "slug" || label === "title")) continue;
    if (!hasLetters(enValue)) continue;
    const heValue = heMap.get(label) ?? "";
    if (!heValue.trim()) problems.push(`${label}: empty (English had text)`);
    else if (!hasHebrew(heValue)) problems.push(`${label}: no Hebrew script`);
  }

  // 2. Script leaks (Hebrew missing, Cyrillic bleed) across the whole output.
  const joined = heStrings.map(([, v]) => v).join("\n");
  if (joined.trim()) for (const leak of scriptLeaks({ he: joined })) problems.push(leak);

  // 3. The shared style-rule list (em dash, exclamation, slash forms, glossary spellings).
  for (const [label, value] of heStrings) {
    for (const v of styleViolations(value)) problems.push(`${label}: ${v}`);
  }

  // 4. Meta budgets, in graphemes.
  const metaChecks: [string, string | undefined, number][] = [];
  if (input.kind === "developmentSeo") {
    metaChecks.push(["title", he.title, TITLE_GRAPHEME_MAX], ["description", he.description, DESC_GRAPHEME_MAX]);
  }
  if (he.seo) {
    metaChecks.push(["seo.metaTitle", he.seo.metaTitle, TITLE_GRAPHEME_MAX], ["seo.metaDescription", he.seo.metaDescription, DESC_GRAPHEME_MAX]);
  }
  for (const [label, value, max] of metaChecks) {
    if (!value) continue;
    const n = graphemeLength(value);
    if (n > max) problems.push(`${label}: ${n} graphemes, budget ${max} — shorten by dropping the weakest detail`);
  }

  // 5. Evergreen prose carries no figures (they rot; see projectDescription.ts).
  if (input.kind === "developmentDescription") {
    for (const [label, value] of heStrings) {
      if (/\d/.test(value)) problems.push(`${label}: contains a digit (saved copy must carry no figure)`);
    }
  }

  // 6. Placeholders survive the translation verbatim.
  const tokens = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(",");
  for (const [label, enValue] of enPairs) {
    const heValue = heMap.get(label) ?? "";
    if (tokens(enValue) !== tokens(heValue)) {
      problems.push(`${label}: {placeholder} tokens changed (expected ${tokens(enValue) || "none"}, got ${tokens(heValue) || "none"})`);
    }
  }

  return problems;
}

// ── the generator ───────────────────────────────────────────────────────────

export async function translateHe(input: HeTranslateInput, deps?: TranslateHeDeps): Promise<HeTranslateResult> {
  const client = deps?.client ?? (anthropic() as AnthropicLike | null);
  if (!client) throw new Error("ANTHROPIC_API_KEY not configured");
  const system = [heSystemBlock("translation")];

  const ask = async (prompt: string): Promise<Record<string, unknown>> => {
    const msg = await client.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const text = textOf(msg);
    if (!text) throw new Error(`No content (stop: ${msg?.stop_reason ?? "unknown"})`);
    return parseJsonReply(text);
  };

  let corrections: string[] = [];
  let lastViolations: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const structural: string[] = [];

    // Pass A — translate.
    const rawA = await ask(passAPrompt(input, corrections));
    const draft = assemble(input, rawA, structural);

    // Pass B — critique and correct. A critic that fails to return a usable
    // payload must not lose Pass A's work: keep the draft and note it.
    const critique: string[] = [];
    let corrected = draft;
    try {
      const rawB = await ask(passBPrompt(input, draft));
      const notes = Array.isArray(rawB.violations) ? rawB.violations.map((v) => String(v)).filter(Boolean) : [];
      critique.push(...notes);
      const body = rawB.corrected;
      if (body && typeof body === "object" && !Array.isArray(body)) {
        const structuralB: string[] = [];
        const candidate = assemble(input, body as Record<string, unknown>, structuralB);
        if (structuralB.length) {
          critique.push(`critique pass returned a broken structure, keeping pass A: ${structuralB.join("; ")}`);
        } else {
          corrected = candidate;
        }
      } else {
        critique.push("critique pass returned no corrected payload, keeping pass A");
      }
    } catch (e) {
      critique.push(`critique pass failed, keeping pass A: ${e instanceof Error ? e.message : String(e)}`);
    }

    const violations = [...structural, ...guardViolations(input, corrected)];
    if (!violations.length) return { he: corrected, critique, attempts: attempt };

    lastViolations = violations;
    corrections = violations;
  }

  throw new HeTranslationError(lastViolations, 2);
}
