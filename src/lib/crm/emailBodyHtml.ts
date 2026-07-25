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

export const bodyToHtml = (body: string) =>
  `<div style="${BODY_FONT_STYLE}white-space:pre-wrap;">${body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</div>`;

// The visible gap before the signature block — an explicit spacer, not a
// trailing newline in the body text (server actions .trim() the body before
// rendering, which would silently eat a trailing newline).
export const SIGNATURE_SPACER = `<div style="height:16px;line-height:16px;font-size:1px;">&nbsp;</div>`;
