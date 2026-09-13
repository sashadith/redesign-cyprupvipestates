import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { STYLE_RULES, styleViolations } from "@/lib/heStyleRules";
import {
  HeTranslationError,
  graphemeLength,
  guardViolations,
  mergePortableText,
  parseJsonReply,
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
  const withDash = `דירה — קרובה לים`;
  const { client, prompts } = fakeClient([
    JSON.stringify({ text: withDash }),
    critiqued({ text: withDash }),
    JSON.stringify({ text: withDash }),
    critiqued({ text: withDash }),
  ]);
  await assert.rejects(
    () => translateHe(descInput, { client }),
    (e: unknown) => {
      assert.ok(e instanceof HeTranslationError);
      assert.equal(e.attempts, 2);
      assert.match(e.violations.join(" "), /em-dash/);
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
