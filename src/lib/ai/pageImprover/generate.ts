import { anthropic, AI_MODEL } from "../anthropic";
import { PROJECT_BRIEF } from "../projectBrief";
import { copyViolation } from "../copyRules";
import { IMPROVER_TITLE_BUDGET, IMPROVER_DESC_BUDGET, type ImprovementProposal } from "./types";
import type { ImprovementInput } from "./gather";

// One page, one proposal. The system layer is the shared brief plus a role
// block; the payload is everything gather.ts assembled. Tool-forced so the
// output is structured, validated because the model is not trusted to be
// perfect (same posture as seoMeta.ts): one corrective retry, then a loud
// failure — a visible "regenerate" in the admin is cheaper than a bad draft
// that a tired click applies.
const ROLE = `You are drafting a concrete repair for ONE page of this site, based on its diagnosis and its own search data.

Rules for this task, on top of the brief:
- Write the metaTitle and metaDescription in the page's own locale (given in the payload). They must contain NO digits (a bare year like 2026 is the only exception) and NO {placeholder} tokens — this page's render path does not resolve them, so anything you write appears verbatim in the Google snippet.
- metaTitle: aim 45–55 characters, hard ceiling ${IMPROVER_TITLE_BUDGET}. metaDescription: aim 130–145, hard ceiling ${IMPROVER_DESC_BUDGET}. Put the reason to click in the first half.
- contentSections are drafts for a HUMAN EDITOR, in the page's locale, each serving named queries from the payload. Figure-free prose (year exception applies). 2–4 sections; if the diagnosis is about the title rather than the content, fewer or none is correct.
- internalLinks suggest links FROM other pages of this site TO this page (fromPath must be a plausible path on this site — prefer ones you saw in the payload). These are suggestions for the human; you cannot see the whole site.
- The sibling examples show what currently works ON THIS SITE. They are patterns, not targets to copy; do not produce near-duplicates of them.
- rationale: two or three sentences citing the page's own query data. If the sampled queries are too thin to justify a section, say so there instead of inventing one.`;

const violationNotes = (p: Partial<ImprovementProposal>): string[] => {
  const notes: string[] = [];
  const meta: Array<[string, string | undefined, number]> = [
    ["metaTitle", p.metaTitle, IMPROVER_TITLE_BUDGET],
    ["metaDescription", p.metaDescription, IMPROVER_DESC_BUDGET],
  ];
  for (const [field, value, budget] of meta) {
    const v = value ?? "";
    if (copyViolation(v, { allowYears: true, placeholders: "none" }))
      notes.push(`${field} contains a digit (only a bare year is allowed) or a {placeholder} (never allowed on this page type). Rewrite it without the figure — drop the fact, do not spell it in words.`);
    if (v.trim().length > budget)
      notes.push(`${field} is ${v.trim().length} characters against a hard ceiling of ${budget}. Rewrite it shorter by dropping the least important detail.`);
  }
  for (const [i, s] of Array.from((p.contentSections ?? []).entries())) {
    if (copyViolation(`${s.heading} ${s.draft}`, { allowYears: true, placeholders: "none" }))
      notes.push(`contentSections[${i}] contains a digit or a {placeholder}. Prose on this page type must be figure-free (bare years excepted) — rewrite that section.`);
  }
  return notes;
};

