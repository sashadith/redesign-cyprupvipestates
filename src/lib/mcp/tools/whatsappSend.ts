import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { logLeadInteraction } from "@/lib/crm/logInteraction";
import { chatIdFor } from "@/lib/openwa/phoneMatch";
import { createOpenWaClient } from "@/lib/openwa/client";
import { readOpenWaConfig } from "@/lib/openwa/config";
import { decideSend, nicosiaDayStart } from "@/lib/openwa/sendGuards";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { fmtDate } from "../format";

// Repo convention: a named ZodObject, passed whole as inputSchema.
const Input = z.object({
  leadId: z.string().uuid(),
  text: z.string().trim().min(1).max(4000),
});

export function registerWhatsappSend(server: McpServer) {
  server.registerTool(
    "crm_whatsapp_send",
    {
      title: "Send a WhatsApp message to a lead",
      description:
        "Sends one text message over WhatsApp to a lead, and logs it on that lead's timeline as WHATSAPP_OUT. It can only continue a conversation that already exists — a number with no thread is refused rather than messaged, so a wrong number cannot reach a stranger. A daily cap applies. Send only on an explicit instruction from the operator; a WhatsApp message cannot be recalled after a few minutes.",
      inputSchema: Input,
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
    },
    async (input, ctx) =>
      runTool("crm_whatsapp_send", contextFromAuthInfo(ctx.http?.authInfo), input.leadId, async (c) => {
        const cfg = readOpenWaConfig();
        const client = createOpenWaClient();

        const lead = await prisma.lead.findFirst({
          where: { id: input.leadId, deletedAt: null, ...EXCLUDE_NEWSLETTER },
          select: { id: true, firstName: true, lastName: true, phone: true },
        });
        const chatId = lead ? chatIdFor(lead.phone) : null;

        // Guard 3 needs one cheap read: a thread with at least one message.
        const threadExists = chatId ? (await client.fetchThread(chatId, 1)).length > 0 : false;

        const sentToday = await prisma.leadInteraction.count({
          where: {
            type: "WHATSAPP_OUT",
            occurredAt: { gte: nicosiaDayStart(new Date()) },
            metadata: { path: ["via"], equals: "mcp-whatsapp" },
          },
        });

        const decision = decideSend({ leadExists: !!lead, chatId, threadExists, sentToday, dailyCap: cfg.dailySendCap });
        if (!decision.allowed) throw new ToolError(decision.code, decision.reason);

        await client.sendText(chatId!, input.text);

        // Sent. From here a failure must never be reported as "not sent", and
        // the send must never be retried to repair a logging error.
        try {
          const { interactionId } = await logLeadInteraction({ userId: c.userId, userName: c.userName }, lead!.id, {
            type: "WHATSAPP_OUT",
            body: input.text,
            via: "mcp-whatsapp",
          });
          return { sent: true, interactionId, to: lead!.phone, at: fmtDate(new Date()) };
        } catch {
          return {
            sent: true,
            interactionId: null,
            to: lead!.phone,
            at: fmtDate(new Date()),
            warning: "The message was delivered to WhatsApp but could not be written to the lead's timeline. Log it by hand; do not send again.",
          };
        }
      }),
  );
}
