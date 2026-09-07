import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import { runTool } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { fmtDate, truncateText } from "../format";

const Input = z.object({
  leadId: z.string().uuid().optional(),
  status: z.enum(["PENDING", "SENT", "SUPERSEDED", "EXPIRED", "LOCKED"]).default("PENDING"),
});

export function registerListDrafts(server: McpServer) {
  server.registerTool(
    "crm_list_drafts",
    {
      title: "List email drafts",
      description: "The operator's email drafts (pending by default) — id, lead, subject, status, created, expires, failed attempts. The body is included only when leadId is given. Never returns the approval code. Use it after a chat pause to see what still awaits approval.",
      inputSchema: Input,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (input, ctx) =>
      runTool("crm_list_drafts", contextFromAuthInfo(ctx.http?.authInfo), input.leadId ?? null, async (c) => {
        const rows = await prisma.leadEmailDraft.findMany({
          where: { userId: c.userId, status: input.status, ...(input.leadId ? { leadId: input.leadId } : {}), lead: { deletedAt: null } },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, leadId: true, subject: true, body: true, status: true, failedAttempts: true, createdAt: true, expiresAt: true, sentAt: true, lead: { select: { firstName: true, lastName: true } } },
        });
        return {
          drafts: rows.map((d) => ({
            draftId: d.id, leadId: d.leadId, leadName: `${d.lead.firstName} ${d.lead.lastName}`.trim(), subject: d.subject, status: d.status,
            failedAttempts: d.failedAttempts, createdAt: fmtDate(d.createdAt), expiresAt: fmtDate(d.expiresAt), sentAt: fmtDate(d.sentAt),
            ...(input.leadId ? { body: truncateText(d.body)?.text ?? null } : {}),
          })),
        };
      }),
  );
}
