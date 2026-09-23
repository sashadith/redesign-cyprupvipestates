import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { STYLE_RULES, styleViolations } from "@/lib/heStyleRules";
import {
  HeTranslationError,
  graphemeLength,
  guardViolations,
  maxTokensFor,
  mergePortableText,
  normalizeHebrew,
  parseJsonReply,
  promptFactsFor,
  promptPayloadFor,
  staleFiguresIn,
  translateHe,
  type AnthropicLike,
  type HeTranslateInput,
} from "@/lib/ai/translateHe";

/* Everything here runs against a FAKE Anthropic client — no API key, no network,
   no database. The fake returns canned JSON replies in order, one per model call,
   and records the prompts so the tests can assert that pass A ran before pass B. */

const HE_PROSE = "דירה במרחק הליכה מהים, עם מרפסת רחבה ונוף פתוח.";
const HE_PROSE_2 = "דירה קרובה לים, עם מרפסת רחבה ונוף אל המפרץ.";

type Canned = string | ((prompt: string) => string);

function fakeClient(replies: Canned[]) {
  const prompts: string[] = [];
  const client: AnthropicLike = {
    messages: {
      async create(args: Record<string, unknown>) {
        const messages = args.messages as { content: string }[];
        prompts.push(String(messages[0].content));
        const canned = replies[prompts.length - 1];
        assert.ok(canned !== undefined, `unexpected model call #${prompts.length}`);
        const text = typeof canned === "function" ? canned(prompts[prompts.length - 1]) : canned;
        return { content: [{ type: "text", text }], stop_reason: "end_turn" };
      },
    },
  };
  return { client, prompts };
}

const critiqued = (payload: unknown, violations: string[] = []) =>
  JSON.stringify({ violations, corrected: payload });

const descInput: HeTranslateInput = {
  kind: "developmentDescription",
  en: { text: "A two-bedroom apartment within walking distance of the sea." },
};

// ── style rules ─────────────────────────────────────────────────────────────

test("heStyleRules rejects an em dash and passes clean Hebrew", () => {
  assert.deepEqual(styleViolations(HE_PROSE), []);
  const hits = styleViolations(`דירה — קרובה לים`);
  assert.equal(hits.length, 1);
  assert.match(hits[0], /^em-dash: /);
});

test("heStyleRules catches exclamation marks, slash gender forms and the notary calque", () => {
  assert.match(styleViolations("הדירה מוכנה!").join(" "), /exclamation-mark/);
  assert.match(styleViolations("מאשר/ת את התנאים").join(" "), /slash-gender-form/);
  assert.match(styleViolations("החתימה מתבצעת אצל נוטריון").join(" "), /notary/);
});

test('heStyleRules requires נדל"ן to carry a straight double quote', () => {
  assert.deepEqual(styleViolations('שוק הנדל"ן בקפריסין'), []);
  assert.match(styleViolations("שוק הנדל״ן בקפריסין").join(" "), /nadlan-gershayim/);
  assert.match(styleViolations("שוק הנדלן בקפריסין").join(" "), /nadlan-gershayim/);
});

