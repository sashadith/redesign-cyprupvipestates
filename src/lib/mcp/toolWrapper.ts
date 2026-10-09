import type { CallToolResult } from "@modelcontextprotocol/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { McpConfigError } from "./publicOrigin";
import { TOOL_CALLS_PER_MINUTE, toolCallLimited } from "./rateLimit";
import { toolResultFromOutcome } from "./toolResult";
import type { McpCallContext } from "./context";

export type ToolErrorCode = "validation" | "not_found" | "rate_limited" | "config" | "internal" | "unauthorized" | "smtp";

export class ToolError extends Error {
  constructor(public code: ToolErrorCode, message: string) {
    super(message);
  }
}

// Every tool handler runs through here: auth context check, per-token rate
// limit, error → {isError} mapping, and one McpToolCall audit row (never the
// arguments; `opts.detail` may add a small JSON summary such as a length or an
// external message id). Unhandled exceptions are logged WITHOUT the args and returned
// as a generic "internal" error so nothing about the failure leaks to the
// client beyond the fact that it failed.
export async function runTool<T>(
  name: string,
  ctx: McpCallContext | null,
  leadId: string | null,
  fn: (ctx: McpCallContext) => Promise<T>,
  opts: { detail?: () => Prisma.InputJsonValue | undefined } = {},
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
        // Prisma error messages are multi-line and embed query arguments, so
        // only genuine "at …" stack frames are logged — never the message body.
        console.error(
          `mcp tool ${name} failed: ${e instanceof Error ? e.name : "non-error thrown"}`,
          e instanceof Error ? (e.stack ?? "").split("\n").filter((l) => /^\s+at /.test(l)).join("\n") : "",
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
      data: { userId: ctx.userId, tokenId: ctx.tokenId, tool: name, leadId, ok: outcome.ok, errorCode: outcome.ok ? null : outcome.code, durationMs: Date.now() - started, detail: opts.detail?.() },
    })
    .catch((e) => console.error("mcp audit insert failed:", e instanceof Error ? e.message : e));
  return result;
}
