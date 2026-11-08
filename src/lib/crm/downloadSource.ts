import type { LeadSource } from "@prisma/client";
import { formLeadSource } from "@/lib/guides/leadSource";
import { PC_BRIEFING_TITLE } from "@/lib/privateCollectionLead";

// Downloads (2026-11-07): guide and Private Collection briefing readers are kept
// out of the work views until someone takes one over as a lead. Pure, so the
// tests pin it without a database.

/** The buyer source a download gets when it is taken over: the briefing came from
 *  Private Collection, a guide from the page it was requested on (as if it had been
 *  an ordinary enquiry there). */
export function sourceForTakenOverDownload(d: { guideTitle: string | null; pageSource: string | null }): LeadSource {
  if (d.guideTitle === PC_BRIEFING_TITLE) return "PRIVATE_COLLECTION";
  return formLeadSource(d.pageSource ?? "", false);
}

/** A parked or lost download starts over as a new lead; an active one keeps its stage. */
export function statusForTakenOverDownload(status: string): "NEW" | null {
  return status === "LOST" || status === "KEEP_CONTACT" ? "NEW" : null;
}