test("STYLE_RULES matches the copy in scripts/he-content/lib.mjs", () => {
  const libPath = path.join(process.cwd(), "scripts", "he-content", "lib.mjs");
  assert.ok(
    existsSync(libPath),
    "scripts/he-content/lib.mjs does not exist yet (Task 1 of the Phase 5 plan). " +
      "Once it lands, its STYLE_RULES must carry the same ids and the same regex sources as src/lib/heStyleRules.ts.",
  );
  const src = readFileSync(libPath, "utf8");
  // The .mjs copy is plain JS with no build step, so its STYLE_RULES block is
  // read as text and the ids / regex sources extracted rather than imported.
  const start = src.indexOf("export const STYLE_RULES");
  assert.notEqual(start, -1, "scripts/he-content/lib.mjs must export STYLE_RULES");
  const block = src.slice(start, src.indexOf("\n];", start));
  const ids = Array.from(block.matchAll(/id:\s*"([^"]+)"/g)).map((m) => m[1]);
  const sources = Array.from(block.matchAll(/test:\s*\/((?:\\.|\[[^\]]*\]|[^/\\])+)\//g)).map((m) => m[1]);
  assert.deepEqual(ids, STYLE_RULES.map((r) => r.id), "rule ids drifted between heStyleRules.ts and lib.mjs");
  assert.deepEqual(sources, STYLE_RULES.map((r) => r.test.source), "rule regexes drifted between heStyleRules.ts and lib.mjs");
});

// ── pure helpers ────────────────────────────────────────────────────────────

test("parseJsonReply survives fences and surrounding prose", () => {
  assert.deepEqual(parseJsonReply('```json\n{"text":"שלום"}\n```'), { text: "שלום" });
  assert.deepEqual(parseJsonReply('Here you go: {"text":"שלום"} — done'), { text: "שלום" });
  assert.throws(() => parseJsonReply("no json here"), /no JSON object/);
});

test("graphemeLength counts Hebrew characters, not UTF-16 units", () => {
  assert.equal(graphemeLength("שלום"), 4);
  assert.equal(graphemeLength(""), 0);
});

test("guardViolations flags meta over the 60/155 grapheme budgets", () => {
  const long = "א".repeat(61);
  const problems = guardViolations(
    { kind: "developmentSeo", en: { title: "A short English title", description: "A short English description." } },
    { title: long, description: HE_PROSE },
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /title: 61 graphemes, budget 60/);
});

test("guardViolations flags a digit in an evergreen development description", () => {
  const problems = guardViolations(descInput, { text: "דירה במרחק 200 מטר מהים." });
  assert.match(problems.join(" "), /contains a digit/);
});

test("guardViolations flags a dropped {placeholder}", () => {
  const problems = guardViolations(
    { kind: "developmentSeo", en: { title: "Homes in Limassol", description: "New homes from {priceFrom} by the sea." } },
    { title: HE_PROSE, description: HE_PROSE_2 },
  );
  assert.match(problems.join(" "), /placeholder\} tokens changed/);
});

test("mergePortableText keeps _key, marks and markDefs and takes only the Hebrew text", () => {
  const en = [
    {
      _type: "block",
      _key: "b1",
      style: "normal",
      markDefs: [{ _type: "link", _key: "l1", href: "https://cyprusvipestates.com/en" }],
      children: [
        { _type: "span", _key: "s1", text: "A developer active in Limassol", marks: ["strong"] },
        { _type: "span", _key: "s2", text: " since 2004.", marks: [] },
      ],
    },
  ];
  const he = [
    {
      _type: "block",
      _key: "CHANGED",
      style: "h2",
      markDefs: [],
      children: [
        { _type: "span", _key: "x", text: "יזם הפועל בלימסול", marks: [] },
        { _type: "span", _key: "y", text: " מאז 2004.", marks: [] },
      ],
    },
  ];
  const problems: string[] = [];
  const merged = mergePortableText(en, he, problems) as typeof en;
  assert.deepEqual(problems, []);
  assert.equal(merged[0]._key, "b1");
  assert.equal(merged[0].style, "normal");
  assert.deepEqual(merged[0].markDefs, en[0].markDefs);
  assert.equal(merged[0].children[0]._key, "s1");
  assert.deepEqual(merged[0].children[0].marks, ["strong"]);
  assert.equal(merged[0].children[0].text, "יזם הפועל בלימסול");
});

test("mergePortableText reports a structural change instead of silently accepting it", () => {
  const problems: string[] = [];
  mergePortableText([{ _type: "span", _key: "a", text: "One" }], [], problems);
  assert.match(problems.join(" "), /array length changed/);
});

// ── the two-pass generator ──────────────────────────────────────────────────

