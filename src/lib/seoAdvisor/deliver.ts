import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Suggestion } from "./analyze";
import type { StoredSuggestion } from "./types";
import type { AdvisorPayload } from "./gather";

// Deterministic template, not a second LLM call — the suggestion's own
// fields already say everything a human/Claude Code session needs to act on
// it; no extra API cost or extra place for the wording to drift from what
// was actually approved.
export function buildPreparedPrompt(s: Pick<StoredSuggestion, "title" | "rationale" | "action">): string {
  return `SEO Advisor suggestion — approved for implementation.

Title: ${s.title}

Rationale: ${s.rationale}

Task: ${s.action}

Follow this project's existing SEO conventions (docs/SEO-GROWTH-ROADMAP-2026.md, docs/SEO-TITLE-SWEEP-LOG.md) and the code patterns already established in src/lib/seo/. Do not touch any URL still inside its title-sweep 42-day re-measurement window. Report back what changed before deploying.`;
}

export async function storeAdvisorRun(payload: AdvisorPayload, suggestions: Suggestion[]) {
  const payloadHash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const stored: StoredSuggestion[] = suggestions.map((s) => ({
    id: s.id,
    fingerprint: s.fingerprint,
    title: s.title,
    rationale: s.rationale,
    action: s.action,
    impact_estimate: s.impact_estimate,
    effort: s.effort,
    category: s.category,
    status: "open",
  }));
  return prisma.advisorRun.create({ data: { payloadHash, suggestions: stored as any } });
}
