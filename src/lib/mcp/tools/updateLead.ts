import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { applyLeadStatusChange, LEAD_STATUSES } from "@/lib/crm/updateLeadStatus";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { LEAD_ROW_SELECT, leadRow } from "../leadRow";

const isoOrNull = z.string().datetime().nullable().optional();

const Input = z.object({
  leadId: z.string().uuid(),
  status: z.enum([...LEAD_STATUSES]).optional(),
  viewingScheduledAt: isoOrNull.describe("Required when status becomes VIEWING_SCHEDULED; the appointment date/time"),
  nextFollowUpAt: isoOrNull,
  hot: z.boolean().optional(),
  preferredChannel: z.enum(["EMAIL", "WHATSAPP", "PHONE"]).nullable().optional(),
  languagePreference: z.enum(["en", "de", "pl", "ru"]).nullable().optional(),
  salutation: z.enum(["UNKNOWN", "MR", "MS"]).optional(),
  budgetMin: z.number().int().nonnegative().nullable().optional(),
  budgetMax: z.number().int().nonnegative().nullable().optional(),
  timeline: z.enum(["IMMEDIATE", "THREE_MONTHS", "SIX_MONTHS", "ONE_YEAR", "TWO_YEARS", "JUST_LOOKING"]).nullable().optional(),
  financing: z.enum(["CASH", "MORTGAGE", "UNDECIDED"]).nullable().optional(),
  notes: z.string().max(4000).nullable().optional().describe("Replaces the admin notes field"),
});

// Identity fields (name, email, phone), source/bucket and assignment stay
// admin-only — see the spec's tool table.
export function registerUpdateLead(server: McpServer) {
  server.registerTool(
    "crm_update_lead",
    {
      title: "Update a lead",
      description:
        "Changes status (with the same timeline rows as the admin dropdown), follow-up date, hot flag, preferred channel, language, salutation, budget, timeline, financing or admin notes. Pass only the fields to change; null clears a nullable field. A status of VIEWING_SCHEDULED requires viewingScheduledAt. Does not touch name, email, phone, bucket or assignment.",
      inputSchema: Input,
      annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: false },
    },
    async (input, ctx) =>
      runTool("crm_update_lead", contextFromAuthInfo(ctx.http?.authInfo), input.leadId, async (c) => {
        const lead = await prisma.lead.findFirst({ where: { id: input.leadId, deletedAt: null, ...EXCLUDE_NEWSLETTER }, select: { id: true, status: true, hotAt: true } });
        if (!lead) throw new ToolError("not_found", "Lead not found.");
        if (input.status === "VIEWING_SCHEDULED" && !input.viewingScheduledAt) {
          throw new ToolError("validation", "viewingScheduledAt is required when setting status VIEWING_SCHEDULED.");
        }
        const actor = { userId: c.userId, userName: c.userName };
        const changed: string[] = [];

        if (input.status && input.status !== lead.status) {
          await applyLeadStatusChange(actor, input.leadId, input.status, {
            via: "mcp",
            ...(input.viewingScheduledAt !== undefined ? { viewingScheduledAt: input.viewingScheduledAt ? new Date(input.viewingScheduledAt) : null } : {}),
          });
          changed.push("status");
        }

        const data: Prisma.LeadUpdateInput = {};
        const set = <K extends keyof Prisma.LeadUpdateInput>(key: K, value: Prisma.LeadUpdateInput[K], name: string) => { data[key] = value; changed.push(name); };
        if (input.viewingScheduledAt !== undefined && !(input.status && input.status !== lead.status)) set("viewingScheduledAt", input.viewingScheduledAt ? new Date(input.viewingScheduledAt) : null, "viewingScheduledAt");
        if (input.nextFollowUpAt !== undefined) set("nextFollowUpAt", input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null, "nextFollowUpAt");
        if (input.hot !== undefined && input.hot !== (lead.hotAt != null)) set("hotAt", input.hot ? new Date() : null, "hot");
        if (input.preferredChannel !== undefined) set("preferredChannel", input.preferredChannel, "preferredChannel");
        if (input.languagePreference !== undefined) set("languagePreference", input.languagePreference, "languagePreference");
        if (input.salutation !== undefined) set("salutation", input.salutation, "salutation");
        if (input.budgetMin !== undefined) set("budgetMin", input.budgetMin, "budgetMin");
        if (input.budgetMax !== undefined) set("budgetMax", input.budgetMax, "budgetMax");
        if (input.timeline !== undefined) set("timeline", input.timeline, "timeline");
        if (input.financing !== undefined) set("financing", input.financing, "financing");
        if (input.notes !== undefined) set("notes", input.notes?.trim() || null, "notes");

        if (Object.keys(data).length) {
          await prisma.lead.update({ where: { id: input.leadId }, data });
          // Make Claude's field edits visible in the timeline (the admin's own
          // inline editors write no row for these, but an assistant's edits
          // should be auditable at a glance).
          await prisma.leadInteraction.create({
            data: {
              leadId: input.leadId, type: "SYSTEM", channel: "SYSTEM",
              body: `Lead fields updated by Claude: ${changed.filter((f) => f !== "status").join(", ")}`,
              createdByUserId: c.userId, createdByName: c.userName,
              metadata: { via: "mcp", fields: changed.filter((f) => f !== "status") },
            },
          });
        }
        if (!changed.length) return { changed: [], note: "Nothing to change — every given value already matched." };

        const fresh = await prisma.lead.findUniqueOrThrow({ where: { id: input.leadId }, select: LEAD_ROW_SELECT });
        return { changed, lead: leadRow(fresh) };
      }),
  );
}
