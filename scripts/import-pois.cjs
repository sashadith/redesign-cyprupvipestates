const fs = require("fs"); const pathmod = require("path");
const OUT = "/Users/sashadith/cvp-analysis/public/poi/cyprus.json";
const BBOX = "34.45,32.20,35.72,34.65";
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const HEADERS = { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json", "User-Agent": "cvp-poi-import/1.0 (+https://cyprusvipestates.com)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const Q = [
  { key: "school", filter: '["amenity"="school"]' },
  { key: "clinic", filter: '["amenity"~"^(hospital|clinic|doctors)$"]' },
  { key: "supermarket", filter: '["shop"="supermarket"]' },
  { key: "pharmacy", filter: '["amenity"="pharmacy"]' },
  { key: "beach", filter: '["natural"="beach"]' },
  { key: "restaurant", filter: '["amenity"="restaurant"]' },
  { key: "golf", filter: '["leisure"="golf_course"]' },
  { key: "airport", filter: '["aeroway"="aerodrome"]' },
];
const schoolCat = (t) => (t["operator:type"] === "private" || t.fee === "yes") ? "school_private" : "school_public";
async function tryFetch(q, attempt) {
  const ep = ENDPOINTS[attempt % ENDPOINTS.length];
  const query = `[out:json][timeout:120];(nwr${q.filter}(${BBOX}););out center 9000;`;
  const res = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(query), headers: HEADERS });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const j = await res.json();
  const out = [];
  for (const el of j.elements || []) {
    const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;
    out.push({ lat: +lat.toFixed(5), lng: +lng.toFixed(5), n: (el.tags?.name || "").slice(0, 60), c: q.key === "school" ? schoolCat(el.tags || {}) : q.key });
  }
  return out;
}
async function fetchCat(q) {
  for (let a = 0; a < 5; a++) {
    try { return await tryFetch(q, a); }
    catch (e) { console.error("  retry", q.key, "attempt", a + 1, e.message); await sleep(6000 + a * 6000); }
  }
  throw new Error("gave up " + q.key);
}
(async () => {
  const all = [];
  for (const q of Q) {
    try { const r = await fetchCat(q); console.error(q.key.padEnd(12), r.length); all.push(...r); }
    catch (e) { console.error("FAIL", q.key, e.message); }
    await sleep(4000);
  }
  fs.mkdirSync(pathmod.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ count: all.length, pois: all }));
  const byCat = {}; all.forEach((p) => byCat[p.c] = (byCat[p.c] || 0) + 1);
  console.error("--- by cat:", JSON.stringify(byCat));
  console.error("TOTAL", all.length, "→", (fs.statSync(OUT).size / 1024).toFixed(0) + "KB");
})();
