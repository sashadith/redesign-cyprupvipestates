import { anthropic, AI_MODEL } from "./anthropic";
import { tuningBlock } from "./tuning";
import { LOCALES } from "@/lib/locale";
import { scriptLeaks, type LocaleText } from "./localeTextGuards";
import { PROJECT_BRIEF } from "./projectBrief";
import { heSystemBlock } from "./heContext";

/* Generate a fresh property description from ALL available data — location, area
   character, amenities, unit mix, developer source text — WITHOUT ever naming the
   project or developer. Five native languages. Tuned to avoid AI-tells (varied
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

export async function generateProjectDescription(ctx: DescriptionContext): Promise<LocaleText> {
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
- Write FULLY in each target language — never leave English terms untranslated (e.g. "off plan" → DE "im Vorverkauf" / PL "w przedsprzedaży" / RU "на стадии строительства" / HE "על הנייר"; "en-suite", "BBQ" etc. likewise).
- The source text above may itself be written in, or mixed with, a language other than English (e.g. Russian marketing copy). Translate its meaning only — never let a word or phrase from the source's own language leak into any of the five output fields. Each field must be 100% in its own target language, with zero exceptions.
- Use proper typographic dashes ("–"), never a spaced hyphen (" - ") — in en/de/pl/ru.
- Hebrew: Western digits, "€" before the number, no "—" dash (Hebrew uses a comma, a period, or a new sentence instead), masculine-plural or nominal register (see system rules).
- Return the SAME description written natively (not translated word-for-word) in five languages.

Return via the description tool.` + tuningBlock({ emphasize: ctx.emphasize, avoid: ctx.avoid });

  // Enforcement for the no-digit rule above — a prompt rule is a request, and
  // anything that slips through is stored permanently. Reuses the same
  // retry-once path as the language leak.
  const hasDigits = (out: LocaleText) => LOCALES.some((l) => /\d/.test(out[l]));
  const isClean = (out: LocaleText) => scriptLeaks(out).length === 0 && !hasDigits(out);

  // `correction` is only set on the retry — naming what went wrong beats sending
  // the identical prompt again and hoping for a different sample.
  const attempt = async (correction?: string): Promise<LocaleText> => {
    const msg = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      // The shared project brief plus the Hebrew style guide/glossary ride as the
      // system layer (see heContext.ts) — cacheable, and keeps the user prompt
      // above free of the ~7k tokens of Hebrew writing rules.
      system: [{ type: "text", text: PROJECT_BRIEF }, heSystemBlock("description")],
      tools: [
        {
          name: "description",
          description: "The property description in five native languages.",
          input_schema: {
            type: "object",
            properties: Object.fromEntries(LOCALES.map((l) => [l, { type: "string" }])),
            required: [...LOCALES],
          } as any,
        },
      ],
      tool_choice: { type: "tool", name: "description" },
      messages: [{ role: "user", content: correction ? `${prompt}\n\n${correction}` : prompt }],
    });

    const tool = msg.content.find((b: any) => b.type === "tool_use") as any;
    const p = (tool?.input ?? {}) as Partial<LocaleText>;
    const out = Object.fromEntries(LOCALES.map((l) => [l, String(p[l] ?? "")])) as LocaleText;
    if (LOCALES.every((l) => !out[l])) throw new Error(`No content (stop: ${msg.stop_reason})`);
    return out;
  };

  const first = await attempt();
  if (isClean(first)) return first;
  // Either a script/language leak (the source text was itself multilingual, or
  // a target field picked up the wrong script) or a figure that got through the
  // no-digit rule — retry once.
  const second = await attempt(
    [
      hasDigits(first)
        ? "Your previous answer contained digits. Rewrite with no digit anywhere — and do not spell the figures out in words either; drop the fact instead."
        : "",
      scriptLeaks(first).length
        ? "Your previous answer leaked the wrong script into one or more fields. Each field must be 100% in its own target language and script (Hebrew for he, native script elsewhere)."
        : "",
    ].filter(Boolean).join(" "),
  );
  if (isClean(second)) return second;
  // Still not clean after the retry — refuse rather than silently saving a
  // figure or a script leak (previously a persistent script leak alone fell
  // through to `return second`, saving the leaked copy). Align with
  // areaContent.ts's retry contract: name exactly what's still wrong.
  const problems: string[] = [];
  if (hasDigits(second)) {
    problems.push("contains figures (numbers must not be baked into saved copy — they go stale)");
  }
  const leaks = scriptLeaks(second);
  if (leaks.length) problems.push(...leaks);
  throw new Error(`Description generation failed after retry: ${problems.join("; ")}`);
}
