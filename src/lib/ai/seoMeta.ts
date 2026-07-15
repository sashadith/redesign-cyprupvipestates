import { anthropic, AI_MODEL } from "./anthropic";
import { tuningBlock } from "./tuning";
import { prisma } from "@/lib/prisma";
import type { ProjectVM } from "@/app/preview-project/feeds";
import { TITLE_MAX, DESC_MAX } from "@/lib/developmentSeo";

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
export const DEFAULT_SEO_PROMPT = `You write SEO meta titles and meta descriptions for real-estate development pages on a luxury Cyprus property website, aimed at international buyers.

Rules:
- Meta title: at most ${TITLE_MAX} characters TOTAL, including the project name. Always include the project name, the property type, and the location (area and/or district).
- Meta description: at most ${DESC_MAX} characters. A natural, compelling sentence or two that would make someone want to click in a Google search result — mention location, property type, and price-from if given. No keyword stuffing, no generic filler ("Discover your dream home...", "Explore our exclusive...").
- Write EACH language natively — never leave English terms untranslated, never translate word-for-word.
- Use ONLY the facts given below; never invent details, prices, or amenities.
- Return via the seo_meta tool: one title + one description per language (en/de/pl/ru), all in a single response.`;

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

function factsFor(vm: ProjectVM): string {
  const avail = vm.units.filter((u) => u.status === "available").length || vm.units.length;
  const types = Array.from(new Set(vm.units.map((u) => u.type).filter(Boolean)));
  return [
    `Project name: ${vm.publicName}`,
    [vm.area, vm.district].filter(Boolean).length ? `Location: ${[vm.area, vm.district].filter((v, i, a) => v && a.indexOf(v) === i).join(", ")}, Cyprus` : "",
    types.length ? `Property type(s): ${types.join(", ")}` : "",
    vm.priceFrom ? `Price from: €${vm.priceFrom.toLocaleString("en-US")}` : "",
    vm.units.length ? `Units: ${vm.units.length} total, ${avail} available` : "",
    vm.completion ? `Completion: ${vm.completion}` : "",
  ].filter(Boolean).join("\n");
}

const clamp = (s: string, max: number) => {
  const t = String(s || "").trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
};

export async function generateSeoMeta(vm: ProjectVM, tuning?: { emphasize?: string; avoid?: string }): Promise<SeoMetaResult> {
  const client = anthropic();
  if (!client) throw new Error("ANTHROPIC_API_KEY not configured");

  const promptTemplate = await getSeoPromptTemplate();
  const prompt = `${promptTemplate}\n\nData:\n${factsFor(vm)}` + tuningBlock(tuning);

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
    messages: [{ role: "user", content: prompt }],
  });

  const tool = msg.content.find((b: any) => b.type === "tool_use") as any;
  const raw = (tool?.input ?? {}) as Partial<SeoMetaResult>;
  if (!Object.values(raw).some(Boolean)) throw new Error(`No content (stop: ${msg.stop_reason})`);

  // Safety net — never trust the model to perfectly respect the char budget
  // (the same limits the free template generator enforces, see developmentSeo.ts).
  const out = {} as SeoMetaResult;
  for (const k of LANG_KEYS) out[k] = clamp(raw[k] ?? "", k.startsWith("title") ? TITLE_MAX : DESC_MAX);
  return out;
}
