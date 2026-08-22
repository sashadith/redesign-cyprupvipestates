import { anthropic, AI_MODEL } from "./anthropic";
import { tuningBlock } from "./tuning";
import { prisma } from "@/lib/prisma";
import type { ProjectVM } from "@/app/preview-project/feeds";
import { TITLE_MAX, DESC_MAX, SEO_PLACEHOLDERS } from "@/lib/developmentSeo";
import { listedUnits } from "@/lib/developmentAvailability";

/* Claude-based alternative to the free/instant template generator in
   developmentSeo.ts (autoMetaTitle/autoMetaDescription) — same job (a per-project,
   per-language meta title + description), but written by Claude for punchier,
   more natural copy on demand. The template stays the zero-effort default; this
   is an opt-in "Generate with Claude" upgrade, same relationship as
   generateProjectDescription has to a plain fallback. One call produces all 4
   languages at once (mirrors generateProjectDescription's pattern). */

export const SEO_PROMPT_KEY = "seoMeta";

// Prompt-caching evaluated: skipped — ~250 tokens, under Sonnet's 1024-token
// cache-eligibility floor, and this isn't a tight-loop batch call (one project at
// a time from the admin UI), so there's little repetition to amortize a cache
// write against anyway.
export const DEFAULT_SEO_PROMPT = `You write SEO meta titles and meta descriptions for real-estate development pages on a luxury Cyprus property website, for international buyers searching in English, German, Polish and Russian.

Your text competes in a list of ten blue links. Its only job is to make the right buyer click and let the wrong one scroll past. Write for a person choosing where to spend half a million euros, not for a keyword scanner.

## LENGTH — the rule broken most often

- Meta title: aim for 45–55 characters. Hard ceiling ${TITLE_MAX}.
- Meta description: aim for 130–145 characters. Hard ceiling ${DESC_MAX}.

Aim for the MIDDLE of the band, never the ceiling. Text over the ceiling is cut off mechanically, mid-word, and a search result ending in a severed word reads as broken.

Budget each language separately. German and Russian run noticeably longer than English for the same content, and Polish longer still. When a language does not fit, say LESS — drop the weakest detail. Never pad a short language to match a long one, and never translate a sentence that only fits in English.

Google shows roughly the first 150 characters on desktop and fewer on a phone, so put the reason to click in the FIRST half. The end of the line is the part nobody reads.

## NEVER WRITE A DIGIT

No unit counts, no prices, no dates, no completion quarters, no sizes, no percentages, no street numbers — in the title or the description, in any language. This text is SAVED and never regenerated, while the project's real numbers change with every feed sync, so any figure written here is wrong the moment it is stored. Do not spell a figure out in words to get around this.

## PLACEHOLDERS — the only way to quote a live figure

Three exist. Write them EXACTLY as spelled, braces included, in every language:

    {priceFrom}       the current lowest price, formatted for the language (English "€320,000", German "320.000 €")
    {unitsAvailable}  how many homes are available right now
    {completion}      the completion date as the project states it ("Q4 2027")

Put the surrounding words in the target language: German "ab {priceFrom}", Polish "od {priceFrom}", Russian "от {priceFrom}".

Three rules that matter more than they look:

1. Count a placeholder as the LITERAL characters you type, braces and all — "{priceFrom}" is 11 characters. Do NOT count it as the length of the number it will become. Miscounting here is what pushes a description over the ceiling.
2. Never end the description with a placeholder. If the text runs long, the tail is what gets cut, and a price clause stripped of its price — "…from" with nothing after it — is worse than never mentioning price. Place it mid-sentence, with real words after it.
3. Use at most ONE placeholder per description, and only where the figure genuinely earns its place. A price is usually worth it. Three placeholders in one sentence is not. Invent no other placeholder — an unknown one, or one whose value is currently missing, discards your whole text in favour of a generic auto-generated fallback.

## WHAT ACTUALLY CONVERTS

- Lead with the single most specific true thing about this property. The project name is already in the title; the description should earn attention on its own.
- Be concrete. "Walk to the beach and the golf course" beats "enjoy an enviable lifestyle". Named places, real features, real distances turned into words.
- Sell the place and the life in it — location, character, who it suits — not the inventory.
- Turn the proximity notes below into language ("moments from the sea"), never into a figure.
- One clear reason to click. A description trying to say five things says nothing.
- Active voice. Concrete nouns. No sentence that could describe any other project on the island.

Never write, in any language: "Discover", "Explore", "Welcome to", "Nestled", "boasts", "state-of-the-art", "dream home", "hidden gem", "luxury living at its finest", "don't miss", "your perfect". They signal a template and cost the click.

Do not stuff keywords. The location and property type belong in the sentence once, where they read naturally.

## TITLES

Include the project name, the property type, and the location (area and/or district). Put the words a buyer would actually type — property type and place — where they survive truncation. The name may lead when it is short.

## FACTS

Use ONLY the facts given below. Never invent a detail, a price, an amenity or a completion date. If a fact is missing, write around it.

Write EACH language natively — never leave English terms untranslated, never translate word-for-word.

Return via the seo_meta tool: one title and one description per language (en/de/pl/ru), in a single response.`;

