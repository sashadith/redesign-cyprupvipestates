// Small presentational pills for the feed-analysis tables. Pure render (usable
// from server components). Mirrors the StatusBadge pill style.

const PILL = "inline-block rounded-full px-2 py-0.5 text-xs font-medium";

const TYPE_STYLES: Record<string, string> = {
  string: "bg-gray-100 text-gray-700",
  number: "bg-slate-100 text-slate-700",
  price: "bg-green-100 text-green-700",
  area: "bg-teal-100 text-teal-700",
  date: "bg-amber-100 text-amber-800",
  boolean: "bg-zinc-100 text-zinc-700",
  coordinates: "bg-cyan-100 text-cyan-700",
  status: "bg-orange-100 text-orange-700",
  image: "bg-fuchsia-100 text-fuchsia-700",
  url: "bg-blue-100 text-blue-700",
};

const REC_STYLES: Record<string, string> = {
  existing: "bg-green-100 text-green-700",
  new: "bg-indigo-100 text-indigo-700",
  optional: "bg-yellow-100 text-yellow-800",
  ignore: "bg-gray-100 text-gray-500",
};

export function TypeBadge({ type }: { type: string }) {
  return <span className={`${PILL} ${TYPE_STYLES[type] ?? "bg-gray-100 text-gray-700"}`}>{type}</span>;
}

export function RecBadge({ rec }: { rec: string }) {
  const label = rec === "existing" ? "existing field" : rec === "new" ? "new field" : rec;
  return <span className={`${PILL} ${REC_STYLES[rec] ?? "bg-gray-100 text-gray-700"}`}>{label}</span>;
}
