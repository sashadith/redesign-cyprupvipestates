/* Distance claims in a project's free text: "300 meters from Finikoudes Beach",
   "5 min to A6 Highway", "Sea: 1 min", "Distance to beach: approx. 500 m",
   "Walking distance to restaurants", "Close to the city centre".

   The project page has its own Distances strip above the map, computed from the
   project's coordinates (src/lib/developmentDistances.ts). The same facts
   repeated in the facts panel and the amenity list come from feeds and price
   lists in every wording and regularly disagree with the computed ones (Leptos:
   92 of 117 comparable values differed). Since 2026-10-31 the page shows
   distances in that strip only, so these are dropped at render — not deleted
   from the row, so a re-sync cannot bring them back.

   Leaf module: no imports, safe in client bundles. */

const UNIT = String.raw`(?:m|mtrs?|meters?|metres?|km|kms|kilomet(?:er|re)s?|min|mins|minutes?)`;

const PATTERNS: RegExp[] = [
  // "300 meters from…", "5 min to…", "20-minute drive", "500m away", "10 minutes' walk"
  new RegExp(String.raw`\d[\d.,]*\s*-?\s*${UNIT}\.?'?\s+(?:walk|walking|drive|driving|by car|on foot|from|to|away)\b`, "i"),
  // Any travel time at all: "Best schools 10 min", "Sea :: 1 min". Minutes never
  // measure a building, so a bare "N min" is always a distance.
  /\b\d+(?:[.,]\d+)?\s*(?:-\s*)?(?:min|mins|minutes?)\b/i,
  // Wordings without a figure ("walking dis\w*" also catches the feed's "Walking Disatnce").
  /\b(?:walking dis\w*|within walking|distance (?:to|from)|(?:a )?few (?:meters|metres|minutes|steps) (?:from|to|away)|steps (?:from|to|away)|close to|close proximity|proximity to|near(?:by)?|minutes? (?:from|to|away)|easy access to|within reach of)\b/i,
  // A fact labelled as a distance ("Distance to beach :: approx. 5 km").
  /^\s*distance\b/i,
];

export function isDistanceClaim(text: string | null | undefined): boolean {
  const s = (text ?? "").trim();
  return !!s && PATTERNS.some((re) => re.test(s));
}
