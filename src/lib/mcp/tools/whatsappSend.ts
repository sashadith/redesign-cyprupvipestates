import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { logLeadInteraction, type LogInteractionInput } from "@/lib/crm/logInteraction";
import type { EmailActor } from "@/lib/crm/sendLeadEmail";
import { chatIdFor } from "@/lib/openwa/phoneMatch";
import { createOpenWaClient } from "@/lib/openwa/client";
import { readOpenWaConfig } from "@/lib/openwa/config";
import { shapeThread, type RawMessage } from "@/lib/openwa/shapeMessages";
import { decideSend, nicosiaDayStart } from "@/lib/openwa/sendGuards";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { fmtDate } from "../format";

// Repo convention: a named ZodObject, passed whole as inputSchema.
const Input = z.object({
  leadId: z.string().uuid(),
  text: z.string().trim().min(1).max(4000),
});

export type SendInput = { leadId: string; text: string };

// The seam that makes the guard composition testable: everything that leaves
// this process is reached through here, so a test can prove the tool obeys
// the verdict (and never calls sendText when it does not) without a database,
// a network call, or a live gateway.
export type SendDeps = {
  findLead(leadId: string): Promise<{ id: string; phone: string | null } | null>;
  countSentToday(since: Date): Promise<number>;
  fetchThread(chatId: string, limit: number): Promise<RawMessage[]>;
  sendText(chatId: string, text: string): Promise<void>;
  logInteraction(actor: EmailActor, leadId: string, input: LogInteractionInput): Promise<{ interactionId: string }>;
  dailyCap: number;
};

// The gateway answers a never-contacted number with a single body-less
// `unknown` row stamped at the moment of the call — a sync artefact, not a
// message. Ask for a few rows rather than one, because that artefact can
// otherwise occupy the only slot and hide a genuinely empty thread.
const THREAD_PROBE_LIMIT = 5;

// Same redaction convention as runTool (toolWrapper.ts:45-48): the error name
// plus genuine "at …" stack frames only, never the message body — Prisma
// messages embed query arguments.
function logRedacted(what: string, e: unknown): void {
  console.error(
    `mcp tool crm_whatsapp_send ${what}: ${e instanceof Error ? e.name : "non-error thrown"}`,
    e instanceof Error ? (e.stack ?? "").split("\n").filter((l) => /^\s+at /.test(l)).join("\n") : "",
  );
}

export function realSendDeps(): SendDeps {
  const cfg = readOpenWaConfig();
  const client = createOpenWaClient();
  return {
    findLead: (leadId) =>
      prisma.lead.findFirst({
        where: { id: leadId, deletedAt: null, ...EXCLUDE_NEWSLETTER },
        select: { id: true, phone: true },
      }),
    countSentToday: (since) =>
      prisma.leadInteraction.count({
        where: {
          type: "WHATSAPP_OUT",
          occurredAt: { gte: since },
          metadata: { path: ["via"], equals: "mcp-whatsapp" },
        },
      }),
    fetchThread: (chatId, limit) => client.fetchThread(chatId, limit),
    sendText: (chatId, text) => client.sendText(chatId, text),
    logInteraction: logLeadInteraction,
    dailyCap: cfg.dailySendCap,
  };
}

export async function performSend(deps: SendDeps, input: SendInput, actor: EmailActor) {
  const lead = await deps.findLead(input.leadId);
  const chatId = lead ? chatIdFor(lead.phone) : null;

  // Guard 3: a conversation exists only if the thread holds at least one REAL
  // message. The raw row count cannot answer that — see THREAD_PROBE_LIMIT
  // above — so the rows go through shapeThread(), whose isRealMessage() drops
  // exactly the artefact class that would otherwise make every typo look like
  // an existing conversation.
  let threadExists = false;
  if (chatId) {
    let raw: RawMessage[];
    try {
      raw = await deps.fetchThread(chatId, THREAD_PROBE_LIMIT);
    } catch (e) {
      // Fail closed, and say why: an unverifiable thread is not a thread.
      logRedacted("thread probe failed", e);
      throw new ToolError(
        "internal",
        "The WhatsApp gateway could not confirm that a conversation with this number exists, so nothing was sent. This tool never sends into an unconfirmed thread. Try again in a moment.",
      );
    }
    threadExists = shapeThread(raw).length > 0;
  }

  // Two accepted gaps in this count, both fine for a single-operator
  // connector: it counts only sends whose log write succeeded (a send whose
  // logging failed is invisible to the cap), and there is a TOCTOU window
  // between counting and sending, so two concurrent calls at cap-1 can both
  // pass. Neither is a bug to fix here — the cap is a brake, not a ledger.
  const sentToday = await deps.countSentToday(nicosiaDayStart(new Date()));

  const decision = decideSend({ leadExists: !!lead, chatId, threadExists, sentToday, dailyCap: deps.dailyCap });
  if (!decision.allowed) throw new ToolError(decision.code, decision.reason);

  await deps.sendText(chatId!, input.text);

  // Sent. From here a failure must never be reported as "not sent", and
  // the send must never be retried to repair a logging error.
  try {
    const { interactionId } = await deps.logInteraction(actor, lead!.id, {
      type: "WHATSAPP_OUT",
      body: input.text,
      via: "mcp-whatsapp",
    });
    return { sent: true, interactionId, to: lead!.phone, address: chatId!, at: fmtDate(new Date()) };
  } catch (e) {
    // The worst branch in the tool: a real customer holds a message the CRM
    // may not know about. It must reach the server log.
    logRedacted("send logged to WhatsApp but the timeline write failed", e);
    return {
      sent: true,
      interactionId: null,
      to: lead!.phone,
      address: chatId!,
      at: fmtDate(new Date()),
      warning:
        "The message was delivered to WhatsApp but the timeline write reported an error. Check this lead's timeline first: the interaction row is written before the follow-up cadence is applied, so it may already be there and logging it by hand would duplicate it. Log it by hand only if it is missing. Never send the message again.",
    };
  }
}

export function registerWhatsappSend(server: McpServer) {
  server.registerTool(
    "crm_whatsapp_send",
    {
      title: "Send a WhatsApp message to a lead",
      description:
        "Sends one text message over WhatsApp to a lead, and logs it on that lead's timeline as WHATSAPP_OUT. It can only continue a conversation that already exists — a number with no thread is refused rather than messaged, so a wrong number cannot reach a stranger. A daily cap applies. Send only on an explicit instruction from the operator; a WhatsApp message cannot be recalled after a few minutes.",
      inputSchema: Input,
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: true },
    },
    async (input, ctx) =>
      runTool("crm_whatsapp_send", contextFromAuthInfo(ctx.http?.authInfo), input.leadId, async (c) =>
        performSend(realSendDeps(), input, { userId: c.userId, userName: c.userName }),
      ),
  );
}
