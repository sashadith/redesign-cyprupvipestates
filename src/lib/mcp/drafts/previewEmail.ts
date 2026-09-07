// The preview the operator receives in their own mailbox: a grey header box
// (recipient, approval code, how to approve) above the email rendered EXACTLY
// as the lead would get it. The header is never part of the stored body.
import { renderLeadEmail } from "@/lib/crm/renderLeadEmail";
import { BODY_FONT_STYLE } from "@/lib/crm/emailBodyHtml";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildPreviewEmail(input: {
  leadName: string; leadEmail: string; subject: string; body: string; signatureHtml: string; approvalCode: string; expiresAtLabel: string;
}): { subject: string; html: string; text: string } {
  const rendered = renderLeadEmail(input.body, input.signatureHtml);
  const header =
    `<div style="${BODY_FONT_STYLE}background:#F3F4F6;border:1px solid #E5E7EB;border-radius:6px;padding:12px 14px;margin-bottom:20px;">` +
    `<div><strong>Draft for ${esc(input.leadName)}</strong> · To: ${esc(input.leadEmail)}</div>` +
    `<div style="margin-top:6px;">Approval code: <strong>${esc(input.approvalCode)}</strong> · Expires ${esc(input.expiresAtLabel)} Cyprus</div>` +
    `<div style="margin-top:6px;color:#6B7280;">Reply in the CVE LEADS chat with "Freigabe ${esc(input.approvalCode)}" to send it exactly as shown below, or tell Claude what to change.</div>` +
    `</div>`;
  const textHeader =
    `DRAFT for ${input.leadName} · To: ${input.leadEmail}\nApproval code: ${input.approvalCode} · Expires ${input.expiresAtLabel} Cyprus\n` +
    `Reply in the CVE LEADS chat with "Freigabe ${input.approvalCode}" to send, or tell Claude what to change.\n\n------------------------------\n\n`;
  return {
    subject: `[DRAFT · code ${input.approvalCode}] ${input.subject}`,
    html: `${header}${rendered.html}`,
    text: `${textHeader}${rendered.text}`,
  };
}
