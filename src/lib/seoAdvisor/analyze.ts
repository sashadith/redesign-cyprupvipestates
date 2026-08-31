import crypto from "node:crypto";
import { anthropic, AI_MODEL } from "@/lib/ai/anthropic";
import { PROJECT_BRIEF } from "@/lib/ai/projectBrief";
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
8. BEFORE flagging any click/impression/position swing as a ranking problem, check the siteChangelog field for an entry in the same window that could explain it (a URL migration, an archival batch, an internal-link-equity change, an in-flight title sweep). The GSC page-level deltas you're given have already had known redirect-chain pairs merged (old URL -> current canonical), so a raw "collapse" on a URL that migrated BEFORE that merge logic existed, or a shift on a page/locale touched by a changelog entry, is very likely a migration/transition artifact — attribute it there first, and only escalate to a real suggestion if the swing doesn't fit any changelog entry or is far larger than the transition alone would explain.
9. A closed sweep batch's result is in titleSweepResults, never in titleSweep. Read that entry's \`verdict\` and quote it whole: each result carries a CONTROL GROUP (the comparable unswept pages over the same two windows) and a POWER figure, and both change the conclusion. A batch whose CTR fell while the control fell as far has no measured effect, not a failed rewrite; a result that is not statistically significant means this many clicks could not have detected the effect, not that there was none. Never report a swept batch's CTR change without the control's, and never call a rewrite a failure on a null result. If the entry says the swept pages' average position moved and the control's did not, the ranking is the likelier cause and the snippet is not the thing to re-litigate.
10. The pagePower field carries a per-page and per-template-class DIAGNOSIS with a one-sentence \`reason\`. The reason is the evidence; the diagnosis word ("buried", "unclicked", "invisible", "repelling", "unjudged") is only the label of the threshold that evidence crossed. Cite the reason text and carry its qualifications into your rationale — never restate the label as though it were an established fact, and never assert something the reason explicitly rules out. Read pagePower.notes before using the field: it states what the summary is truncated to, what "unjudged" does and does not mean, which pages were excluded from a pile for being published too recently to have been counted over the window, and which verdicts cannot be reached at this site's traffic volume at all. Prefer discussing these named piles over re-deriving your own thresholds from the raw metrics.

You'll receive a compact JSON data payload (GSC 28-day period-over-period stats per locale, click winners/losers, the CTR watchlist, a striking-distance list, Core Web Vitals status per template class, platform/publishing stats, title-sweep status, a truncated Page Power diagnosis summary with its caveats in pagePower.notes, and a site changelog of recent structural changes). Analyze it and produce AT MOST 5 suggestions — quality over quantity; if the data doesn't support 5 good ideas, return fewer.

Each suggestion must be concrete and executable by a developer/marketer working on this codebase — not generic advice. Cite the SPECIFIC data points that justify it (numbers, URLs, locales) in the rationale. Return your suggestions via the seo_suggestions tool.`;

export type RawSuggestion = {
  title: string;
  rationale: string;
  action: string;
  impact_estimate: "low" | "med" | "high";
  effort: "clicks" | "small" | "session";
  category: string;
  targets?: string[];
};

export type Suggestion = RawSuggestion & { id: string; fingerprint: string };

const MAX_SUGGESTIONS = 5;
const IMPACT_VALUES = new Set(["low", "med", "high"]);
const EFFORT_VALUES = new Set(["clicks", "small", "session"]);

function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, " ");
}

// A path/URL as written by the model, reduced to something that survives
// harmless variation: absolute URLs lose their origin, trailing slashes and
// query strings go, case is flattened.
export function normalizeTarget(t: string): string {
  let v = String(t ?? "").trim().toLowerCase();
  v = v.replace(/^https?:\/\/[^/]+/, "");
  v = v.split(/[?#]/)[0];
  v = v.replace(/\/+$/, "");
  return v.startsWith("/") ? v : v ? `/${v}` : "";
}

// The fingerprint is what the suppression window counts, so it has to name
// the SAME suggestion across weeks. It used to hash category + title — and
// the title is written fresh by the model every run. Measured 2026-08-31
// over 40 suggestions in 10 runs: not one fingerprint ever repeated, so
// suppression could never fire and never had. Categories recurred constantly
// in the same period (Internal Linking 7x, CTR 6x), i.e. the repetition was
// real and only the key failed to see it.
//
// Anchoring on the pages instead makes it stable, because a URL is a fact in
// the payload rather than a phrasing choice. Targets are sorted so the order
// the model happens to list them in cannot change the key.
//
// Without targets we fall back to the old title hash. That is deliberately no
// worse than before rather than better: a suggestion naming no page is one we
// cannot recognise again, and pretending otherwise (e.g. keying on category
// alone) would silence a whole category on one dismissal.
export function fingerprintOf(category: string, title: string, targets: string[]): string {
  const cat = category.toLowerCase().trim();
  const anchor = targets.map(normalizeTarget).filter(Boolean).sort();
  const key = anchor.length ? `${cat}::${anchor.join("|")}` : `${cat}::${normalizeTitle(title)}`;
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 24);
}

export async function analyzePayload(payload: AdvisorPayload): Promise<Suggestion[]> {
  const client = anthropic();
  if (!client) throw new Error("ANTHROPIC_API_KEY not configured");

  const msg = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 4096,
    // Brief first, role second: the brief is the shared ground every AI feature
    // stands on (who we are, the funnel, the hard rules); SYSTEM_PROMPT is this
    // feature's strategist role on top. One cache_control on the last block
    // covers the concatenation.
    system: [
      { type: "text", text: PROJECT_BRIEF },
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
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
                  targets: {
                    type: "array",
                    items: { type: "string" },
                    description: "The page paths this suggestion is about, exactly as they appear in the data payload (e.g. '/de/blog/haustier-nach-zypern-bringen'). Copy them from the data — never invent or guess a URL. Use a small number of the most specific pages; for a site-wide or template-wide suggestion, return an empty array rather than listing every page.",
                  },
                },
                required: ["title", "rationale", "action", "impact_estimate", "effort", "category", "targets"],
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
    const targets = Array.isArray(s.targets) ? s.targets.map((t) => String(t ?? "").trim()).filter(Boolean) : [];
    out.push({
      id: crypto.randomUUID(),
      fingerprint: fingerprintOf(category, title, targets),
      title, rationale, action, impact_estimate, effort, category, targets,
    });
  }
  return out;
}
