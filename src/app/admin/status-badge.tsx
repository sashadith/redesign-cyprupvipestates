export const STATUS_STYLES: Record<string, string> = {
  // 2026-09-08 — NEW and COMMUNICATING swapped hues on request: the first
  // thing in the funnel now reads green-ish rather than blue. Note the site
  // already spends a true green on CLOSED, so these two are teal vs green,
  // not two greens.
  NEW: "bg-teal-100 text-teal-700",
  CONTACTED: "bg-yellow-100 text-yellow-800",
  // Batch B (2026-07-25): a status between CONTACTED and VIEWING_SCHEDULED.
  // Was teal until 2026-09-08, swapped with NEW (see above).
  COMMUNICATING: "bg-blue-100 text-blue-700",
  VIEWING_SCHEDULED: "bg-orange-100 text-orange-700",
  OFFER: "bg-indigo-100 text-indigo-700",
  // 2026-08-11 — parallel to the funnel, not a stage in it (see LeadStatus
  // comment in schema.prisma). Purple: the one hue not already claimed by a
  // neighboring status, so it reads as "a different kind of thing", not
  // just "further along".
  KEEP_CONTACT: "bg-purple-100 text-purple-700",
  CLOSED: "bg-green-100 text-green-700",
  LOST: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}
