// Per-unit availability for the xml2u feeds (Domenica, Pafilia). Pure, so it
// can be tested without the feed adapter's network/parse stack.
//
// Two places can carry the status, checked in this order:
//
//   1. <Price><status>…</status></Price>. Domenica moved the status here in
//      early November 2026 ("Reserved" / "For Sale" / empty) and at the same
//      time dropped the old Features line. Until this was read, every Domenica
//      unit defaulted to "available": on 2026-11-11 the feed had 139 Reserved
//      units, 111 of them in published projects showing as available, and
//      Oculus, la-bella and Eniko Mare were fully reserved but still listed
//      as on the market. Pafilia's <status> is always empty, so it falls
//      through to step 2 unchanged.
//   2. A Features entry starting with "Status:" ("Status: Sold",
//      "Status: Available For Sale"), Domenica's older format. Kept as the
//      fallback in case the feed switches back. Pafilia's features are
//      marketing copy and never start with "Status:".
//
// Nothing found in either place means "available", the behaviour before.
// A non-empty Price.status the parser does not recognise also falls through
// to the Features line, then to "available", so a new wording never hides a
// project; it shows up as available and can be added here.

export type Xml2uUnitStatus = "available" | "sold" | "reserved";

const asText = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return String(o._ ?? o["#text"] ?? o.cdata ?? "");
  }
  return String(v);
};

/** Maps one status string; null when it is empty or not recognised. */
export function parseXml2uStatusValue(raw: unknown): Xml2uUnitStatus | null {
  const v = asText(raw).trim().toLowerCase();
  if (!v) return null;
  if (/\bsold\b/.test(v)) return "sold";
  if (/reserv|under\s*offer/.test(v)) return "reserved";
  if (/for\s*sale|available/.test(v)) return "available";
  return null;
}

export function xml2uUnitStatus(priceStatus: unknown, features: unknown): Xml2uUnitStatus {
  const fromPrice = parseXml2uStatusValue(priceStatus);
  if (fromPrice) return fromPrice;

  const values = features && typeof features === "object" ? Object.values(features as Record<string, unknown>) : [];
  const flat = values.flatMap((x) => (Array.isArray(x) ? x : [x])).map(asText);
  const line = flat.find((f) => /^status\s*:/i.test(f));
  if (!line) return "available";
  return parseXml2uStatusValue(line.slice(line.indexOf(":") + 1)) ?? "available";
}
