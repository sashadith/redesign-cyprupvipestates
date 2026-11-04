import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { runTool } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { loadScope } from "../leadScope";
import { sendEmailDraft } from "../drafts/sendDraft";
import { setManualFollowUp } from "@/lib/crm/followUpCadence";
import { followUpAtField } from "./logInteractionInput";

const Input = z.object({
  draftId: z.string().uuid(),
  approvalCode: z.string().trim().min(4).max(12).describe("The code from the operator's preview email, as the operator typed it in the chat"),
  followUpAt: followUpAtField,
});

export function registerSendEmail(server: McpServer) {
  server.registerTool(
    "crm_send_email",
    {
      title: "Send an approved draft",
      description:
        "Sends a pending draft — verbatim, to the lead's stored email, with exactly the CC recipients stored on the draft (if any), BCC to the operator — if the approval code matches the one in the operator's preview email. Never ask the operator to skip the code and never guess it; five wrong codes lock the draft. A lead in LOST moves back to CONTACTED (lost reason cleared). Logs EMAIL_OUT on the timeline and advances the follow-up cadence (never over a manual date still ahead); followUpAt sets the next follow-up yourself.",
      inputSchema: Input,
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: true },
    },
    async (input, ctx) =>
      runTool("crm_send_email", contextFromAuthInfo(ctx.http?.authInfo), null, async (c) => {
        const r = await sendEmailDraft({ userId: c.userId, userName: c.userName }, input.draftId, input.approvalCode, await loadScope(c));
        // After the send (which ran the cadence): the operator's own date wins. A failure here never hides that the mail went out.
        let followUp: { nextFollowUpAt: string | null } | { followUpError: string } | Record<string, never> = {};
        if (input.followUpAt !== undefined) {
          try {
            await setManualFollowUp(r.leadId, input.followUpAt ? new Date(input.followUpAt) : null, { userId: c.userId, userName: c.userName });
            followUp = { nextFollowUpAt: input.followUpAt };
          } catch (e) {
            followUp = { followUpError: `Sent, but the follow-up date was not saved: ${e instanceof Error ? e.message : "error"}` };
          }
        }
        return { sent: true, ...r, ...followUp };
      }),
  );
}