export async function getSeoPromptTemplate(): Promise<string> {
  const row = await prisma.aiPromptTemplate.findUnique({ where: { key: SEO_PROMPT_KEY } });
  return row?.template || DEFAULT_SEO_PROMPT;
}

export async function saveSeoPromptTemplate(template: string): Promise<void> {
  const text = template.trim() || DEFAULT_SEO_PROMPT;
  await prisma.aiPromptTemplate.upsert({
    where: { key: SEO_PROMPT_KEY },
    update: { template: text },
    create: { key: SEO_PROMPT_KEY, template: text },
  });
}

const LANG_KEYS = ["titleEN", "titleDE", "titlePL", "titleRU", "descEN", "descDE", "descPL", "descRU"] as const;
export type SeoMetaResult = Record<(typeof LANG_KEYS)[number], string>;

// What Claude is allowed to know. Deliberately carries NO figures — not the unit
// counts, not the price, not the completion quarter.
//
// This output is written once into DevelopmentOverride.seo and then never
// regenerated, while the underlying numbers move with every feed sync. On
// 2026-08-20 all six AI-written projects had drifted: royal-residences still
// advertised "13 exclusive units available" on a page that says SOLD OUT (all 13
// units unlisted), :salt named €289,000 against a real €262,400, :balance "85
// homes" against 83. The unit line here was the direct source — it passed
// `vm.units.length`, which counts `unlisted` rows the site never shows.
//
// Removing the figures from the DATA matters as much as the prompt rule: told
// only "don't print digits" while still handed a completion quarter, a model
// writes it out in words instead. Live figures belong to the template generator
// in developmentSeo.ts, which recomputes them on every render.
// Travel times are stored in MINUTES (see developmentDistances.ts). They are fed
// as qualitative bands rather than figures — the copy only ever needs "how close
// does this feel", and a band cannot be quoted as a number. Thresholds are set
// against the real spread across 204 developments (beach median 3 min, city
// centre 6, airport 14).
const proximityBand = (minutes: number): string =>
  minutes <= 2 ? "right on the doorstep"
  : minutes <= 5 ? "a couple of minutes away"
  : minutes <= 10 ? "a few minutes away"
  : minutes <= 20 ? "a short drive"
  : minutes <= 35 ? "a moderate drive"
  : "a longer drive";

const DISTANCE_LABEL: Record<string, string> = {
  beach: "Beach", restaurants: "Restaurants", shops: "Shops", airport: "Airport",
  hospital: "Hospital", school: "School", cityCenter: "City centre", golf: "Golf",
};

