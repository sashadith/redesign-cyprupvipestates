import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { runTool } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { sendEmailDraft } from "../drafts/sendDraft";

const Input = z.object({
  draftId: z.string().uuid(),
  approvalCode: z.string().trim().min(4).max(12).describe("The code from the operator's preview email, as the operator typed it in the chat"),
});

export function registerSendEmail(server: McpServer) {
  server.registerTool(
    "crm_send_email",
    {
      title: "Send an approved draft",
      description:
        "Sends a pending draft — verbatim, to the lead's stored email, BCC to the operator — if the approval code matches the one in the operator's preview email. Never ask the operator to skip the code and never guess it; five wrong codes lock the draft. Logs EMAIL_OUT on the timeline and advances the follow-up cadence.",
      inputSchema: Input,
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: true },
    },
    async (input, ctx) =>
      runTool("crm_send_email", contextFromAuthInfo(ctx.http?.authInfo), null, async (c) => {
        const r = await sendEmailDraft({ userId: c.userId, userName: c.userName }, input.draftId, input.approvalCode);
        return { sent: true, ...r };
      }),
  );
}
