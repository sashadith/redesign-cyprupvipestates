const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  QUALIFIED: "bg-purple-100 text-purple-700",
  CONTACTED: "bg-yellow-100 text-yellow-800",
  VIEWING_SCHEDULED: "bg-orange-100 text-orange-700",
  OFFER: "bg-indigo-100 text-indigo-700",
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
