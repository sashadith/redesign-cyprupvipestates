import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { LeadInteractionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { crmRules } from "@/lib/actionCenter/rules/crm";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { LAST_CONTACT_TYPES } from "@/app/admin/(panel)/crm/leadListShared";
import { runTool } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
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
        "Leads that need attention right now, most urgent first — the same follow-up rules as the admin Action Center (never contacted, stale >7 days, viewing without follow-up, due nextFollowUpAt). Call this first in a session. Also returns the count of new leads in the last 7 days.",
      inputSchema: Input,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ limit }, ctx) =>
      runTool("crm_worklist", contextFromAuthInfo(ctx.http?.authInfo), null, async () => {
        const items = await crmRules();
        const { leadFollowups, presentationIds } = mapWorklistItems(items);
        const leadIds = leadFollowups.slice(0, limit).map((f) => f.leadId);
        const [leads, presentations, newLeadsLast7Days, dueFollowUps] = await Promise.all([
          prisma.lead.findMany({
            where: { id: { in: leadIds }, deletedAt: null, ...EXCLUDE_NEWSLETTER },
            select: {
              id: true, firstName: true, lastName: true, status: true, hotAt: true, nextFollowUpAt: true, languagePreference: true,
              interactions: { where: { type: { in: CONTACT_TYPES } }, orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true, type: true } },
            },
          }),
          prisma.clientPresentation.findMany({
            where: { id: { in: presentationIds }, lead: { deletedAt: null, ...EXCLUDE_NEWSLETTER } },
            select: { id: true, leadId: true, createdAt: true, expiresAt: true, lead: { select: { firstName: true, lastName: true } }, _count: { select: { views: true } } },
            orderBy: { createdAt: "desc" },
            take: limit,
          }),
          prisma.lead.count({ where: { deletedAt: null, ...EXCLUDE_NEWSLETTER, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
          prisma.lead.findMany({
            where: { deletedAt: null, ...EXCLUDE_NEWSLETTER, nextFollowUpAt: { lte: new Date() }, status: { notIn: ["CLOSED", "LOST"] } },
            select: { id: true, firstName: true, lastName: true, status: true, nextFollowUpAt: true },
            orderBy: { nextFollowUpAt: "asc" },
            take: limit,
          }),
        ]);
        const byId = new Map(leads.map((l) => [l.id, l]));
        return {
          followUps: leadFollowups
            .filter((f) => byId.has(f.leadId))
            .slice(0, limit)
            .map((f) => {
              const l = byId.get(f.leadId)!;
              return {
                leadId: f.leadId, name: `${l.firstName} ${l.lastName}`.trim(), severity: f.severity, reason: f.title, detail: f.description,
                status: l.status, language: l.languagePreference, hotSince: fmtDate(l.hotAt), nextFollowUpAt: fmtDate(l.nextFollowUpAt),
                lastContact: l.interactions[0] ? { type: l.interactions[0].type, at: fmtDate(l.interactions[0].occurredAt) } : null,
                waitingSince: fmtDate(f.since),
              };
            }),
          dueFollowUps: dueFollowUps.map((l) => ({ leadId: l.id, name: `${l.firstName} ${l.lastName}`.trim(), status: l.status, dueAt: fmtDate(l.nextFollowUpAt) })),
          engagedPresentations: presentations.map((p) => ({
            leadId: p.leadId, name: `${p.lead.firstName} ${p.lead.lastName}`.trim(), presentationId: p.id, views: p._count.views, sentAt: fmtDate(p.createdAt), expiresAt: fmtDate(p.expiresAt),
          })),
          newLeadsLast7Days,
          totalFollowUpItems: leadFollowups.length,
        };
      }),
  );
}
