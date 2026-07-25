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
  /^From:\s.{0,200}$\n^Sent:\s.{0,200}$/im, // Outlook plain-text header block start (English)
  /^Von:\s.{0,200}$\n^Gesendet:\s.{0,200}$/im, // Outlook plain-text header block start (German)
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

// --- Signature stripping ---------------------------------------------------
// Real replies don't reliably use the standard "-- " signature delimiter
// (RFC 3676) — most mail clients (Gmail, Apple Mail, Outlook web) just
// append the signature straight after the typed reply with no marker at all
// (confirmed against a real reply 2026-07-25: no delimiter, signature glued
// directly onto the last typed line). So beyond honoring "-- " when it IS
// present, the main heuristic is: find the last valediction-looking line
// ("Best regards," / "Mit freundlichen Grüßen," / ...), let the following
// 1-2 short lines through as the closing name/role (e.g. "Sascha Dith" /
// "CEO"), then check whether everything after THAT is contact data (URLs,
// phone numbers, social links) rather than prose. Only cut if it clearly is.
// Deliberately conservative: no recognizable valediction, or what follows it
// doesn't look like contact data → leave the text untouched. Losing a
// sentence of the lead's actual reply is worse than leaving a stray
// signature line in the timeline.

const SIGNATURE_DELIMITER_RE = /^-- ?$/m; // RFC 3676 standard delimiter, when present

const VALEDICTION_LINE_PATTERNS: RegExp[] = [
  /^(best regards|kind regards|warm regards|regards|sincerely|cheers|thanks|thank you)[,.]?\s*$/i, // English
  /^(mit freundlichen grüßen|viele grüße|beste grüße|freundliche grüße|liebe grüße)[,.]?\s*$/i, // German
  /^z poważaniem[,.]?\s*$/i, // Polish
  /^с уважением[,.]?\s*$/i, // Russian
];

// Known, stable components of THIS business's own signature block (see
// Email Settings) — a lead replying inline reliably includes one or more of
// these verbatim, whether because they quoted the advisor's signature along
// with the rest, or (as observed in the real 2026-07-25 test reply) because
// their own mail client re-appended it. Listed explicitly, not just inferred
// from the generic URL/phone regex below, so detection stays auditable if
// the signature ever changes.
const KNOWN_SIGNATURE_MARKERS = [
  "cyprusvipestates.com",
  "+357 99 278 285",
  "+49 177 5279022",
  "youtube.com/@cyprusvipestates",
  "instagram.com/cyprusvipestates",
  "tiktok.com/@cyprusvipestates",
  "wa.me/35799278285",
];

const CONTACT_LINE_RE = /https?:\/\/\S+|www\.[a-z0-9-]+\.[a-z]{2,}|\+\d[\d\s()-]{6,}\d|\b[a-z0-9-]+\.(?:com|net|org|io|eu)\b/i;

const isBlankLine = (line: string): boolean => line.trim().length === 0;

const isContactLikeLine = (line: string): boolean => {
  if (isBlankLine(line)) return false;
  if (CONTACT_LINE_RE.test(line)) return true;
  return KNOWN_SIGNATURE_MARKERS.some((marker) => line.includes(marker));
};

/** Cuts a trailing signature block, if (and only if) one can be identified with reasonable confidence. */
export function stripSignatureBlock(text: string): string {
  // The standard, unambiguous delimiter — if present, trust it completely.
  const delimiterMatch = text.match(SIGNATURE_DELIMITER_RE);
  if (delimiterMatch && delimiterMatch.index != null) {
    return text.slice(0, delimiterMatch.index).trim();
  }

  const lines = text.split(/\r?\n/);

  // Find the LAST valediction-looking line (closest to the real end of the
  // message — relevant if this ever runs on text that wasn't already
  // quote-stripped) and evaluate what follows it.
  let valedictionIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (VALEDICTION_LINE_PATTERNS.some((p) => p.test(lines[i]))) valedictionIndex = i;
  }
  if (valedictionIndex === -1) return text; // no recognizable closing — nothing to safely cut

  // Let up to 2 short, non-contact-like lines right after the valediction
  // through as the closing name/role.
  let cutFrom = valedictionIndex + 1;
  let nameRoleLinesConsumed = 0;
  while (
    cutFrom < lines.length &&
    nameRoleLinesConsumed < 2 &&
    !isBlankLine(lines[cutFrom]) &&
    !isContactLikeLine(lines[cutFrom])
  ) {
    cutFrom++;
    nameRoleLinesConsumed++;
  }

  const rest = lines.slice(cutFrom);
  const nonBlankRest = rest.filter((l) => !isBlankLine(l));
  if (nonBlankRest.length === 0) return text; // nothing follows the closing — no signature to cut

  const contactLikeCount = nonBlankRest.filter(isContactLikeLine).length;
  const looksLikeSignature = contactLikeCount / nonBlankRest.length > 0.5;
  if (!looksLikeSignature) return text; // doesn't look like contact data — could be real prose, leave it

  return lines.slice(0, cutFrom).join("\n").trim();
}
