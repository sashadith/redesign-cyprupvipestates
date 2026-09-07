import type { CallToolResult } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import { McpConfigError } from "./publicOrigin";
import { TOOL_CALLS_PER_MINUTE, toolCallLimited } from "./rateLimit";
import { toolResultFromOutcome } from "./toolResult";
import type { McpCallContext } from "./context";

export type ToolErrorCode = "validation" | "not_found" | "rate_limited" | "config" | "internal" | "unauthorized";

export class ToolError extends Error {
  constructor(public code: ToolErrorCode, message: string) {
    super(message);
  }
}

// Every tool handler runs through here: auth context check, per-token rate
// limit, error → {isError} mapping, and one McpToolCall audit row (never the
// arguments). Unhandled exceptions are logged WITHOUT the args and returned
// as a generic "internal" error so nothing about the failure leaks to the
// client beyond the fact that it failed.
export async function runTool<T>(
  name: string,
  ctx: McpCallContext | null,
  leadId: string | null,
  fn: (ctx: McpCallContext) => Promise<T>,
): Promise<CallToolResult> {
  const started = Date.now();
  if (!ctx) return toolResultFromOutcome({ ok: false, code: "unauthorized", message: "No valid token for this call." });
  let outcome: { ok: true; data: unknown } | { ok: false; code: ToolErrorCode; message: string };
  if (toolCallLimited(ctx.tokenId)) {
    outcome = {
      ok: false,
      code: "rate_limited",
      message: `Rate limit: ${TOOL_CALLS_PER_MINUTE} tool calls per minute. Wait a minute, then continue.`,
    };
  } else {
    try {
      outcome = { ok: true, data: await fn(ctx) };
    } catch (e) {
      if (e instanceof ToolError) outcome = { ok: false, code: e.code, message: e.message };
      else if (e instanceof McpConfigError) outcome = { ok: false, code: "config", message: e.message };
      else {
        console.error(
          `mcp tool ${name} failed: ${e instanceof Error ? e.name : "non-error thrown"}`,
          e instanceof Error ? (e.stack ?? "").split("\n").slice(1).join("\n") : "",
        );
        outcome = { ok: false, code: "internal", message: "Internal error — details are in the server log." };
      }
    }
  }
  let result: CallToolResult;
  try {
    result = toolResultFromOutcome(outcome);
  } catch (e) {
    console.error(`mcp tool ${name}: result not serialisable: ${e instanceof Error ? e.name : "non-error thrown"}`);
    outcome = { ok: false, code: "internal", message: "Internal error — the result could not be serialised." };
    result = toolResultFromOutcome(outcome);
  }
  await prisma.mcpToolCall
    .create({
      data: { userId: ctx.userId, tokenId: ctx.tokenId, tool: name, leadId, ok: outcome.ok, errorCode: outcome.ok ? null : outcome.code, durationMs: Date.now() - started },
    })
    .catch((e) => console.error("mcp audit insert failed:", e instanceof Error ? e.message : e));
  return result;
}