// What Claude is allowed to know. Carries the qualitative material it needs to
// write well — the developer's own description, the amenities, how close things
// are — and, apart from that description, no figures at all: not the unit counts,
// not the price, not the completion quarter.
//
// This output is written once into DevelopmentOverride.seo and then never
// regenerated, while the underlying numbers move with every feed sync. On
// 2026-08-20 all six AI-written projects had drifted: royal-residences still
// advertised "13 exclusive units available" on a page that says SOLD OUT (all 13
// units unlisted), :salt named €289,000 against a real €262,400, :balance "85
// homes" against 83. The unit line here was the direct source — it passed
// `vm.units.length`, which counts `unlisted` rows the site never shows.
//
// Removing the figures from the DATA matters as much as the prompt rule: told
// only "don't print digits" while still handed a completion quarter, a model
// writes it out in words instead. Live figures reach the page through the
// {placeholder} tokens the prompt teaches instead (developmentSeo.ts), which
// resolve against current data on every render.
//
// The one deliberate exception is the developer's description, which is prose we
// cannot sanitise without mangling it — it is labelled as such in the prompt, and
// the digit guard in generateSeoMeta is what actually holds the line.
function factsFor(vm: ProjectVM): string {
  const types = Array.from(new Set(listedUnits(vm.units).map((u) => u.type).filter(Boolean)));
  // 13 of the 270 distinct amenity strings in production carry a figure
  // ("Gated area 24/7, CCTV", "6.72 kW photovoltaic system", "Optional furniture
  // package (2-bedroom €30,000 + 19% VAT)"). They are dropped rather than fed:
  // none is meta-description material at 160 characters, and each one is an
  // invitation to break the no-digit rule.
  const amenities = (vm.amenities ?? []).filter((a) => a && !/\d/.test(a));
  const distances = Object.entries(vm.distances ?? {})
    .filter(([k, v]) => DISTANCE_LABEL[k] && typeof v === "number")
    .map(([k, v]) => `${DISTANCE_LABEL[k]}: ${proximityBand(v as number)}`);
  const desc = (vm.description ?? "").trim().replace(/\s+/g, " ");
  return [
    `Project name: ${vm.publicName}`,
    [vm.area, vm.district].filter(Boolean).length ? `Location: ${[vm.area, vm.district].filter((v, i, a) => v && a.indexOf(v) === i).join(", ")}, Cyprus` : "",
    types.length ? `Property type(s): ${types.join(", ")}` : "",
    amenities.length ? `Amenities: ${amenities.join(", ")}` : "",
    distances.length ? `Proximity (qualitative, never quote as a figure): ${distances.join("; ")}` : "",
    desc ? `Existing description (raw material only — rewrite, never copy; it MAY contain figures, and you must not reuse any of them): ${desc.slice(0, 900)}` : "",
  ].filter(Boolean).join("\n");
}

// Truncation must never cut inside a {placeholder}. A half token like
// "{priceF" can never resolve, and applySeoPlaceholders' guard does not catch
// it either: its regex requires a closing brace, so the fragment is not an
// UNRESOLVED placeholder, it is simply not a placeholder at all — and the
// literal text ships straight into the search snippet. Observed on Golden
// Hills, which generated "… From {priceF…".
// When the cut would land inside a token, fall back to cutting before it.
const clamp = (s: string, max: number) => {
  const t = String(s || "").trim();
  if (t.length <= max) return t;
  let cut = max - 1;
  const open = t.lastIndexOf("{", cut);
  if (open !== -1) {
    const close = t.indexOf("}", open);
    if (close === -1 || close >= cut) cut = open;
  }
  return t.slice(0, cut).trimEnd() + "…";
};

