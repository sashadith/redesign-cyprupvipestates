import type { CallToolResult } from "@modelcontextprotocol/server";

export type ToolOutcome = { ok: true; data: unknown } | { ok: false; code: string; message: string };

export function toolResultFromOutcome(o: ToolOutcome): CallToolResult {
  if (o.ok) return { content: [{ type: "text", text: JSON.stringify(o.data, null, 1) }] };
  return { content: [{ type: "text", text: JSON.stringify({ error: o.code, message: o.message }) }], isError: true };
}
