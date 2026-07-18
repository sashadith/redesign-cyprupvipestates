import crypto from "node:crypto";
import { anthropic, AI_MODEL } from "@/lib/ai/anthropic";
import type { AdvisorPayload } from "./gather";

// SEO strategist persona, embedding docs/SEO-GROWTH-ROADMAP-2026.md's §12/§13
// principles directly (not paraphrased from memory each run) — demand-capture
// over supply, the STOP list, locale priority, and the standing rule never to
// touch a URL still inside its title-sweep measurement window.
const SYSTEM_PROMPT = `You are the SEO strategist for Cyprus VIP Estates, a luxury real-estate marketing site (cyprusvipestates.com) covering Cyprus property for international buyers, in English, German, Polish, and Russian.

Your standing principles (from the site's SEO Growth Roadmap):
1. DEMAND CAPTURE over supply — fixing CTR, internal links, and funnels on pages that already exist beats publishing new pages. The site already covers most commercial intents; the marginal new page yields less than fixing what's live.
2. Locale priority: DE and EN first. Russian (RU) is explicitly the lowest-ROI language here (~73 clicks/month, Yandex-only reach, sanctions/payment friction) — do NOT suggest expanding RU content or building new RU pages.
3. Never suggest a new page without clear demand evidence (real query/impression data pointing at an unmet intent) — the roadmap explicitly flags "ultra-niche" pages (e.g. near-golf-courses, near-international-schools) as low-value, index-bloat risks. Prefer improving/linking existing content over creating new URLs.
4. Never suggest touching the title, meta description, or content of a URL that is still inside its 42-day title-sweep re-measurement window (see the titleSweep field in the data below) — that would corrupt the in-flight measurement.
5. Every transactional/commercial page needs inbound links — orphaned pages (published but linked from nowhere) are a standing concern; flag them when the data shows it.
6. "Done" means indexed, linked, and earning impressions/clicks — not just published in the CMS.
7. Prefer differentiation over duplication — don't suggest near-duplicate content across locales/pages.

You'll receive a compact JSON data payload (GSC 28-day period-over-period stats per locale, click winners/losers, the CTR watchlist, a striking-distance list, Core Web Vitals status per template class, platform/publishing stats, and title-sweep status). Analyze it and produce AT MOST 5 suggestions — quality over quantity; if the data doesn't support 5 good ideas, return fewer.

Each suggestion must be concrete and executable by a developer/marketer working on this codebase — not generic advice. Cite the SPECIFIC data points that justify it (numbers, URLs, locales) in the rationale. Return your suggestions via the seo_suggestions tool.`;

export type RawSuggestion = {
  title: string;
  rationale: string;
  action: string;
  impact_estimate: "low" | "med" | "high";
  effort: "clicks" | "small" | "session";
  category: string;
};

export type Suggestion = RawSuggestion & { id: string; fingerprint: string };

const MAX_SUGGESTIONS = 5;
const IMPACT_VALUES = new Set(["low", "med", "high"]);
const EFFORT_VALUES = new Set(["clicks", "small", "session"]);

function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, " ");
}

function fingerprintOf(category: string, title: string): string {
  return crypto.createHash("sha256").update(`${category.toLowerCase().trim()}::${normalizeTitle(title)}`).digest("hex").slice(0, 24);
}

export async function analyzePayload(payload: AdvisorPayload): Promise<Suggestion[]> {
  const client = anthropic();
  if (!client) throw new Error("ANTHROPIC_API_KEY not configured");

  const msg = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    tools: [
      {
        name: "seo_suggestions",
        description: "Up to 5 concrete, data-justified SEO suggestions for this week.",
        input_schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              maxItems: MAX_SUGGESTIONS,
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Short, specific headline (one line)." },
                  rationale: { type: "string", description: "Why — citing the specific data points (numbers, URLs, locales) that justify this." },
                  action: { type: "string", description: "The concrete, executable action to take." },
                  impact_estimate: { type: "string", enum: ["low", "med", "high"] },
                  effort: { type: "string", enum: ["clicks", "small", "session"], description: "clicks = a config/content tweak, small = a focused task under an hour, session = a longer focused work session." },
                  category: { type: "string", description: "Short category label, e.g. 'CTR', 'Internal Linking', 'Content Depth', 'Core Web Vitals', 'Locale Strategy'." },
                },
                required: ["title", "rationale", "action", "impact_estimate", "effort", "category"],
              },
            },
          },
          required: ["suggestions"],
        } as any,
      },
    ],
    tool_choice: { type: "tool", name: "seo_suggestions" },
    messages: [{ role: "user", content: `Data:\n${JSON.stringify(payload)}` }],
  });

  const tool = msg.content.find((b: any) => b.type === "tool_use") as any;
  const raw = (tool?.input?.suggestions ?? []) as Partial<RawSuggestion>[];
  if (!raw.length) throw new Error(`No suggestions (stop: ${msg.stop_reason})`);

  const out: Suggestion[] = [];
  for (const s of raw.slice(0, MAX_SUGGESTIONS)) {
    const title = String(s.title ?? "").trim();
    const rationale = String(s.rationale ?? "").trim();
    const action = String(s.action ?? "").trim();
    const category = String(s.category ?? "General").trim();
    if (!title || !rationale || !action) continue; // skip malformed entries rather than fail the whole run
    const impact_estimate = IMPACT_VALUES.has(String(s.impact_estimate)) ? (s.impact_estimate as RawSuggestion["impact_estimate"]) : "med";
    const effort = EFFORT_VALUES.has(String(s.effort)) ? (s.effort as RawSuggestion["effort"]) : "small";
    out.push({
      id: crypto.randomUUID(),
      fingerprint: fingerprintOf(category, title),
      title, rationale, action, impact_estimate, effort, category,
    });
  }
  return out;
}
