import type { McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import { createLeadRecord, findDuplicateLead } from "@/lib/crm/createLead";
import { fullName } from "@/lib/crm/leadIdentity";
import { runTool } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { LEAD_ROW_SELECT, leadRow } from "../leadRow";
import { CreateLeadInput } from "./createLeadInput";

export function registerCreateLead(server: McpServer) {
  server.registerTool(
    "crm_create_lead",
    {
      title: "Create a lead",
      description:
        "Creates a lead exactly as the admin's \"New lead\" form does — source MANUAL, assigned to the operator, with the same CREATED activity and timeline rows, marked as created via Claude. Only on the operator's explicit instruction. Before creating, it looks for an active lead with the same email (Gmail dots/domain ignored) or phone number: if one exists it is returned under `existing` and nothing is created unless `allowDuplicate` is true — tell the operator and let them decide.",
      inputSchema: CreateLeadInput,
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
    },
    async (input, ctx) =>
      runTool("crm_create_lead", contextFromAuthInfo(ctx.http?.authInfo), null, async (c) => {
        const duplicate = await findDuplicateLead(input.email, input.phone);
        if (duplicate && !input.allowDuplicate) {
          const existing = await prisma.lead.findUniqueOrThrow({ where: { id: duplicate.id }, select: LEAD_ROW_SELECT });
          return {
            created: false,
            reason: `An active lead with the same ${duplicate.matchedOn} already exists: ${fullName(duplicate.firstName, duplicate.lastName)}.`,
            existing: leadRow(existing),
          };
        }
        const { allowDuplicate: _ignored, ...data } = input;
        const { id } = await createLeadRecord({ userId: c.userId, userName: c.userName }, { ...data, assignedToId: c.userId, via: "mcp" });
        const fresh = await prisma.lead.findUniqueOrThrow({ where: { id }, select: LEAD_ROW_SELECT });
        return { created: true, lead: leadRow(fresh), ...(duplicate ? { duplicateOf: duplicate.id } : {}) };
      }),
  );
}
