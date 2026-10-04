import React from "react";

/* Shared by the homepage section titles that gold-accent one or more
   substrings of a CMS-provided title. Each section used to hardcode its own
   English-only regex to find the phrase to highlight (e.g. /(Cyprus)/i),
   which meant DE/PL/RU — properly translated, but never containing that
   literal English word — silently rendered with no highlight at all
   (2026-09-07 investigation). This does the same "find and wrap known
   substrings" job generically, so each section only needs to supply which
   phrase(s) to look for per locale, not its own matching logic. */

/** Wrap each occurrence of the given phrases (case-insensitive, first match
 * per phrase, in the order given) in the gold-accent span. A phrase not
 * found in the title is silently skipped — this never throws and always
 * renders the full title, highlighted or not. */
export function highlightAccents(title: string, accents: string[]): React.ReactNode {
  type Seg = { text: string; accent: boolean };
  let segments: Seg[] = [{ text: title, accent: false }];
  for (const phrase of accents) {
    if (!phrase) continue;
    const next: Seg[] = [];
    for (const seg of segments) {
      if (seg.accent) {
        next.push(seg);
        continue;
      }
      const idx = seg.text.toLowerCase().indexOf(phrase.toLowerCase());
      if (idx === -1) {
        next.push(seg);
        continue;
      }
      if (idx > 0) next.push({ text: seg.text.slice(0, idx), accent: false });
      next.push({ text: seg.text.slice(idx, idx + phrase.length), accent: true });
      if (idx + phrase.length < seg.text.length) {
        next.push({ text: seg.text.slice(idx + phrase.length), accent: false });
      }
    }
    segments = next;
  }
  return segments.map((seg, i) =>
    seg.accent ? (
      <span key={i} className="it">{seg.text}</span>
    ) : (
      <React.Fragment key={i}>{seg.text}</React.Fragment>
    ),
  );
}
