const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-yellow-100 text-yellow-800",
  // Batch B (2026-07-25): new status between CONTACTED and VIEWING_SCHEDULED —
  // teal keeps it visually distinct from both its neighbors and from OFFER's indigo.
  COMMUNICATING: "bg-teal-100 text-teal-700",
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
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