test("translateHe runs pass A then pass B, in that order, and returns the critique", async () => {
  const { client, prompts } = fakeClient([
    JSON.stringify({ text: HE_PROSE }),
    critiqued({ text: HE_PROSE_2 }, ["replaced a calqued phrase"]),
  ]);
  const out = await translateHe(descInput, { client });
  assert.equal(prompts.length, 2);
  assert.match(prompts[0], /English payload \(JSON\)/);
  assert.match(prompts[1], /Hebrew draft \(JSON\)/);
  assert.equal(out.attempts, 1);
  assert.deepEqual(out.critique, ["replaced a calqued phrase"]);
  // The critique pass's corrected text is what gets returned, not pass A's.
  assert.equal(out.he.text, HE_PROSE_2);
});

test("translateHe retries exactly once when a guard fires, then succeeds", async () => {
  const englishLeak = "An apartment a short walk from the sea.";
  const { client, prompts } = fakeClient([
    JSON.stringify({ text: englishLeak }),
    critiqued({ text: englishLeak }),
    JSON.stringify({ text: HE_PROSE }),
    critiqued({ text: HE_PROSE }),
  ]);
  const out = await translateHe(descInput, { client });
  assert.equal(prompts.length, 4, "one retry = a second full pass A + pass B");
  assert.equal(out.attempts, 2);
  assert.equal(out.he.text, HE_PROSE);
  assert.match(prompts[2], /Your previous attempt was rejected/);
  assert.match(prompts[2], /no Hebrew script/);
});

test("translateHe throws HeTranslationError with the violations when the retry also fails", async () => {
  // An exclamation mark: a style violation normalizeHebrew does NOT repair
  // (dashes and הכול are fixed mechanically now, so they can no longer fail a run).
  const shouting = `דירה קרובה לים!`;
  const { client, prompts } = fakeClient([
    JSON.stringify({ text: shouting }),
    critiqued({ text: shouting }),
    JSON.stringify({ text: shouting }),
    critiqued({ text: shouting }),
  ]);
  await assert.rejects(
    () => translateHe(descInput, { client }),
    (e: unknown) => {
      assert.ok(e instanceof HeTranslationError);
      assert.equal(e.attempts, 2);
      assert.match(e.violations.join(" "), /exclamation-mark/);
      return true;
    },
  );
  assert.equal(prompts.length, 4);
});

test("translateHe keeps a developer's slug and title Latin even if the model hebraizes them", async () => {
  const input: HeTranslateInput = {
    kind: "developerProfile",
    en: {
      slug: "cyfield",
      title: "Cyfield",
      excerpt: "A Cypriot developer building across the island.",
      seo: { metaTitle: "Cyfield developments", metaDescription: "Homes by Cyfield across Cyprus." },
    },
  };
  const hebraized = {
    slug: "סייפילד",
    title: "סייפילד",
    excerpt: HE_PROSE,
    seo: { metaTitle: "פרויקטים של Cyfield", metaDescription: HE_PROSE_2 },
  };
  const { client } = fakeClient([JSON.stringify(hebraized), critiqued(hebraized)]);
  const out = await translateHe(input, { client });
  assert.equal(out.he.slug, "cyfield");
  assert.equal(out.he.title, "Cyfield");
  assert.equal(out.he.excerpt, HE_PROSE);
  assert.equal(out.he.seo?.metaDescription, HE_PROSE_2);
});

test("translateHe carries the facts and the kind rules into the pass A prompt", async () => {
  const { client, prompts } = fakeClient([
    JSON.stringify({ text: HE_PROSE }),
    critiqued({ text: HE_PROSE }),
  ]);
  await translateHe({ ...descInput, facts: ["Location: Germasogeia, Limassol, Cyprus"] }, { client });
  assert.match(prompts[0], /Germasogeia/);
  assert.match(prompts[0], /NEVER write a digit/);
  assert.match(prompts[0], /Content kind: developmentDescription/);
});

test("translateHe keeps pass A when the critique pass returns nothing usable", async () => {
  const { client } = fakeClient([JSON.stringify({ text: HE_PROSE }), '{"violations":[]}']);
  const out = await translateHe(descInput, { client });
  assert.equal(out.he.text, HE_PROSE);
  assert.match(out.critique.join(" "), /no corrected payload/);
});