export async function generateProposal(input: ImprovementInput): Promise<ImprovementProposal> {
  const client = anthropic();
  if (!client) throw new Error("ANTHROPIC_API_KEY not configured");
  if (input.suppressed) throw new Error("Page is inside a live re-measurement window — generation refused (see the sweep log).");

  const payload = {
    locale: String(input.page.locale),
    path: input.page.path,
    kind: input.page.kind,
    diagnosis: input.verdict?.diagnosis ?? "unknown",
    reason: input.verdict?.reason ?? "No verdict for this page in the current window.",
    metrics: input.verdict
      ? { impressions: input.verdict.impressions, ctr: input.verdict.ctr, position: input.verdict.position }
      : null,
    templateClassVerdict: input.classVerdict
      ? { class: input.classVerdict.templateClass, diagnosis: input.classVerdict.diagnosis, reason: input.classVerdict.reason }
      : null,
    currentMeta: input.currentSeo,
    queries: input.queries,
    queriesCaveat: "Privacy-sampled by Google: relative weights are meaningful, absolute totals are not.",
    pageAsServed: input.pageText,
    workingPatternsFromThisSite: input.siblings,
  };

  const attempt = async (correction?: string): Promise<Partial<ImprovementProposal>> => {
    const msg = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 4096,
      system: [{ type: "text", text: `${PROJECT_BRIEF}\n\n${ROLE}` }],
      tools: [{
        name: "page_improvement",
        description: "The proposed repair for this one page.",
        // No cast on this literal. seoMeta.ts and seoAdvisor/analyze.ts both
        // carry `as any` here and the plan's draft of this file carried
        // `as never`; checked 2026-08-24 against @anthropic-ai/sdk 0.110.0,
        // all three are unnecessary — Tool.InputSchema is
        // `{ type: "object"; properties?: unknown; required?: string[] }` with
        // an index signature, so the uncast literal assigns cleanly. Keeping it
        // uncast is not tidiness: a cast makes `type: "objekt"` or a `required`
        // holding a non-string compile, and this is the one path in the feature
        // where a broken schema surfaces only as a 400 from a call nobody can
        // run locally (no ANTHROPIC_API_KEY on this machine, by decision).
        input_schema: {
          type: "object",
          properties: {
            metaTitle: { type: "string" },
            metaDescription: { type: "string" },
            rationale: { type: "string" },
            contentSections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  heading: { type: "string" },
                  draft: { type: "string" },
                  queriesServed: { type: "array", items: { type: "string" } },
                },
                required: ["heading", "draft", "queriesServed"],
              },
            },
            internalLinks: {
              type: "array",
              items: {
                type: "object",
                properties: { fromPath: { type: "string" }, anchor: { type: "string" }, why: { type: "string" } },
                required: ["fromPath", "anchor", "why"],
              },
            },
          },
          required: ["metaTitle", "metaDescription", "rationale", "contentSections", "internalLinks"],
        },
      }],
      tool_choice: { type: "tool", name: "page_improvement" },
      messages: [{ role: "user", content: `${JSON.stringify(payload, null, 1)}${correction ? `\n\n${correction}` : ""}` }],
    });
    const tool = msg.content.find((b) => b.type === "tool_use") as { input?: Partial<ImprovementProposal> } | undefined;
    const raw = tool?.input ?? {};
    if (!raw.metaTitle && !raw.metaDescription) throw new Error(`No content (stop: ${msg.stop_reason})`);
    return raw;
  };

  let raw = await attempt();
  const notes = violationNotes(raw);
  // The retry names what broke, because a blind second call with the identical
  // prompt mostly reproduces the same mistake (seoMeta.ts's retry, same
  // reasoning). It asks for a WHOLE new draft rather than a patch: attempt()
  // replays no assistant turn, so the second call cannot see the text it is
  // being corrected on, and an instruction to "keep the rest" would name
  // something the model is not holding.
  if (notes.length)
    raw = await attempt(`Your first draft was rejected on the points below. Write the proposal again in full — you are not editing that draft, you cannot see it — and avoid these faults:\n- ${notes.join("\n- ")}`);
  const still = violationNotes(raw);
  if (still.length) throw new Error(`Proposal still violates the copy rules after a retry: ${still.join(" · ")}`);

  return {
    metaTitle: (raw.metaTitle ?? "").trim(),
    metaDescription: (raw.metaDescription ?? "").trim(),
    rationale: (raw.rationale ?? "").trim(),
    contentSections: raw.contentSections ?? [],
    internalLinks: raw.internalLinks ?? [],
  };
}
