// Deals are money records: a lead that has any is never hard-deleted
// (deals_leadId_fkey is ON DELETE RESTRICT). Every hard-delete path — the
// 90-day trash purge, Empty trash, permanent delete — filters through here so
// a lead with deals simply stays in the trash instead of failing the batch.
export function hardDeletableLeadWhere<W extends object>(where: W): W & { deals: { none: {} } } {
  return { ...where, deals: { none: {} } };
}

export const LEAD_HAS_DEALS_ERROR = "This lead has deals and cannot be deleted permanently.";

const leads = (n: number) => `${n} lead${n === 1 ? "" : "s"}`;

export function emptyTrashMessage(deleted: number, keptWithDeals: number): string {
  const base = `${leads(deleted)} permanently deleted.`;
  return keptWithDeals > 0 ? `${base} ${leads(keptWithDeals)} with deals kept in trash.` : base;
}
