// Strips quoted reply history from an inbound email so the LeadInteraction
// timeline entry shows the new message, not the whole thread underneath it.
// Doesn't need to be perfect (per spec) — covers the concrete client/
// language mix this business actually gets replies in.

// Client mail apps wrap quoted content in a <blockquote> almost universally
// (Gmail: class="gmail_quote", Apple Mail: type="cite", Outlook web:
// similar) — stripping at the HTML level, before any text conversion,
// removes the bulk of it in one shot regardless of language.
export function stripHtmlBlockquotes(html: string): string {
  return html.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "");
}

// First line of the "reply header" a client inserts right before quoting —
// covers the phrasings this business's leads actually reply in (en/de/pl/ru)
// plus the generic Outlook "-----Original Message-----" block. Everything
// from the first match onward is cut.
const QUOTE_HEADER_PATTERNS: RegExp[] = [
  /^On .{0,120}wrote:\s*$/im, // English (Gmail/Apple Mail/Outlook): "On Wed, Jul 23, 2026 ... wrote:"
  /^Am .{0,120}schrieb.{0,80}:\s*$/im, // German (Apple Mail/Outlook): "Am 23.07.2026 um 15:14 schrieb ...:"
  /^W dniu .{0,120}(napisał|napisała)[\s\S]{0,80}:\s*$/im, // Polish
  /^.{0,120}(писал|написал)(а)?:\s*$/im, // Russian
  /^-{2,}\s*Original Message\s*-{2,}\s*$/im, // Generic Outlook plain-text
  /^From:\s.{0,200}$\n^Sent:\s.{0,200}$/im, // Outlook plain-text header block start
];

/** Cuts everything from the first recognized quote-header line onward, then trims trailing ">"-quoted lines. */
export function stripQuotedReply(text: string): string {
  let cut = text;
  for (const pattern of QUOTE_HEADER_PATTERNS) {
    const match = cut.match(pattern);
    if (match && match.index != null) {
      cut = cut.slice(0, match.index);
      break; // first match wins — don't keep scanning once we've found the boundary
    }
  }

  // Once a ">"-quoted line appears, standard top-posting reply style means
  // everything below it is quoted history too — cut from the first such
  // line onward, covering plain-text quoting with no recognized header line
  // above it.
  const lines = cut.split(/\r?\n/);
  const firstQuoteLine = lines.findIndex((l) => /^\s*>/.test(l));
  const kept = firstQuoteLine === -1 ? lines : lines.slice(0, firstQuoteLine);

  return kept.join("\n").trim();
}
