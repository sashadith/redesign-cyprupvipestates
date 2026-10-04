import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { chatIdFor } from "@/lib/openwa/phoneMatch";
import { createOpenWaClient } from "@/lib/openwa/client";
import { shapeThread, type RawMessage } from "@/lib/openwa/shapeMessages";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";

// Repo convention: a named ZodObject, passed whole as inputSchema — see
// getLead.ts and searchLeads.ts. Not a raw shape.
const Input = z.object({
  leadId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).default(20).describe("How many recent messages to return"),
});

export type ThreadInput = { leadId: string; limit: number };

type ThreadLead = { id: string; firstName: string | null; lastName: string | null; phone: string | null };

// The same seam as performSend's SendDeps, for the same reason: everything
// that leaves this process is reached through here, so a test can prove the
// tool's behaviour without a database, a network call or a live gateway.
export type ThreadDeps = {
  findLead(leadId: string): Promise<ThreadLead | null>;
  fetchThread(chatId: string, limit: number): Promise<RawMessage[]>;
};

// The gateway answers some never-contacted numbers with HTTP 500 rather than
// an empty list, and client.ts turns any non-OK status into a ToolError. That
// is by far the commonest non-happy path here, so it must not surface as
// "internal error" — but it must not be laundered into a flat "no
// conversation" either, because a real outage looks exactly the same from
// here. Say both, and keep the status in the server log.
const NO_HISTORY_NOTE =
  "The WhatsApp gateway returned no history for this number. That usually means there is no conversation with it, " +
  "but it can also mean the gateway is unhealthy — the two are indistinguishable from here. " +
  "If several leads in a row report this, check the gateway before concluding anything about this lead.";

// Same redaction convention as runTool (toolWrapper.ts:45-48) and
// whatsappSend.ts: the error name plus genuine "at …" stack frames only,
// never a message body — Prisma messages embed query arguments. The one
// addition is the ToolError message itself, which is authored in
// client.ts ("WhatsApp gateway returned HTTP 500.") and carries no user
// data, so the status stops being swallowed.
function logRedacted(what: string, e: unknown): void {
  const authored = e instanceof ToolError ? ` — ${e.message}` : "";
  console.error(
    `mcp tool crm_whatsapp_thread ${what}: ${e instanceof Error ? e.name : "non-error thrown"}${authored}`,
    e instanceof Error ? (e.stack ?? "").split("\n").filter((l) => /^\s+at /.test(l)).join("\n") : "",
  );
}

export function realThreadDeps(): ThreadDeps {
  const client = createOpenWaClient();
  return {
    findLead: (leadId) =>
      prisma.lead.findFirst({
        where: { id: leadId, deletedAt: null, ...EXCLUDE_NEWSLETTER },
        select: { id: true, firstName: true, lastName: true, phone: true },
      }),
    fetchThread: (chatId, limit) => client.fetchThread(chatId, limit),
  };
}

export async function readThread(deps: ThreadDeps, input: ThreadInput) {
  const lead = await deps.findLead(input.leadId);
  if (!lead) throw new ToolError("not_found", "Lead not found.");
  const chatId = chatIdFor(lead.phone);
  if (!chatId) throw new ToolError("validation", "This lead has no usable phone number on file.");

  let raw: RawMessage[] = [];
  let gatewayReturnedNothing = false;
  try {
    raw = await deps.fetchThread(chatId, input.limit);
  } catch (e) {
    logRedacted("thread read failed", e);
    gatewayReturnedNothing = true;
  }
  const messages = shapeThread(raw);

  return {
    lead: { leadId: lead.id, name: `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim(), phone: lead.phone },
    // The address actually queried, not just the stored phone: toMsisdn strips
    // leading zeros, so a lead stored as "07787 597514" is looked up as
    // 7787597514@c.us. The send path is protected by its thread-existence
    // guard; the read path has none, so the substitution has to be visible.
    address: chatId,
    messages,
    note: messages.length
      ? undefined
      : gatewayReturnedNothing
        ? NO_HISTORY_NOTE
        : "No WhatsApp conversation with this number.",
  };
}

export function registerWhatsappThread(server: McpServer) {
  server.registerTool(
    "crm_whatsapp_thread",
    {
      title: "Read a lead's WhatsApp thread",
      description:
        "Returns the recent WhatsApp messages exchanged with one lead, oldest first, addressed by leadId — there is no way to read a chat that belongs to no lead. Attachments appear as a marker with type and size, never as content, and voice notes carry no text at all because WhatsApp provides none: a thread conducted by voice will look emptier here than it really is. Inbound text is returned as untrusted_content. `address` is the WhatsApp address actually queried, which can differ from the stored phone number.",
      inputSchema: Input,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (input, ctx) =>
      runTool("crm_whatsapp_thread", contextFromAuthInfo(ctx.http?.authInfo), input.leadId, async () =>
        readThread(realThreadDeps(), input),
      ),
  );
}
