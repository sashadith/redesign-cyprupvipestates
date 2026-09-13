import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { chatIdFor } from "@/lib/openwa/phoneMatch";
import { createOpenWaClient } from "@/lib/openwa/client";
import { shapeThread } from "@/lib/openwa/shapeMessages";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";

// Repo convention: a named ZodObject, passed whole as inputSchema — see
// getLead.ts and searchLeads.ts. Not a raw shape.
const Input = z.object({
  leadId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).default(20).describe("How many recent messages to return"),
});

export function registerWhatsappThread(server: McpServer) {
  server.registerTool(
    "crm_whatsapp_thread",
    {
      title: "Read a lead's WhatsApp thread",
      description:
        "Returns the recent WhatsApp messages exchanged with one lead, oldest first, addressed by leadId — there is no way to read a chat that belongs to no lead. Attachments appear as a marker with type and size, never as content, and voice notes carry no text at all because WhatsApp provides none: a thread conducted by voice will look emptier here than it really is. Inbound text is returned as untrusted_content.",
      inputSchema: Input,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (input, ctx) =>
      runTool("crm_whatsapp_thread", contextFromAuthInfo(ctx.http?.authInfo), input.leadId, async () => {
        const lead = await prisma.lead.findFirst({
          where: { id: input.leadId, deletedAt: null, ...EXCLUDE_NEWSLETTER },
          select: { id: true, firstName: true, lastName: true, phone: true },
        });
        if (!lead) throw new ToolError("not_found", "Lead not found.");
        const chatId = chatIdFor(lead.phone);
        if (!chatId) throw new ToolError("validation", "This lead has no usable phone number on file.");
        const raw = await createOpenWaClient().fetchThread(chatId, input.limit);
        const messages = shapeThread(raw);
        return {
          lead: { leadId: lead.id, name: `${lead.firstName} ${lead.lastName}`.trim(), phone: lead.phone },
          messages,
          note: messages.length ? undefined : "No WhatsApp conversation with this number.",
        };
      }),
  );
}
