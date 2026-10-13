/**
 * A /projects?...&page=N URL past the last real page used to answer 200 with an empty grid, which
 * Google reports as a soft 404 (e.g. propertyType=Villa has 8 pages; page=9 and page=10 were empty).
 * Returns the URL of the last real page with every other filter kept, or null when `page` is in range.
 */
export function outOfRangePageTarget(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  page: number,
  totalPages: number,
): string | null {
  if (page <= Math.max(1, totalPages)) return null;
  const last = Math.max(1, totalPages);
  const qs = new URLSearchParams();
  let placed = false;
  const put = () => {
    if (!placed && last > 1) qs.append("page", String(last));
    placed = true;
  };
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page") { put(); continue; } // keep the parameter where it was
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) qs.append(key, v);
  }
  put();
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}
