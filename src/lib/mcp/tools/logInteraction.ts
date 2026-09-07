import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { logLeadInteraction } from "@/lib/crm/logInteraction";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { fmtDate } from "../format";

const Input = z.object({
  leadId: z.string().uuid(),
  type: z.enum(["CALL", "NOTE", "WHATSAPP_OUT", "WHATSAPP_IN"]),
  body: z.string().trim().min(1).max(4000),
  occurredAt: z.string().datetime({ offset: true }).optional().describe("ISO 8601, with or without a UTC offset; defaults to now"),
  leadReacted: z.boolean().optional().describe("The lead responded — resets the auto-follow-up chain (implied for WHATSAPP_IN)"),
});

export function registerLogInteraction(server: McpServer) {
  server.registerTool(
    "crm_log_interaction",
    {
      title: "Log an interaction",
      description:
        "Records a CALL, NOTE, WHATSAPP_OUT or WHATSAPP_IN on a lead's timeline exactly as the admin's log buttons do — attributed to the operator, marked as entered via Claude. CALL/WHATSAPP advance the follow-up cadence and promote NEW → CONTACTED; NOTE is internal and changes nothing else. WhatsApp is sent by the operator via wa.me — this only logs it.",
      inputSchema: Input,
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
    },
    async (input, ctx) =>
      runTool("crm_log_interaction", contextFromAuthInfo(ctx.http?.authInfo), input.leadId, async (c) => {
        const lead = await prisma.lead.findFirst({ where: { id: input.leadId, deletedAt: null, ...EXCLUDE_NEWSLETTER }, select: { id: true } });
        if (!lead) throw new ToolError("not_found", "Lead not found.");
        const occurredAt = input.occurredAt ? new Date(input.occurredAt) : undefined;
        const { interactionId } = await logLeadInteraction({ userId: c.userId, userName: c.userName }, input.leadId, {
          type: input.type, body: input.body, occurredAt, leadReacted: input.leadReacted, via: "mcp",
        });
        return { interactionId, type: input.type, occurredAt: fmtDate(occurredAt ?? new Date()) };
      }),
  );
}
