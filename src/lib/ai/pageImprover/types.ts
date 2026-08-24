// Shapes and constants for the Page Improver. The spec is
// docs/superpowers/specs/2026-08-24-page-improver-design.md; the measured
// rationale for every rule lives there and in copyRules.ts.

/** Apply stays OFF until the calibration gate passes: generate proposals for
 *  five real pages in production, the operator judges each by hand (same
 *  posture as Page Power's hand-checked 30-URL calibration, which is the only
 *  reason that feature's verdicts are trusted). Flip in its own commit with
 *  the five judgments in the message. Until then the button renders disabled
 *  with the reason, and the server action refuses independently — the UI is
 *  not the enforcement. */
export const APPLY_ENABLED = false;

export const IMPROVER_TITLE_BUDGET = 58;
export const IMPROVER_DESC_BUDGET = 150;
/** GSC rows are fetched over this window, matching Page Power's. */
export const IMPROVER_WINDOW_DAYS = 90;
/** Top queries by impressions handed to the model. Beyond this the tail is
 *  privacy-sampled noise — single-impression rows — that costs tokens and
 *  invites sections chasing queries nobody asks. */
export const MAX_QUERIES = 60;

export type ContentSection = { heading: string; draft: string; queriesServed: string[] };
export type InternalLinkSuggestion = { fromPath: string; anchor: string; why: string };

export type ImprovementProposal = {
  metaTitle: string;
  metaDescription: string;
  rationale: string;
  contentSections: ContentSection[];
  internalLinks: InternalLinkSuggestion[];
};

export type CurrentSeo = { metaTitle: string; metaDescription: string };
