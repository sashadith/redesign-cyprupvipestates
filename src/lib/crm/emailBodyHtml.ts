// Shared plain-text-body-to-HTML renderer for lead-facing emails — extracted
// from emailActions.ts so the booking confirmation email (which isn't a
// server action itself, and can't import a plain helper out of a "use
// server" file) can reuse the exact same font styling instead of risking a
// second, drifting copy of it.

// Inline font styles (not a <style> block or CSS class) — mail clients strip
// or ignore external/head-level CSS unreliably, inline is the only style that
// reliably survives. Matches the signature block's own font-size/family
// exactly (2026-07-25 fix — body was rendering at the client's unstyled
// default, ~12px, next to the signature's 14px) so both read as one piece.
export const BODY_FONT_STYLE = "font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;";

// `locale` drives the ONE thing that differs for Hebrew: text direction.
// Three of the four client-facing e-mails go through this helper — the
// booking confirmation (bookingActions.ts), the presentation e-mail
// (renderLeadEmail.ts) and every model-composed CRM reply (sendLeadEmail.ts)
// — and all three used to ship a direction-less <div>. Gmail does NOT infer
// direction from content, so Hebrew rendered flush-left with the punctuation
// flipped to the wrong end (Pass B, Must fix #1). `dir` sits on the block
// itself, not on <html>/<body>: Gmail, Yahoo and Outlook.com strip those two
// tags and re-host the rest inside their own LTR container (Must fix #2).
// Omitting `locale`, or any LTR locale, yields byte-identical HTML to before.
export const bodyToHtml = (body: string, locale?: string) => {
  const rtl = locale === "he";
  const dirAttr = rtl ? ` dir="rtl"` : "";
  const align = rtl ? "text-align:right;" : "";
  return `<div${dirAttr} style="${BODY_FONT_STYLE}white-space:pre-wrap;${align}">${body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</div>`;
};

// The visible gap before the signature block — an explicit spacer, not a
// trailing newline in the body text (server actions .trim() the body before
// rendering, which would silently eat a trailing newline).
export const SIGNATURE_SPACER = `<div style="height:16px;line-height:16px;font-size:1px;">&nbsp;</div>`;