// Staging 2026-09-21: "Abiete 2" and "Agnades Village 1" are project NAMES the
// English carries; the translator keeps them verbatim (Latin script), and the
// digit rule must not reject the name while still catching a real figure.
test("guardViolations lets a digit inside a Latin proper name from the English through, still flags a real figure", () => {
  const input = { kind: "developmentDescription" as const, en: { text: "Abiete 2 apartments offer an exceptional living experience near the sea." } };
  assert.deepEqual(guardViolations(input, { text: "הדירות של Abiete 2 מציעות חוויית מגורים יוצאת דופן קרוב לים." }).filter((p) => /digit/.test(p)), []);
  const withFigure = guardViolations(input, { text: "הדירות של Abiete 2 נמצאות במרחק 200 מטר מהים." });
  assert.match(withFigure.join(" "), /contains a digit .* "…/);
  assert.doesNotMatch(withFigure.join(" "), /Abiete 2/);
});

// Staging 2026-09-21 (amelia-luxury-apartments): the English source itself still
// carried "77.5 m²" and "€310,000" (pre-no-digit-policy copy) and the model kept
// them twice despite "drop the fact". The prompt now names them explicitly.
test("staleFiguresIn lists the English figures minus digits that belong to Latin names", () => {
  assert.deepEqual(staleFiguresIn(["each measuring 77.5 m². Prices from €310,000. Abiete 2 apartments, 3 minutes from the beach."]), ["77.5 m²", "€310,000", "3"]);
  assert.deepEqual(staleFiguresIn(["Agnades Village 1 sits above the bay."]), []);
});

test("passAPrompt names the stale English figures for a development description, and stays silent when there are none", async () => {
  const prompts: string[] = [];
  const client = {
    messages: {
      create: async (args: Record<string, unknown>) => {
        const msgs = args.messages as { content: string }[];
        prompts.push(msgs[0].content);
        return { content: [{ type: "text", text: JSON.stringify({ text: HE_PROSE, violations: [] }) }], stop_reason: "end_turn" };
      },
    },
  };
  await translateHe({ kind: "developmentDescription", en: { text: "Each apartment measures 77.5 m² and prices start from €310,000." } }, { client });
  assert.match(prompts[0], /stale figures \([^)]*"77\.5 m²"[^)]*\)/);
  assert.match(prompts[0], /stale figures \([^)]*"€310,000"[^)]*\)/);
  prompts.length = 0;
  await translateHe({ kind: "developmentDescription", en: { text: "Abiete 2 apartments offer sea views." } }, { client });
  assert.doesNotMatch(prompts[0], /stale figures/);
});

// Staging 2026-09-22 (elements, elements-oxygen-park-of-colours): the model
// copied "32,000 m²" even with the figure named as stale and the passage
// quoted back — so Pass A no longer sees the figure at all.
test("promptPayloadFor replaces stale English figures with the marker and keeps names with digits", () => {
  const { payload, removed } = promptPayloadFor({
    kind: "developmentDescription",
    en: { text: "Abiete 2 sits within 32,000 m² of parkland – among the largest in Paphos – with prices from €310,000." },
  });
  assert.deepEqual(removed.sort(), ["32,000 m²", "€310,000"]);
  assert.equal(payload.text, "Abiete 2 sits within [figure removed] of parkland – among the largest in Paphos – with prices from [figure removed].");
  const untouched = promptPayloadFor({ kind: "developmentDescription", en: { text: "A quiet street near the sea." } });
  assert.deepEqual(untouched.removed, []);
  assert.equal(untouched.payload.text, "A quiet street near the sea.");
});

