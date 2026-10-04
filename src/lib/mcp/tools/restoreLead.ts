import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { restoreLead } from "@/lib/crm/trashLead";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { LEAD_ROW_SELECT, leadRow } from "../leadRow";

const Input = z.object({ leadId: z.string().uuid() });

export function registerRestoreLead(server: McpServer) {
  server.registerTool(
    "crm_restore_lead",
    {
      title: "Restore a lead from the trash",
      description:
        "Brings a trashed lead back exactly as the admin's \"Restore\" button does, with the same RESTORED activity and timeline rows, marked as done via Claude. Only leads currently in the trash; a lead purged after 90 days is gone.",
      inputSchema: Input,
      annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: false },
    },
    async (input, ctx) =>
      runTool("crm_restore_lead", contextFromAuthInfo(ctx.http?.authInfo), input.leadId, async (c) => {
        const lead = await prisma.lead.findFirst({ where: { id: input.leadId, deletedAt: { not: null }, ...EXCLUDE_NEWSLETTER }, select: { id: true } });
        if (!lead) throw new ToolError("not_found", "Lead not found.");
        await restoreLead({ userId: c.userId, userName: c.userName }, lead.id, { via: "mcp" });
        const fresh = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, select: LEAD_ROW_SELECT });
        return { restored: true, lead: leadRow(fresh) };
      }),
  );
}
