// Shared Google-Maps-link → {lat,lng} helpers. Used by the admin's manual "Map
// location" field (already a long url/lat,lng string) and by the Drive price-list
// sync (a mapsUrl extracted from the sheet, often a goo.gl/maps.app shortlink that
// doesn't carry the coordinates itself and must be resolved first).

// Order matters: a resolved Google Maps URL often carries TWO different
// coordinate pairs — "@lat,lng" is just the map VIEWPORT center (zoom-dependent,
// drifts a little between requests/redirects) while "!3d..!4d.." is the actual
// precise place/pin marker. Try the precise pin first, viewport center last.
const PATTERNS = [
  /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,                                 // !3d34.77!4d32.42 — precise pin
  /\/maps\/search\/(-?\d{1,3}\.\d+),\+?(-?\d{1,3}\.\d+)/,                   // .../maps/search/34.77,+32.42 — a shortlink resolving to a bare coordinate pin
  /[?&](?:q|ll|center|destination)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,   // ?q=34.77,32.42
  /^(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)$/,                       // "34.77, 32.42"
  /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,                                     // .../@34.77,32.42,17z — viewport center, least precise
];

// Extract { lat, lng } from a Google Maps link or a plain "lat, lng" string.
export function parseGeoFromText(raw: string): { lat: number; lng: number } | null {
  const s = (raw || "").trim();
  if (!s) return null;
  for (const p of PATTERNS) {
    const m = s.match(p);
    if (m) {
      const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    }
  }
  return null;
}

// Shortlinks (goo.gl/maps/…, maps.app.goo.gl/…) don't carry coordinates — follow
// the redirect and parse the resolved long url instead. Best-effort: returns null
// on any network/parse failure rather than throwing (geo is a nice-to-have here).
export async function resolveMapsUrlToGeo(url: string): Promise<{ lat: number; lng: number } | null> {
  const direct = parseGeoFromText(url);
  if (direct) return direct;
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000) });
    return parseGeoFromText(res.url);
  } catch {
    return null;
  }
}
