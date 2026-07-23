// Shared "is this LeadInteraction row something an admin manually entered
// (and can therefore delete)?" check — LeadInteraction has no boolean flag
// for this, so it's derived from `type`. Used both server-side
// (deleteLeadInteraction rejects non-manual types) and client-side
// (UnifiedTimeline only renders a Delete control on manual rows).
import type { LeadInteractionType } from "@prisma/client";

const MANUAL_TYPES: ReadonlySet<LeadInteractionType> = new Set<LeadInteractionType>([
  "NOTE",
  "CALL",
  "EMAIL_OUT",
  "WHATSAPP_OUT",
]);

// STATUS_CHANGE / PRESENTATION_EVENT / SYSTEM are always system-generated.
// EMAIL_IN / WHATSAPP_IN are reserved for Phase 3 inbound handling — not
// written anywhere yet, but deliberately excluded here too: once inbound
// messages land, they should never be admin-deletable either.
export function isManualInteractionType(type: LeadInteractionType): boolean {
  return MANUAL_TYPES.has(type);
}
