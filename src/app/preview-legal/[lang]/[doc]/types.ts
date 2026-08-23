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
