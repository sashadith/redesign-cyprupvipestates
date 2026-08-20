import { anthropic, AI_MODEL } from "./anthropic";
import type { FourLang } from "./areaContent";
import { tuningBlock } from "./tuning";

/* Generate a fresh property description from ALL available data — location, area
   character, amenities, unit mix, developer source text — WITHOUT ever naming the
   project or developer. Four native languages. Tuned to avoid AI-tells (varied
   rhythm, no clichés) so it survives AI-content detection. */

export type DescriptionContext = {
  district: string;
  town: string;
  area: string;
  areaText?: string;
  category?: string;
  stage?: string;
  completion?: string;
  priceFrom?: number | null;
  projectAmenities: string[];
  unitAmenities: string[];
  unitSummary: string;
  sourceText?: string;
  words: number;
  emphasize?: string;
  avoid?: string;
};

export async function generateProjectDescription(ctx: DescriptionContext): Promise<FourLang> {
  const client = anthropic();
  if (!client) throw new Error("ANTHROPIC_API_KEY not configured");
  const words = Math.min(400, Math.max(50, Math.round(ctx.words || 130)));

  const facts = [
    `Location: ${[ctx.area, ctx.town, ctx.district].filter(Boolean).join(", ")}, Cyprus`,
    ctx.areaText ? `Neighbourhood character: ${ctx.areaText.slice(0, 600)}` : "",
    ctx.category ? `Category: ${ctx.category}` : "",
    ctx.stage ? `Construction stage: ${ctx.stage}` : "",
    // completion date and price-from are deliberately NOT passed — this text is
    // saved and never regenerated, so any figure in it rots (see the no-digit
    // rule below and the same treatment in seoMeta.ts). Handing the model a
    // quarter or a price while forbidding digits just makes it spell them out.
    ctx.unitSummary ? `Homes: ${ctx.unitSummary}` : "",
    ctx.projectAmenities.length ? `Development amenities: ${ctx.projectAmenities.join(", ")}` : "",
    ctx.unitAmenities.length ? `Unit features: ${ctx.unitAmenities.join(", ")}` : "",
    ctx.sourceText ? `Developer's own text (raw material — rewrite, do not copy): ${ctx.sourceText.slice(0, 800)}` : "",
  ].filter(Boolean).join("\n");

  // Prompt-caching evaluated: the intro + Rules block below is identical across
  // every project in a batch sync (only the Data section and tuningBlock() vary).
  // Not applied — it's only ~450-500 tokens including the tool schema, under
  // Sonnet's 1024-token cache-eligibility floor. cache_control on a block this
  // size is a silent no-op (no cache_creation, no read savings), so it's skipped
  // rather than added as dead weight. Revisit if the Rules list grows.
  const prompt = `You write property descriptions for a luxury Cyprus real-estate website, aimed at affluent international buyers.

Write a description of THIS development based strictly on the data below.

Data:
${facts}

Rules:
- ~${words} words in EACH language.
- NEVER mention the project's name or the developer's name — describe the property, lifestyle, location and features.
- Use ONLY the data given; do not invent facts, figures or amenities.
- NEVER write a digit. No unit counts, no prices, no completion dates or quarters, no square metres, no percentages. This description is SAVED and never regenerated, while the project's real numbers move with every feed sync — so a figure written here is wrong as soon as stock sells or a price changes. Nothing in the data gives you a figure to quote. Bedroom counts are the one thing you may name, and only spelled out as words ("two-bedroom", never "2-bedroom"), because that describes the homes themselves rather than what is currently for sale.
- Sophisticated, confident, understated. No clichés ("nestled", "hidden gem", "boasts", "oasis"), no marketing hype.
- Vary sentence length and rhythm; write like a human editor, not a template. It must read as original and NOT machine-generated.
- Structure the copy as 2–3 short paragraphs separated by a blank line (a real double newline "\n\n"). Suggested flow: location & setting · the development, units & amenities · interiors and who it suits.
- Write FULLY in each target language — never leave English terms untranslated (e.g. "off plan" → DE "im Vorverkauf" / PL "w przedsprzedaży" / RU "на стадии строительства"; "en-suite", "BBQ" etc. likewise).
- The source text above may itself be written in, or mixed with, a language other than English (e.g. Russian marketing copy). Translate its meaning only — never let a word or phrase from the source's own language leak into any of the four output fields. Each field must be 100% in its own target language, with zero exceptions.
- Use proper typographic dashes ("–"), never a spaced hyphen (" - ").
- Return the SAME description written natively (not translated word-for-word) in four languages.

Return via the description tool.` + tuningBlock({ emphasize: ctx.emphasize, avoid: ctx.avoid });

  const CYRILLIC_RE = /[Ѐ-ӿ]/;
  const hasLeakedCyrillic = (out: FourLang) => CYRILLIC_RE.test(out.en) || CYRILLIC_RE.test(out.de) || CYRILLIC_RE.test(out.pl);
  // Enforcement for the no-digit rule above — a prompt rule is a request, and
  // anything that slips through is stored permanently. Reuses the same
  // retry-once path as the language leak.
  const hasDigits = (out: FourLang) => /\d/.test(out.en) || /\d/.test(out.de) || /\d/.test(out.pl) || /\d/.test(out.ru);
  const isClean = (out: FourLang) => !hasLeakedCyrillic(out) && !hasDigits(out);

  // `correction` is only set on the retry — naming what went wrong beats sending
  // the identical prompt again and hoping for a different sample.
  const attempt = async (correction?: string): Promise<FourLang> => {
    const msg = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 3000,
      tools: [
        {
          name: "description",
          description: "The property description in four native languages.",
          input_schema: {
            type: "object",
            properties: { en: { type: "string" }, de: { type: "string" }, pl: { type: "string" }, ru: { type: "string" } },
            required: ["en", "de", "pl", "ru"],
          } as any,
        },
      ],
      tool_choice: { type: "tool", name: "description" },
      messages: [{ role: "user", content: correction ? `${prompt}\n\n${correction}` : prompt }],
    });

    const tool = msg.content.find((b: any) => b.type === "tool_use") as any;
    const p = (tool?.input ?? {}) as Partial<FourLang>;
    const out = { en: p.en ?? "", de: p.de ?? "", pl: p.pl ?? "", ru: p.ru ?? "" };
    if (!out.en && !out.de && !out.pl && !out.ru) throw new Error(`No content (stop: ${msg.stop_reason})`);
    return out;
  };

  const first = await attempt();
  if (isClean(first)) return first;
  // Either a non-target-language leak into en/de/pl (the source text was itself
  // multilingual) or a figure that got through the no-digit rule — retry once.
  const second = await attempt(
    [
      hasDigits(first)
        ? "Your previous answer contained digits. Rewrite with no digit anywhere — and do not spell the figures out in words either; drop the fact instead."
        : "",
      hasLeakedCyrillic(first)
        ? "Your previous answer leaked non-target-language characters into en/de/pl. Each field must be 100% in its own language."
        : "",
    ].filter(Boolean).join(" "),
  );
  if (isClean(second)) return second;
  // Still not clean. A language leak is cosmetic and the old behaviour — keep the
  // first attempt. A figure is not: it would be saved and go stale, so refuse.
  if (hasDigits(second) && hasDigits(first)) {
    throw new Error(
      "Generated description still contains figures after a retry — numbers must not be baked into saved copy (they go stale). Try again, or edit by hand.",
    );
  }
  return hasDigits(second) ? first : second;
}