// The prompt's rules are requests; this is the enforcement. Same posture as the
// char-budget clamp below — the model is not trusted to be perfect, and anything
// that slips through gets SAVED and silently rots (see factsFor above). Retry
// once, then fail loudly rather than store a number: a visible "regenerate" in
// the admin UI is much cheaper than a wrong figure sitting in a search snippet.
// Mirrors the leak-retry in generateProjectDescription.
//
// Two distinct violations are caught. A digit is the stale-figure bug itself. An
// invented placeholder is quieter but just as bad: resolveMetaDescription can
// only fall back to the generic auto text when it meets an unknown token, so the
// hand-written copy would be silently discarded on every render, with nothing
// anywhere to say why. Catching it here makes it visible while it is still fixable.
const KNOWN_PLACEHOLDERS = new Set<string>(SEO_PLACEHOLDERS);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A digit in the PROJECT'S OWN NAME is not a figure. Several developments are
// numbered — Glow 2, Abiete 2, Avalon Gardens 2, Roseland Villas 1 — and a bare
// /\d/ check rejects every possible sentence about them, making "Generate with
// Claude" permanently impossible for those projects. The name is removed before
// the digit test, never from the stored text.
const badFields = (r: Partial<SeoMetaResult>, publicName: string) =>
  LANG_KEYS.filter((k) => {
    const raw = r[k] ?? "";
    const v = publicName.trim()
      ? raw.replace(new RegExp(escapeRe(publicName.trim()), "gi"), "")
      : raw;
    if (/\d/.test(v)) return true;
    let m: RegExpExecArray | null;
    const re = /\{(\w*)\}/g;
    while ((m = re.exec(v)) !== null) if (!KNOWN_PLACEHOLDERS.has(m[1])) return true;
    return false;
  });

export async function generateSeoMeta(vm: ProjectVM, tuning?: { emphasize?: string; avoid?: string }): Promise<SeoMetaResult> {
  const client = anthropic();
  if (!client) throw new Error("ANTHROPIC_API_KEY not configured");

  const promptTemplate = await getSeoPromptTemplate();
  const prompt = `${promptTemplate}\n\nData:\n${factsFor(vm)}` + tuningBlock(tuning);

  // On the retry, tell the model exactly which fields broke the rule — a blind
  // second call with the identical prompt mostly reproduces the same mistake.
  const attempt = async (correction?: string): Promise<Partial<SeoMetaResult>> => {
    const msg = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      tools: [
        {
          name: "seo_meta",
          description: "SEO meta title + description for this project, in four languages.",
          input_schema: {
            type: "object",
            properties: Object.fromEntries(LANG_KEYS.map((k) => [k, { type: "string" }])),
            required: [...LANG_KEYS],
          } as any,
        },
      ],
      tool_choice: { type: "tool", name: "seo_meta" },
      messages: [{ role: "user", content: correction ? `${prompt}\n\n${correction}` : prompt }],
    });

    const tool = msg.content.find((b: any) => b.type === "tool_use") as any;
    const raw = (tool?.input ?? {}) as Partial<SeoMetaResult>;
    if (!Object.values(raw).some(Boolean)) throw new Error(`No content (stop: ${msg.stop_reason})`);
    return raw;
  };

  let raw = await attempt();
  const firstOffenders = badFields(raw, vm.publicName);
  if (firstOffenders.length) {
    raw = await attempt(
      `Your previous answer was rejected in these fields: ${firstOffenders.join(", ")}. ` +
      `They contain either a digit or a placeholder that does not exist. Rewrite ALL fields ` +
      `with no digit anywhere (and do not spell figures out in words — drop the fact or use a ` +
      `placeholder), and use ONLY these placeholders, spelled exactly: ` +
      `${SEO_PLACEHOLDERS.map((p) => `{${p}}`).join(", ")}.`,
    );
  }
  const offenders = badFields(raw, vm.publicName);
  if (offenders.length) {
    throw new Error(
      `Generated copy still contains a figure or an unknown placeholder in ${offenders.join(", ")} ` +
      `after a retry — figures must not be baked into saved SEO text (they go stale), and only ` +
      `${SEO_PLACEHOLDERS.map((p) => `{${p}}`).join(", ")} resolve at render time. Try again, or edit by hand.`,
    );
  }

  // Safety net — never trust the model to perfectly respect the char budget
  // (the same limits the free template generator enforces, see developmentSeo.ts).
  const out = {} as SeoMetaResult;
  for (const k of LANG_KEYS) out[k] = clamp(raw[k] ?? "", k.startsWith("title") ? TITLE_MAX : DESC_MAX);
  return out;
}