test("translateHe sends the stripped payload to Pass A (the figure never reaches the model)", async () => {
  const { client, prompts } = fakeClient([JSON.stringify({ text: HE_PROSE }), critiqued({ text: HE_PROSE })]);
  await translateHe({ kind: "developmentDescription", en: { text: "The park covers 32,000 m² of green space." } }, { client });
  // The figure is named once in the instruction (so the model knows what was
  // cut) but is absent from the payload it translates.
  const payloadPart = prompts[0].split("English payload (JSON):")[1];
  assert.doesNotMatch(payloadPart, /32,000/);
  assert.match(payloadPart, /\[figure removed\] of green space/);
  // Pass B (the critic) must see the same stripped source — with the original
  // it re-inserted the figure under "drop none" (staging retry batch, 2026-09-22).
  const sourcePart = prompts[1].split("English source (JSON):")[1];
  assert.doesNotMatch(sourcePart, /32,000/);
  assert.match(prompts[1], /deliberately removed/);
});

// The two mechanical house-style rules the model kept breaking are now fixed
// deterministically before the guard runs.
test("normalizeHebrew: הכול → הכל, dashes between words → comma, leftover marker dropped", () => {
  assert.equal(normalizeHebrew("הכול קרוב – הים, החנויות ובתי הספר"), "הכל קרוב, הים, החנויות ובתי הספר");
  assert.equal(normalizeHebrew("דירה במרחק [figure removed] מהים"), "דירה במרחק מהים");
  assert.equal(normalizeHebrew(HE_PROSE), HE_PROSE);
});

test("translateHe passes the guard when the model writes הכול and an en dash (normalized away)", async () => {
  const dashed = "הכול קרוב – הים ובתי הספר, במרחק הליכה.";
  const { client } = fakeClient([JSON.stringify({ text: dashed }), critiqued({ text: dashed })]);
  const out = await translateHe(descInput, { client });
  assert.equal(out.he.text, "הכל קרוב, הים ובתי הספר, במרחק הליכה.");
});


// Staging 2026-09-23: all 23 developer profiles came back truncated at 16000
// tokens; the request now streams with a per-kind budget and medium effort.
test("translateHe prefers the client's stream() with the per-kind token budget and medium effort", async () => {
  const seen: Record<string, unknown>[] = [];
  const client: AnthropicLike = {
    messages: {
      async create() {
        throw new Error("create() must not be used when stream() exists");
      },
      stream(args) {
        seen.push(args);
        const text = seen.length === 1 ? JSON.stringify({ text: HE_PROSE }) : critiqued({ text: HE_PROSE });
        return { finalMessage: async () => ({ content: [{ type: "text", text }], stop_reason: "end_turn" }) };
      },
    },
  };
  await translateHe(descInput, { client });
  assert.equal(seen.length, 2);
  assert.equal(seen[0].max_tokens, 16000);
  assert.deepEqual(seen[0].output_config, { effort: "medium" });
  assert.equal(maxTokensFor("developerProfile"), 32000);
  assert.equal(maxTokensFor("areaText"), 16000);
});

// Staging 2026-09-23 (arbeo-park): "Construction stage: delivery October 2028"
// in the facts handed the model a digit the payload stripping never saw.
test("promptFactsFor strips figures from an evergreen description's facts and keeps names", () => {
  const facts = promptFactsFor({
    kind: "developmentDescription",
    en: { text: "x" },
    facts: ["Project name: Abiete 2", "Location: Geroskipou, Cyprus", "Construction stage: delivery October 2028", "Units: 12"],
  });
  assert.deepEqual(facts, ["Project name: Abiete 2", "Location: Geroskipou, Cyprus", "Construction stage: delivery October"]);
  assert.deepEqual(promptFactsFor({ kind: "areaText", en: { text: "x" }, facts: ["Area: Peyia 2"] }), ["Area: Peyia 2"]);
});

test("passAPrompt tells the model to keep spelled-out numbers as words", async () => {
  const { client, prompts } = fakeClient([JSON.stringify({ text: HE_PROSE }), critiqued({ text: HE_PROSE })]);
  await translateHe(descInput, { client });
  assert.match(prompts[0], /spells out in WORDS/);
});
