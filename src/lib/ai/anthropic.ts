import Anthropic from "@anthropic-ai/sdk";

/* Single Anthropic client for server-side generation. Reads ANTHROPIC_API_KEY
   from the env; returns null (never throws) when unconfigured so the UI can show
   a friendly "add your API key" state instead of crashing. */

let client: Anthropic | null = null;

export function anthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;
export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// Cheaper/faster tier for mechanical, schema-constrained extraction (forced tool-call,
// fixed output shape — no open-ended writing). Used for the price-list catalog/units/
// meta/amenities calls, which run on every sync and dominate the API cost. Description
// generation and PDF/document reading stay on AI_MODEL (Sonnet) — those need real
// reading comprehension and only run once per project, not on every sync.
export const AI_MODEL_FAST = process.env.ANTHROPIC_MODEL_FAST || "claude-haiku-4-5-20251001";
