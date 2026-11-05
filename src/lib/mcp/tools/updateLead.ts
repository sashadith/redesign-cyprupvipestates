import type { McpServer } from "@modelcontextprotocol/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { applyLeadStatusChange, standaloneLostReason } from "@/lib/crm/updateLeadStatus";
import { LOST_REASONS } from "@/lib/crm/leadStatus";
import { findDuplicateLead } from "@/lib/crm/createLead";
import { manualFollowUpData } from "@/lib/crm/followUpRule";
import { emailEditData } from "@/lib/crm/leadHints";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { assertCanEdit, loadScope } from "../leadScope";
import { LEAD_ROW_SELECT, leadRow } from "../leadRow";
import { UpdateLeadInput, normalizedEmail, unknownFields, unknownFieldsMessage } from "./updateLeadInput";
import { assignOwnerViaMcp, moveBucketViaMcp, resolveOwner } from "./updateLeadOwner";

// Name and phone stay cockpit-only. Email (2026-11-04), owner and bucket can be changed here; any
// other key is refused with the list of supported fields instead of being dropped.
export function registerUpdateLead(server: McpServer) {
  server.registerTool(
    "crm_update_lead",
    {
      title: "Update a lead",
      description:
        "Changes status (with the same timeline rows as the admin dropdown), follow-up date, hot flag, preferred channel, language, salutation, budget, timeline, financing, admin notes, time zone, email address, owner (assignedTo: an employee's name or id, admins only) or bucket (leads/partner). Pass only the fields to change; null clears a nullable field. A status of VIEWING_SCHEDULED requires viewingScheduledAt. Name and phone are changed in the cockpit, not here; an unsupported field is an error. Setting status LOST requires lostReason (BUDGET, BOUGHT_ELSEWHERE, UNREACHABLE, NO_RESPONSE, NOT_INTERESTED, TIMING, INVALID, OTHER); NO_RESPONSE = contacted but never answered.",
      inputSchema: UpdateLeadInput,
      annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: false },
    },
    async (input, ctx) =>
      runTool("crm_update_lead", contextFromAuthInfo(ctx.http?.authInfo), input.leadId, async (c) => {
        const unknown = unknownFields(input);
        if (unknown.length) throw new ToolError("validation", unknownFieldsMessage(unknown));
        const { user, where: scope } = await loadScope(c);
        const lead = await prisma.lead.findFirst({ where: { id: input.leadId, deletedAt: null, ...EXCLUDE_NEWSLETTER, ...scope }, select: { id: true, status: true, hotAt: true, assignedToId: true, workedByPartner: true, email: true, phone: true } });
        if (!lead) throw new ToolError("not_found", "Lead not found.");
        assertCanEdit(user, lead);
        if (input.lostReason && input.status !== "LOST") {
          throw new ToolError("validation", "lostReason is only allowed together with status LOST");
        }
        if (input.status === "LOST" && input.status !== lead.status && !input.lostReason) {
          throw new ToolError("validation", `Setting status LOST needs a lostReason (${LOST_REASONS.join(", ")}).`);
        }
        if (input.status === "VIEWING_SCHEDULED" && input.status !== lead.status && !input.viewingScheduledAt) {
          throw new ToolError("validation", "viewingScheduledAt is required when setting status VIEWING_SCHEDULED.");
        }
        const email = normalizedEmail(input.email);
        if (email !== undefined && email !== lead.email) {
          if (!email && !lead.phone) throw new ToolError("validation", "The lead has no phone number, so the email address cannot be removed.");
          if (email) {
            const dup = await findDuplicateLead(email, null);
            if (dup && dup.id !== lead.id) throw new ToolError("validation", `Another lead already uses ${email}. Merge or fix that lead first.`);
          }
        }
        const owner = input.assignedTo !== undefined ? await resolveOwner(user, input.assignedTo) : undefined;
        const actor = { userId: c.userId, userName: c.userName };
        const changed: string[] = [];

        if (input.status && input.status !== lead.status) {
          await applyLeadStatusChange(actor, input.leadId, input.status, {
            via: "mcp",
            lostReason: input.lostReason,
            ...(input.viewingScheduledAt !== undefined ? { viewingScheduledAt: input.viewingScheduledAt ? new Date(input.viewingScheduledAt) : null } : {}),
          });
          changed.push("status");
          if (input.viewingScheduledAt !== undefined) changed.push("viewingScheduledAt");
        }

        const data: Prisma.LeadUpdateInput = {};
        const set = <K extends keyof Prisma.LeadUpdateInput>(key: K, value: Prisma.LeadUpdateInput[K], name: string) => { data[key] = value; changed.push(name); };
        const reasonOnly = standaloneLostReason(lead.status, input.status, input.lostReason);
        if (reasonOnly) set("lostReason", reasonOnly, "lostReason");
        if (input.viewingScheduledAt !== undefined && !(input.status && input.status !== lead.status)) set("viewingScheduledAt", input.viewingScheduledAt ? new Date(input.viewingScheduledAt) : null, "viewingScheduledAt");
        if (input.nextFollowUpAt !== undefined) {
          const at = input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null;
          set("nextFollowUpAt", at, "nextFollowUpAt");
          data.followUpManual = manualFollowUpData(at).followUpManual;
        }
        if (input.hot !== undefined && input.hot !== (lead.hotAt != null)) set("hotAt", input.hot ? new Date() : null, "hot");
        if (input.preferredChannel !== undefined) set("preferredChannel", input.preferredChannel, "preferredChannel");
        if (input.languagePreference !== undefined) set("languagePreference", input.languagePreference, "languagePreference");
        if (input.salutation !== undefined) set("salutation", input.salutation, "salutation");
        if (input.budgetMin !== undefined) set("budgetMin", input.budgetMin, "budgetMin");
        if (input.budgetMax !== undefined) set("budgetMax", input.budgetMax, "budgetMax");
        if (input.timeline !== undefined) set("timeline", input.timeline, "timeline");
        if (input.financing !== undefined) set("financing", input.financing, "financing");
        if (input.notes !== undefined) set("notes", input.notes?.trim() || null, "notes");
        if (input.timeZone !== undefined) set("timeZone", input.timeZone, "timeZone");
        if (email !== undefined && email !== lead.email) {
          set("email", email, "email");
          Object.assign(data, emailEditData(lead.email, email));
        }

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
        // Owner and bucket go through the same writers as the CRM (their own timeline rows, Telegram for an assignment).
        if (owner !== undefined && (await assignOwnerViaMcp(user, c, lead, owner))) changed.push("assignedTo");
        if (input.bucket !== undefined && (await moveBucketViaMcp(c, lead.id, input.bucket))) changed.push("bucket");

        if (!changed.length) return { changed: [], note: "Nothing to change — every given value already matched." };

        const fresh = await prisma.lead.findUniqueOrThrow({ where: { id: input.leadId }, select: LEAD_ROW_SELECT });
        return { changed, lead: leadRow(fresh) };
      }),
  );
}
