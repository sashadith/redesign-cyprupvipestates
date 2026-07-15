import { anthropic, AI_MODEL } from "./anthropic";
import { tuningBlock } from "./tuning";

/* Generate a neighbourhood description for an AREA in four native languages at
   once. Anti-cannibalisation is solved at the SOURCE: sibling descriptions from
   the same region are passed in and Claude is told to differentiate — so our own
   pages don't compete for the same keywords. */

export type FourLang = { en: string; de: string; pl: string; ru: string };

export async function generateAreaContent(opts: {
  areaName: string;
  district: string;
  siblings?: { area: string; text: string }[];
  words?: number;
  emphasize?: string;
  avoid?: string;
}): Promise<FourLang> {
  const client = anthropic();
  if (!client) throw new Error("ANTHROPIC_API_KEY not configured");
  const words = Math.min(400, Math.max(30, Math.round(opts.words || 90)));

  const siblings = (opts.siblings ?? []).filter((s) => s.text);
  const siblingBlock = siblings.length
    ? `\n\nDescriptions ALREADY published for OTHER areas in the same region. Make yours clearly distinct — a different angle, different wording, different highlighted features. Do NOT reuse their phrases or sentence shapes:\n` +
      siblings.map((s) => `• ${s.area}: ${s.text.slice(0, 280)}`).join("\n")
    : "";

  // Prompt-caching evaluated: skipped. Below the token floor either way, but the
  // more fundamental issue is structural — opts.areaName is interpolated into the
  // very first sentence, so there's no stable static PREFIX to isolate at all (a
  // cache_control block must be an exact byte-for-byte match across calls; this
  // prompt has no leading text that's identical call to call). Fixing that would
  // mean reordering/rewording the prompt, which is out of scope here.
  const prompt = `You write neighbourhood descriptions for a LUXURY real-estate website selling premium property in Cyprus to affluent international buyers.

Write an original description of the area "${opts.areaName}"${opts.district ? ` (${opts.district} district, Cyprus)` : " (Cyprus)"}.

Requirements:
- Approximately ${words} words in EACH language (keep each language close to this length). Evocative but factual: the setting, sea/nature, lifestyle, notable amenities, and who it suits.
- Sophisticated, confident, understated tone. No clichés ("hidden gem", "nestled", "boasts"), no hype, no invented facts.
- Do NOT mention specific developers, projects, prices, or our company.
- It must read as unique, original web content for SEO.${siblingBlock}

Return ONLY a JSON object with the description written NATIVELY (idiomatic, not a literal translation) in four languages, keys exactly "en", "de", "pl", "ru". No markdown, no commentary.` + tuningBlock({ emphasize: opts.emphasize, avoid: opts.avoid });

  // Forced tool use → guaranteed structured output (no fragile text/JSON parsing).
  const msg = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 3000,
    tools: [
      {
        name: "area_description",
        description: "Return the neighbourhood description in four languages.",
        input_schema: {
          type: "object",
          properties: {
            en: { type: "string", description: "English description" },
            de: { type: "string", description: "German description (native)" },
            pl: { type: "string", description: "Polish description (native)" },
            ru: { type: "string", description: "Russian description (native)" },
          },
          required: ["en", "de", "pl", "ru"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "area_description" },
    messages: [{ role: "user", content: prompt }],
  });

  const tool = msg.content.find((b: any) => b.type === "tool_use") as any;
  const p = (tool?.input ?? {}) as Partial<FourLang>;
  const out = { en: p.en ?? "", de: p.de ?? "", pl: p.pl ?? "", ru: p.ru ?? "" };
  if (!out.en && !out.de && !out.pl && !out.ru) {
    throw new Error(`No content returned (stop_reason: ${msg.stop_reason ?? "unknown"})`);
  }
  return out;
}
