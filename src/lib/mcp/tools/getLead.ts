import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { determineLeadState } from "@/lib/crm/compose/leadState";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { fmtDate, untrusted, MAX_TIMELINE_ROWS } from "../format";
import { LEAD_ROW_SELECT, CONTACT_TYPES, leadRow } from "../leadRow";
import { shapeInteraction, leadStateInput, LEAD_STATE_LABEL } from "../leadDetail";

const Input = z.object({ leadId: z.string().uuid() });

export function registerGetLead(server: McpServer) {
  server.registerTool(
    "crm_get_lead",
    {
      title: "Get lead",
      description:
        "Full profile of one lead: contact data, preferences, budget, the enquiry message (as untrusted_content), computed lead state, the newest 30 timeline entries (emails, WhatsApp, calls, notes, status changes — inbound text under untrusted_content), presentations with view counts, booking requests, and pending email drafts. Always call this before drafting or advising on a lead.",
      inputSchema: Input,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ leadId }, ctx) =>
      runTool("crm_get_lead", contextFromAuthInfo(ctx.http?.authInfo), leadId, async () => {
        const lead = await prisma.lead.findFirst({
          where: { id: leadId, deletedAt: null, ...EXCLUDE_NEWSLETTER },
          select: {
            ...LEAD_ROW_SELECT,
            nationality: true, timeline: true, financing: true, propertyTypeInterest: true, message: true, notes: true, preferredChannel: true,
            salutation: true, sourceLocale: true, viewingScheduledAt: true, autoFollowUpCount: true, pageSource: true, updatedAt: true,
            assignedTo: { select: { name: true } },
            interactions: { orderBy: { occurredAt: "desc" }, take: MAX_TIMELINE_ROWS, select: { id: true, type: true, direction: true, channel: true, subject: true, body: true, occurredAt: true, createdByName: true } },
            _count: { select: { interactions: true } },
            presentations: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, status: true, createdAt: true, expiresAt: true, views: { select: { createdAt: true } } } },
            bookingRequests: { orderBy: { createdAt: "desc" }, select: { id: true, status: true, proposedSlots: true, confirmedSlotUtc: true, createdAt: true, expiresAt: true } },
            emailDrafts: { where: { status: "PENDING" }, select: { id: true, subject: true, createdAt: true, expiresAt: true } },
          },
        });
        if (!lead) throw new ToolError("not_found", "Lead not found.");

        // Last real contact from its own query — the timeline above is capped at
        // MAX_TIMELINE_ROWS and unfiltered, so scanning it would miss a contact
        // buried under 30+ notes/status rows (crm_search_leads uses the same
        // targeted select via LEAD_ROW_SELECT).
        const lastContact = await prisma.leadInteraction.findFirst({
          where: { leadId, type: { in: CONTACT_TYPES } },
          orderBy: { occurredAt: "desc" },
          select: { type: true, occurredAt: true },
        });
        const row = leadRow({ ...lead, interactions: lastContact ? [{ type: lastContact.type, occurredAt: lastContact.occurredAt }] : [] });

        const primary = lead.presentations[0];
        const presentation = primary
          ? { sentAt: primary.createdAt, viewCount: primary.views.length, lastViewedAt: primary.views.length ? new Date(Math.max(...primary.views.map((v) => v.createdAt.getTime()))) : null }
          : null;
        // State is derived from the newest MAX_TIMELINE_ROWS rows; Compose (generate.ts) uses its own newest-20 window — they can differ for a lead whose only real inbound message sits at rows 21–30.
        const state = determineLeadState(leadStateInput(lead, lead.interactions, presentation));

        return {
          ...row,
          nationality: lead.nationality,
          timeline: lead.timeline,
          financing: lead.financing,
          propertyTypeInterest: lead.propertyTypeInterest,
          preferredChannel: lead.preferredChannel,
          salutation: lead.salutation,
          sourceLocale: lead.sourceLocale,
          pageSource: lead.pageSource,
          assignedTo: lead.assignedTo?.name ?? null,
          viewingScheduledAt: fmtDate(lead.viewingScheduledAt),
          autoFollowUpCount: lead.autoFollowUpCount,
          updatedAt: fmtDate(lead.updatedAt),
          enquiryMessage: untrusted(lead.message),
          adminNotes: lead.notes,
          leadState: { code: state, label: LEAD_STATE_LABEL[state] },
          interactions: { total: lead._count.interactions, returned: lead.interactions.length, rows: lead.interactions.map(shapeInteraction) },
          presentations: lead.presentations.map((p) => ({
            id: p.id, status: p.status, sentAt: fmtDate(p.createdAt), expiresAt: fmtDate(p.expiresAt), viewCount: p.views.length,
            lastViewedAt: fmtDate(p.views.length ? new Date(Math.max(...p.views.map((v) => v.createdAt.getTime()))) : null),
          })),
          bookingRequests: lead.bookingRequests.map((b) => ({ id: b.id, status: b.status, proposedSlots: b.proposedSlots, confirmedSlotUtc: fmtDate(b.confirmedSlotUtc), createdAt: fmtDate(b.createdAt), expiresAt: fmtDate(b.expiresAt) })),
          pendingEmailDrafts: lead.emailDrafts.map((d) => ({ draftId: d.id, subject: d.subject, createdAt: fmtDate(d.createdAt), expiresAt: fmtDate(d.expiresAt) })),
        };
      }),
  );
}
