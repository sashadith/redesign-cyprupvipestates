import sanitizeHtml from "sanitize-html";

export { looksLikeHtml } from "./looksLikeHtml";

// Signature generators (WiseStamp, HubSpot, Gimmio, etc.) export a full HTML
// document — we embed a fragment, so pull out just the body's inner content
// before sanitizing. Regex-based on purpose: these exports are well-formed,
// and a full DOM parser dependency isn't worth it for this one extraction.
export function extractBodyContent(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) return bodyMatch[1];
  return html
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<\/?html[^>]*>/gi, "");
}

const ALLOWED_TAGS = [
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "colgroup", "col",
  "div", "span", "p", "br", "hr", "strong", "b", "em", "i", "u", "a", "img",
  "ul", "ol", "li", "font", "center", "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "sub", "sup", "small",
];

const ALLOWED_ATTRIBUTES = {
  "*": ["style", "align", "valign", "width", "height", "class", "colspan", "rowspan", "border", "cellpadding", "cellspacing", "bgcolor"],
  a: ["href", "target", "rel", "title"],
  img: ["src", "alt", "width", "height", "style"],
  font: ["face", "color", "size"],
};

// Signature-appropriate sanitization: keeps the table layouts, inline styles,
// images, and links these signatures are built from, while stripping
// <script>/<iframe> (simply not in ALLOWED_TAGS), event handlers (not in
// ALLOWED_ATTRIBUTES so sanitize-html drops any on* attribute outright), and
// javascript: URLs (not in allowedSchemes).
export function sanitizeSignatureHtml(html: string): string {
  const body = extractBodyContent(html);
  return sanitizeHtml(body, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
  }).trim();
}

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
};

// Good-enough text/plain fallback for a signature/body that only ever needs
// to be readable, not byte-perfect — used for the multipart test email today
// and any future plain-text mail part.
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<(br|\/p|\/div|\/tr|\/li)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITY_MAP[m.toLowerCase()] ?? m)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
