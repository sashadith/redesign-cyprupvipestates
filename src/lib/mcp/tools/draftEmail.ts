import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { runTool } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { fmtDate } from "../format";
import { createEmailDraft } from "../drafts/createDraft";

const Input = z.object({
  leadId: z.string().uuid(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(8000).describe("Plain text; blank lines separate paragraphs. No greeting/closing tricks — write the full email body. The operator's signature is appended automatically."),
});

export function registerDraftEmail(server: McpServer) {
  server.registerTool(
    "crm_draft_email",
    {
      title: "Draft an email to a lead (needs approval)",
      description:
        "Stores an email draft for a lead and emails a preview — rendered exactly as the lead would receive it, with an approval code — to the operator's own mailbox. Nothing reaches the lead. The operator replies in the chat with the code (e.g. “Freigabe 7K3PQ2”); only then can crm_send_email send it. A new draft for the same lead supersedes the pending one. Drafts expire after 24 hours.",
      inputSchema: Input,
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
    },
    async (input, ctx) =>
      runTool("crm_draft_email", contextFromAuthInfo(ctx.http?.authInfo), input.leadId, async (c) => {
        const r = await createEmailDraft({ userId: c.userId, userName: c.userName }, input);
        return {
          draftId: r.draftId,
          previewSentTo: r.previewSentTo,
          expiresAt: fmtDate(r.expiresAt),
          supersededDraftId: r.supersededDraftId,
          next: "Ask the operator to check the preview email and reply with the approval code; then call crm_send_email with draftId and that code.",
        };
      }),
  );
}
