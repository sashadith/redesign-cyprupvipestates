import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { trashLead } from "@/lib/crm/trashLead";
import { nameMatches } from "@/lib/crm/leadIdentity";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { fmtDate } from "../format";

export const TRASH_RETENTION_DAYS = 90;

const Input = z.object({
  leadId: z.string().uuid(),
  confirmName: z.string().trim().min(1).max(200).describe("The lead's full name exactly as crm_get_lead returns it — binds the call to the lead the operator means."),
  reason: z.string().trim().min(3).max(500).describe("Why, in the operator's words; goes into the timeline row."),
});

export function registerDeleteLead(server: McpServer) {
  server.registerTool(
    "crm_delete_lead",
    {
      title: "Move a lead to the trash",
      description:
        `Moves a lead to the trash exactly as the admin's "Move to trash" button does — hidden everywhere, restorable for ${TRASH_RETENTION_DAYS} days (crm_restore_lead), with the same DELETED activity and timeline rows, marked as done via Claude. Permanent deletion is not available here. Only on the operator's explicit instruction, never as a tidy-up suggestion; \`confirmName\` must match the lead's full name.`,
      inputSchema: Input,
      annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: true },
    },
    async (input, ctx) =>
      runTool("crm_delete_lead", contextFromAuthInfo(ctx.http?.authInfo), input.leadId, async (c) => {
        const lead = await prisma.lead.findFirst({
          where: { id: input.leadId, deletedAt: null, ...EXCLUDE_NEWSLETTER },
          select: { id: true, firstName: true, lastName: true },
        });
        if (!lead) throw new ToolError("not_found", "Lead not found.");
        if (!nameMatches(input.confirmName, lead.firstName, lead.lastName)) {
          throw new ToolError("validation", "confirmName does not match this lead's name — re-read it with crm_get_lead and pass it exactly.");
        }
        await trashLead({ userId: c.userId, userName: c.userName }, lead.id, { reason: input.reason, via: "mcp" });
        const restorableUntil = new Date(Date.now() + TRASH_RETENTION_DAYS * 86_400_000);
        return { trashed: true, leadId: lead.id, restorableUntil: fmtDate(restorableUntil) };
      }),
  );
}
