// The one HTML/text rendering for a lead-facing email body — used by the
// admin send, the MCP send and the MCP preview, so what the operator
// previews is byte-for-byte what the lead receives.
import { bodyToHtml, SIGNATURE_SPACER } from "./emailBodyHtml";
import { stripHtmlToText } from "@/lib/emailSignature/sanitize";

export function renderLeadEmail(body: string, signatureHtml: string): { html: string; text: string } {
  const html = `${bodyToHtml(body)}${SIGNATURE_SPACER}${signatureHtml}`;
  return { html, text: stripHtmlToText(html) };
}
