import type { McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { logLeadInteraction } from "@/lib/crm/logInteraction";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { fmtDate } from "../format";
import { LogInteractionInput } from "./logInteractionInput";

export function registerLogInteraction(server: McpServer) {
  server.registerTool(
    "crm_log_interaction",
    {
      title: "Log an interaction",
      description:
        "Records a CALL, NOTE, WHATSAPP_OUT, WHATSAPP_IN, EMAIL_OUT or EMAIL_IN on a lead's timeline exactly as the admin's log buttons do — attributed to the operator, marked as entered via Claude. Every type except NOTE advances the follow-up cadence and promotes NEW → CONTACTED; WHATSAPP_IN and EMAIL_IN imply leadReacted; NOTE is internal and changes nothing else. Nothing is sent here: WhatsApp goes out via wa.me, and EMAIL_OUT is for a mail the operator sent themselves outside the crm_draft_email flow (an email log may be subject-only). Inbound mail to the operator's mailbox is filed as EMAIL_IN automatically by the inbox poller — log EMAIL_IN by hand only for a reply that arrived elsewhere, or you create a duplicate.",
      inputSchema: LogInteractionInput,
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
    },
    async (input, ctx) =>
      runTool("crm_log_interaction", contextFromAuthInfo(ctx.http?.authInfo), input.leadId, async (c) => {
        const lead = await prisma.lead.findFirst({ where: { id: input.leadId, deletedAt: null, ...EXCLUDE_NEWSLETTER }, select: { id: true } });
        if (!lead) throw new ToolError("not_found", "Lead not found.");
        const occurredAt = input.occurredAt ? new Date(input.occurredAt) : undefined;
        const { interactionId } = await logLeadInteraction({ userId: c.userId, userName: c.userName }, input.leadId, {
          type: input.type, body: input.body, subject: input.subject, occurredAt, leadReacted: input.leadReacted, via: "mcp",
        });
        return { interactionId, type: input.type, occurredAt: fmtDate(occurredAt ?? new Date()) };
      }),
  );
}
