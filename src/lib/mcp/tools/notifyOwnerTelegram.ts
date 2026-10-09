import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { fmtDate } from "../format";

// notify_owner_telegram (2026-10-09): one plain-text Telegram message to the
// owner, through the same bot and chat as the cron alerts and the morning
// digest. The recipient is fixed server-side (TELEGRAM_CHAT_ID); the schema is
// strict, so a chat_id or any other extra parameter is REJECTED, not ignored.
export const NOTIFY_TOOL = "notify_owner_telegram";
export const NOTIFY_MAX_CHARS = 3_500;
export const NOTIFY_PER_HOUR = 10;

export const NotifyInput = z.object({
  text: z.string().trim().min(1).max(NOTIFY_MAX_CHARS),
}).strict();

export type NotifyDeps = {
  /** Successful sends of this tool since `since`, across all callers and workers. */
  countSentSince(since: Date): Promise<number>;
  /** Telegram message id, or null when Telegram is not configured on this server. */
  send(text: string): Promise<number | null>;
  now(): Date;
};

export type NotifyDetail = { length: number; telegramMessageId?: number };

export function realNotifyDeps(): NotifyDeps {
  return {
    // Counted in the audit table, not in memory: production runs two pm2
    // workers, and a per-process counter would allow twice the limit. Refused
    // and failed calls are ok=false, so they do not use up the allowance.
    // Accepted gap, same as crm_whatsapp_send's daily cap: two calls racing at
    // 9/10 within the same instant can both pass — a brake, not a ledger.
    countSentSince: (since) => prisma.mcpToolCall.count({ where: { tool: NOTIFY_TOOL, ok: true, createdAt: { gte: since } } }),
    async send(text) {
      const r = (await sendTelegramMessage(text, { plain: true })) as { result?: { message_id?: number } } | null;
      if (r === null) return null;
      return r.result?.message_id ?? -1;
    },
    now: () => new Date(),
  };
}

export async function performNotify(deps: NotifyDeps, input: unknown, detail: NotifyDetail) {
  // Validated here too (not only by the MCP layer), so the guarantees hold —
  // and are tested — independently of how the SDK applies the schema.
  const parsed = NotifyInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue?.code === "unrecognized_keys"
      ? `Only "text" is accepted; the recipient is fixed server-side (${(issue as { keys?: string[] }).keys?.join(", ")} refused). Nothing was sent.`
      : issue?.code === "too_big"
        ? `Text is longer than ${NOTIFY_MAX_CHARS} characters. Nothing was sent.`
        : `Invalid input: ${issue?.message ?? "text is required"}. Nothing was sent.`;
    throw new ToolError("validation", message);
  }
  const text = parsed.data.text;
  detail.length = text.length;

  const now = deps.now();
  const sentLastHour = await deps.countSentSince(new Date(now.getTime() - 3_600_000));
  if (sentLastHour >= NOTIFY_PER_HOUR) {
    throw new ToolError("rate_limited", `Limit reached: ${NOTIFY_PER_HOUR} messages per hour to the owner. Nothing was sent; try again later.`);
  }

  let messageId: number | null;
  try {
    messageId = await deps.send(text);
  } catch {
    throw new ToolError("internal", "Telegram did not accept the message. Nothing was sent.");
  }
  if (messageId === null) throw new ToolError("config", "Telegram is not configured on this server. Nothing was sent.");
  detail.telegramMessageId = messageId;
  return { sent: true, telegramMessageId: messageId, length: text.length, at: fmtDate(now) };
}

export function registerNotifyOwnerTelegram(server: McpServer) {
  server.registerTool(
    NOTIFY_TOOL,
    {
      title: "Notify the owner on Telegram",
      description:
        `Sends one plain-text Telegram message to the owner (Sascha), via the platform's own bot — the same chat as the cron alerts and the morning report. The recipient is fixed and cannot be chosen. Text only, max ${NOTIFY_MAX_CHARS} characters, no formatting. At most ${NOTIFY_PER_HOUR} messages per hour across all callers. Use it for things the owner must act on, not as a log.`,
      inputSchema: NotifyInput,
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: true },
    },
    async (input, ctx) => {
      const detail: NotifyDetail = { length: typeof (input as { text?: unknown })?.text === "string" ? (input as { text: string }).text.length : 0 };
      return runTool(NOTIFY_TOOL, contextFromAuthInfo(ctx.http?.authInfo), null, () => performNotify(realNotifyDeps(), input, detail), {
        detail: () => ({ ...detail }),
      });
    },
  );
}
