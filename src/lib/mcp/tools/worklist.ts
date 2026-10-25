import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { LeadInteractionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { crmRules } from "@/lib/actionCenter/rules/crm";
import { filterSnoozed } from "@/lib/actionCenter/snooze";
import { EXCLUDE_NEWSLETTER, bucketOf } from "@/lib/crm/leadBucket";
import { seesAllLeads } from "@/lib/crm/access";
import { LAST_CONTACT_TYPES } from "@/app/admin/(panel)/crm/leadListShared";
import { runTool } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { loadScope, withScope } from "../leadScope";
import { fmtDate } from "../format";
import { mapWorklistItems } from "./worklistMap";

const Input = z.object({ limit: z.number().int().min(1).max(50).default(25) });
const CONTACT_TYPES = [...LAST_CONTACT_TYPES] as LeadInteractionType[];

export function registerWorklist(server: McpServer) {
  server.registerTool(
    "crm_worklist",
    {
      title: "Lead worklist",
      description:
        "Leads that need attention right now, most urgent first — the same follow-up rules as the admin Action Center (never contacted, stale >7 days, viewing without follow-up), plus the leads whose nextFollowUpAt is due (this tool's own query, not subject to Action Center snoozes) and the count of new leads in the last 7 days. Leads who only asked for a PDF guide (source GUIDE_DOWNLOAD) are kept apart from buyer leads in `guideLeads` (same shape: followUps + dueFollowUps). Call this first in a session.",
      inputSchema: Input,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ limit }, ctx) =>
      runTool("crm_worklist", contextFromAuthInfo(ctx.http?.authInfo), null, async (c) => {
        const { user, where: scope } = await loadScope(c);
        const items = await filterSnoozed(await crmRules());
        const { leadFollowups, presentationItems } = mapWorklistItems(items);
        // Query leads/presentations for ALL ids (not pre-sliced by limit) — the
        // byId.has filter below can drop ids (deleted/newsletter leads), so
        // slicing before that filter would under-fill the output for no reason.
        const leadIds = leadFollowups.map((f) => f.leadId);
        const presentationIds = presentationItems.map((p) => p.presentationId);
        const [leads, presentations, newLeadsLast7Days, dueFollowUps] = await Promise.all([
          prisma.lead.findMany({
            where: { id: { in: leadIds }, deletedAt: null, ...EXCLUDE_NEWSLETTER, ...scope },
            select: {
              id: true, firstName: true, lastName: true, status: true, source: true, hotAt: true, nextFollowUpAt: true, languagePreference: true,
              interactions: { where: { type: { in: CONTACT_TYPES } }, orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true, type: true } },
            },
          }),
          prisma.clientPresentation.findMany({
            where: { id: { in: presentationIds }, lead: { deletedAt: null, ...EXCLUDE_NEWSLETTER, ...scope } },
            select: { id: true, leadId: true, createdAt: true, expiresAt: true, lead: { select: { firstName: true, lastName: true } }, _count: { select: { views: true } } },
            orderBy: { createdAt: "desc" },
            take: limit,
          }),
          prisma.lead.count({ where: withScope({ deletedAt: null, ...EXCLUDE_NEWSLETTER, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }, scope) }),
          prisma.lead.findMany({
            where: withScope({ deletedAt: null, ...EXCLUDE_NEWSLETTER, nextFollowUpAt: { lte: new Date() }, status: { notIn: ["CLOSED", "LOST"] } }, scope),
            select: { id: true, firstName: true, lastName: true, status: true, source: true, nextFollowUpAt: true },
            orderBy: { nextFollowUpAt: "asc" },
            take: limit,
          }),
        ]);
        const byId = new Map(leads.map((l) => [l.id, l]));
        const presentationItemById = new Map(presentationItems.map((p) => [p.presentationId, p]));
        // Guide leads (2026-10-19) are readers who asked for a PDF, not buyers:
        // reported in their own group so they never crowd the buyer list.
        const isGuide = (source: string) => bucketOf(source) === "guide";
        const toFollowUp = (f: (typeof leadFollowups)[number]) => {
          const l = byId.get(f.leadId)!;
          return {
            leadId: f.leadId, name: `${l.firstName} ${l.lastName}`.trim(), severity: f.severity, reason: f.title, detail: f.description,
            status: l.status, language: l.languagePreference, hotSince: fmtDate(l.hotAt), nextFollowUpAt: fmtDate(l.nextFollowUpAt),
            lastContact: l.interactions[0] ? { type: l.interactions[0].type, at: fmtDate(l.interactions[0].occurredAt) } : null,
            waitingSince: fmtDate(f.since),
          };
        };
        const toDue = (l: (typeof dueFollowUps)[number]) => ({ leadId: l.id, name: `${l.firstName} ${l.lastName}`.trim(), status: l.status, dueAt: fmtDate(l.nextFollowUpAt) });
        const known = leadFollowups.filter((f) => byId.has(f.leadId));
        return {
          followUps: known.filter((f) => !isGuide(byId.get(f.leadId)!.source)).slice(0, limit).map(toFollowUp),
          dueFollowUps: dueFollowUps.filter((l) => !isGuide(l.source)).map(toDue),
          guideLeads: {
            followUps: known.filter((f) => isGuide(byId.get(f.leadId)!.source)).slice(0, limit).map(toFollowUp),
            dueFollowUps: dueFollowUps.filter((l) => isGuide(l.source)).map(toDue),
          },
          presentationItems: presentations.map((p) => {
            const item = presentationItemById.get(p.id);
            return {
              leadId: p.leadId, name: `${p.lead.firstName} ${p.lead.lastName}`.trim(), presentationId: p.id, views: p._count.views, sentAt: fmtDate(p.createdAt), expiresAt: fmtDate(p.expiresAt),
              severity: item?.severity ?? null, reason: item?.reason ?? null, detail: item?.detail ?? null, since: fmtDate(item?.since),
            };
          }),
          newLeadsLast7Days,
          // The Action Center rules run over every lead; a restricted employee
          // counts only the items on leads they can see.
          totalFollowUpItems: seesAllLeads(user) ? leadFollowups.length : leadFollowups.filter((f) => byId.has(f.leadId)).length,
        };
      }),
  );
}
