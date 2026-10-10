import Anthropic from "@anthropic-ai/sdk";

/* Single Anthropic client for server-side generation. Reads ANTHROPIC_API_KEY
   from the env; returns null (never throws) when unconfigured so the UI can show
   a friendly "add your API key" state instead of crashing. */

let client: Anthropic | null = null;

export function anthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  // cache: "no-store" (2026-08-12) — without it, Next.js's Data Cache stores this
  // POST response indefinitely (confirmed on prod: a cached /v1/messages call sat in
  // .next/cache/fetch-cache with revalidate:31536000 — one year — and, since
  // deploy-prod.sh copies .next/cache forward across releases, would keep replaying
  // the SAME extraction result on every re-sync of that price list forever, never
  // re-reading the sheet's actual current content). Every AI call in this codebase
  // goes through this one client, so fixing it here covers all of them.
  if (!client) client = new Anthropic({ apiKey, fetchOptions: { cache: "no-store" } });
  return client;
}

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;
export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

// Cheaper/faster tier for mechanical, schema-constrained extraction (forced tool-call,
// fixed output shape — no open-ended writing). Used for the price-list catalog/units/
// meta/amenities calls, which run on every sync and dominate the API cost. Description
// generation and PDF/document reading stay on AI_MODEL (Sonnet) — those need real
// reading comprehension and only run once per project, not on every sync.
// Haiku 5.5 (2026-10-10): still accepts a forced tool_choice, but rejects any
// non-default temperature/top_p/top_k — don't send them on this tier.
export const AI_MODEL_FAST = process.env.ANTHROPIC_MODEL_FAST || "claude-haiku-5-5";

// Sonnet 5.5, Opus 5.5 and Fable/Mythos 5.1 answer a forced tool_choice
// ({type:"tool"} or {type:"any"}) with a 400. Found the hard way on 2026-10-10:
// switching prod's ANTHROPIC_MODEL to claude-sonnet-5-5 broke every structured
// call in the app at once, while a plain-prompt smoke test passed.
const rejectsForcedTool = (model: string) => /^claude-(sonnet-5-5|opus-5-5|fable-5-1|mythos-5-1)/.test(model);

type ForcedToolParams = Anthropic.MessageCreateParamsNonStreaming & {
  tool_choice: { type: "tool"; name: string };
};

/**
 * messages.create for a call that must come back as exactly one call to the
 * named tool. On models that still accept a forced tool_choice the params go
 * through unchanged. On the ones that don't, this sends tool_choice "auto",
 * tells the model in the system prompt to answer only through that tool, and
 * asks once more if the reply ended without a call. Callers keep reading the
 * tool_use block by type and keep their own "no content" errors.
 *
 * On Sonnet 5.5 it also sends thinking "between_tools" (no extended thinking).
 * A forced tool call never thought on the older models either, so prompts and
 * max_tokens calibrated against them stay valid. Other models can't take that
 * setting; they think at low effort with extra token room instead.
 */
export async function createToolCall(client: Anthropic, params: ForcedToolParams): Promise<Anthropic.Message> {
  if (!rejectsForcedTool(params.model)) return client.messages.create(params);

  const instruction = `Answer only by calling the \`${params.tool_choice.name}\` tool exactly once. Write no text before or after the call.`;
  // Appended after any cache_control block, so the cached prefix is unchanged.
  const system: Anthropic.MessageCreateParams["system"] =
    params.system === undefined ? instruction
    : typeof params.system === "string" ? `${params.system}\n\n${instruction}`
    : [...params.system, { type: "text", text: instruction }];

  const req: Record<string, unknown> = { ...params, system, tool_choice: { type: "auto", disable_parallel_tool_use: true } };
  if (params.model.startsWith("claude-sonnet-5-5")) {
    // Not in @anthropic-ai/sdk 0.110.0's ThinkingConfigParam yet, hence the untyped request.
    req.thinking = { type: "between_tools" };
  } else {
    req.output_config = { ...(params.output_config ?? {}), effort: "low" };
    req.max_tokens = params.max_tokens + 8000;
  }

  const once = () => client.messages.create(req as unknown as Anthropic.MessageCreateParamsNonStreaming);
  const msg = await once();
  const called = msg.content.some((b) => b.type === "tool_use" && b.name === params.tool_choice.name);
  // Retry only when the model simply chose to answer in text. A max_tokens cut
  // or a refusal would come back the same way, and the caller reports those.
  return called || msg.stop_reason !== "end_turn" ? msg : once();
}
