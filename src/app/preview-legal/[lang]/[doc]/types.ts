/* Shared shape for both legal documents.

   Legal text is modelled as structured data rather than a prose blob so the
   page can build its own table of contents, deep-link every section, and keep
   the four languages provably parallel — a missing section in one locale is a
   type error, not something you notice a year later. */

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "definitions"; items: { term: string; text: string }[] }
  | { kind: "callout"; text: string };

export type LegalSection = {
  /** Stable anchor id — must NOT be translated; the same section is #data-we-collect in every locale. */
  id: string;
  title: string;
  blocks: LegalBlock[];
};

export type LegalDoc = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  /** Prevailing-language notice, rendered as a small line directly under the
   *  H1. Only locales whose version is a courtesy translation of a binding
   *  English original carry it (`he`); en/de/pl/ru leave it undefined and
   *  their output is unchanged. DE/PL/RU say the same thing inside their
   *  "language versions" section of the terms, which is where it lived before
   *  a locale needed it above the fold. */
  bindingNote?: string;
  intro: string;
  updatedLabel: string;
  /** ISO date — rendered in the visitor's locale. */
  updated: string;
  tocLabel: string;
  sections: LegalSection[];
  /** Shown once at the end; not legal advice, and says so. */
  contactTitle: string;
  contactText: string;
};
