// The partner pipeline's errors in the partner's language (partner pipeline, 2026-11-05).
// Pure: no prisma. moveLeadCore, the partner actions and validateLeadEdit answer in
// staff English (or with a key such as NOT_IN_PIPELINE); the portal never shows that
// text, it shows the pipeline.err.* entry this maps it to. Anything unknown is generic.

export const NOT_IN_PIPELINE_KEY = "pipeline.err.notInPipeline";
export const GENERIC_KEY = "pipeline.err.generic";

const KEYS: Record<string, string> = {
  NOT_IN_PIPELINE: NOT_IN_PIPELINE_KEY,
  DUPLICATE_CONTACT: "pipeline.err.duplicateContact",
  NOT_VIEWING_SCHEDULED: "pipeline.err.notViewing",
  // moveLeadCore / planMove
  "Enter the deal: project, unit and price.": "pipeline.err.dealMissing",
  "Enter a valid price in whole euros.": "pipeline.err.price",
  "Project not found.": "pipeline.err.project",
  "Choose why the lead was lost.": "pipeline.err.lostReason",
  "This move cancels the open deal(s).": "pipeline.err.confirmCancel",
  "The deals changed meanwhile — reload and try again.": "pipeline.err.stale",
  "A deal on this lead was already paid by the developer; it cannot leave Reserved/Sold.": "pipeline.err.dealPaid",
  "viewingScheduledAt is required when setting status VIEWING_SCHEDULED.": "pipeline.err.viewingDate",
  // logPartnerInteraction
  "The date cannot be in the future.": "pipeline.err.futureDate",
  "Message is required.": "pipeline.err.messageRequired",
  // validateLeadEdit / validateNewLead
  "First name is required.": "pipeline.err.firstNameRequired",
  "Enter a valid first name.": "pipeline.err.firstName",
  "First name is too long (80 characters max).": "pipeline.err.firstName",
  "Enter a valid last name.": "pipeline.err.lastName",
  "Last name is too long (80 characters max).": "pipeline.err.lastName",
  "Enter a valid email address.": "pipeline.err.email",
  "Enter a valid phone number.": "pipeline.err.phone",
  "Phone needs 6 to 20 digits.": "pipeline.err.phone",
  "Add an email or a phone number": "pipeline.err.contactRequired",
  "Pick a language from the list.": "pipeline.err.language",
  "Pick a timeline from the list.": "pipeline.err.timeline",
  "Pick a financing option from the list.": "pipeline.err.financing",
  "Budget must be a whole number, 0 or more.": "pipeline.err.budget",
  "Maximum budget cannot be below the minimum.": "pipeline.err.budgetOrder",
  "Message is too long (4000 characters max).": "pipeline.err.enquiryLong",
  "Pick a salutation from the list.": "pipeline.err.salutation",
  "Enter a valid nationality.": "pipeline.err.nationality",
  "Nationality is too long (80 characters max).": "pipeline.err.nationality",
  "Enter a valid country of residence.": "pipeline.err.country",
  "Country of residence is too long (80 characters max).": "pipeline.err.country",
};

/** The pipeline.err.* dictionary key for an error text or key; unknown → pipeline.err.generic. */
export function pipelineErrorKey(msg: string | null | undefined): string {
  return (msg && Object.prototype.hasOwnProperty.call(KEYS, msg) ? KEYS[msg] : null) ?? GENERIC_KEY;
}
