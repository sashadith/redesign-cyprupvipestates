// Admin-entered descriptions (DevelopmentOverride.descriptionEN/DE/PL/RU) are
// stored as plain text with CRLF line breaks ("\r\n\r\n" between paragraphs,
// occasionally a lone "\r\n" mid-paragraph) — never HTML. Two renderers used
// to split on \r?\n{2,}, which only matches an optional single \r followed
// by 2+ CONSECUTIVE \n — never true for real "\r\n\r\n" data (the \r always
// breaks up the \n run), so paragraph breaks were silently dropped and
// everything rendered as one block. Normalizing CRLF -> LF before splitting
// fixes it; also collapses stray runs of spaces left over from any
// previously-lost line break (e.g. "of place.  This development").
export function splitDescriptionParagraphs(text: string): string[][] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean)
    .map((p) => p.split(/\n/));
}
