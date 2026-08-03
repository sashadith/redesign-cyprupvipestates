// One-time seed (2026-08-03): backfills OverlapCandidate with the 49 entries
// that used to live in src/app/admin/(panel)/content/projects/overlaps/candidates.ts
// before the nightly sweep replaced it, preserving each entry's real
// discovery date (2026-07-15 for the original merge-audit list, 2026-08-03
// for the follow-up sweep that found the azalea-villas-aristo/serenity-
// court-aristo duplicates and 20 siblings). Safe to re-run: uses upsert with
// a no-op update, so an entry that already exists is left completely
// untouched (same "never overwrite foundAt" rule as the nightly sweep
// itself in src/lib/overlapSweep.ts).
//
// Run from the repo root so node_modules resolves:
//   DATABASE_URL=... node scripts/seed-overlap-candidates.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const norm = (s) =>
  (s || "").toLowerCase().trim().replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim();

const AUDIT_DATE = new Date("2026-07-15T00:00:00Z");
const SWEEP_DATE = new Date("2026-08-03T00:00:00Z");

// [legacySlug, legacyTitle, developmentSlug, developmentName, confidence, note, foundAt]
const ENTRIES = [
  ["cypress-groove-bbf", "Cypress Grove", "cypress-grove", ":cypress grove", "High", null, AUDIT_DATE],
  ["riverside-domenica", "Riverside", "riverside", "riverside", "High", null, AUDIT_DATE],
  ["galaxy-residences-aristo", "Galaxy Residences", "grand-residences", "Galaxy Residences", "High", null, AUDIT_DATE],
  ["eden-golf-bbf", "Eden Golf", "golf-residences", "Eden Golf", "High", null, AUDIT_DATE],
  ["luma-genesis", "Luma Genesis", "luma-genesis", "Luma Genesis", "High", "slug-identical", AUDIT_DATE],
  ["noble-apartments", "Noble Apartments", "noble", "Noble", "High", null, AUDIT_DATE],
  ["oculus-domenica", "Oculus", "oculus", "oculus", "High", null, AUDIT_DATE],
  ["quatrro", "QUATRRO", "quatrro", "Quatrro", "High", "slug-identical", AUDIT_DATE],
  ["velaro-homes", "Velaro Homes", "velaro-homes", "Velaro Homes", "High", "slug-identical", AUDIT_DATE],
  ["neon-homes-oli", "Neon Homes", "neon-homes", "Neon Homes", "High", null, AUDIT_DATE],
  ["lazzero-park", "Lazzero Park", "lazzero-park", "Lazzero Park", "High", "slug-identical", AUDIT_DATE],
  ["celestia-island-blue", "Celestia", "celestia", "Celestia", "High", null, AUDIT_DATE],
  ["aion-ku", "Aion", "aion", "Aion", "High", null, AUDIT_DATE],
  ["emerald-park-luma", "Emerald Park", "emerald-park", "Emerald Park", "High", null, AUDIT_DATE],
  ["pearl-park-aristo", "Pearl Park Residences", "universal-park-residences", "Pearl Park Residences", "High", null, AUDIT_DATE],
  ["avrora-court-aristo", "Avora Court", "aurora-residence", "Avora Court", "High", null, AUDIT_DATE],
  ["imperial-residences-aristo", "Imperial Residences", "magestic-residences", "Imperial Residences", "High", null, AUDIT_DATE],
  ["royal-residences-aristo", "Royal Residences", "king-residences", "Royal Residences", "High", null, AUDIT_DATE],
  ["andriana-court-aristo", "Andriana Court", "city-living-court", "Andriana Court", "High", null, AUDIT_DATE],
  ["ppremier-residences-aristo", "Premier Residences", "venus-rock-residences", "Premier Residences", "High", null, AUDIT_DATE],
  ["pelagos-beachfront-villas-aristo", "Pelagos Beachfront Villas", "chloraka-beachfront-villas", "Azure Beachfront Villas", "Medium", "different qualifier word (\"Pelagos\" vs \"Azure\") — verify same building", AUDIT_DATE],
  ["azalea-apartments", "Azalea Apartments", "universal-villas", "Azalea Villas", "Medium", "\"Apartments\" vs \"Villas\" — verify same building", AUDIT_DATE],
  ["eniko-mare-domenica", "Eniko Mare", "eniko-mare", "apartments-in-paphos-eniko-mare", "Medium", null, AUDIT_DATE],
  ["aquamarine-villas-aristo", "Aquamarine Villas", "sunny-coastal-residences", "Aquamarine Coastal Villas", "Medium", null, AUDIT_DATE],
  ["begonia-residences-aristo", "Begonia Residences", "chloraka-residences", "Melania - Begonia Residences", "Medium", null, AUDIT_DATE],
  ["meteora-residences-aristo", "Meteora Residences", "meteora-residences", "Meteora Residential Development", "Low-Medium", null, AUDIT_DATE],
  ["kamares-village", "Kamares Village", "neo-chorio-villas-1", "Agnades Village 1", "Likely false positive", "matched only on generic \"village\" token, different specific names", AUDIT_DATE],
  ["kamares-village", "Kamares Village", "argaka-villa", "Argaka Village 6", "Likely false positive", "same reason", AUDIT_DATE],
  ["pearl-sea-caves-villa-1-island-blue", "Pearl Sea Caves Villa 1", "chloraka-rose-residences", "Roseland Villas 1", "Likely false positive", null, AUDIT_DATE],

  ["viewpoint-hills-aristo", "Viewpoint Hills", "viewpoint-hills", "Viewpoint Hills", "High", "2026-08-03 sweep: exact title + same Aristo feed account, same pattern as azalea-villas/serenity-court", SWEEP_DATE],
  ["villa-superior-aristo", "Villa Superior", "villa-superior", "Villa Superior", "High", "2026-08-03 sweep: exact title + same Aristo feed account", SWEEP_DATE],
  ["zephyros-village-3-aristo", "Zephyros Village 3", "zephyros-village-3", "Zephyros Village 3", "High", "2026-08-03 sweep: exact title + same Aristo feed account", SWEEP_DATE],
  ["elementa-domenica", "Elements", "elements", "Elements", "High", "2026-08-03 sweep: exact title + same Domenica feed account", SWEEP_DATE],
  ["konia-aura-domenica", "Konia Aura", "aura-konia", "Konia Aura", "High", "2026-08-03 sweep: exact title + same Domenica feed account", SWEEP_DATE],
  ["la-bella-domenica", "La Bella", "la-bella", "La Bella", "High", "2026-08-03 sweep: exact title + same Domenica feed account", SWEEP_DATE],
  ["morea-residences-inex", "Morea Residences", "morea-residences", "Morea Residences", "High", "2026-08-03 sweep: exact title + same INEX feed account", SWEEP_DATE],
  ["qube-inex", "Qube", "qube", "Qube", "High", "2026-08-03 sweep: exact title + same INEX feed account", SWEEP_DATE],
  ["rosa-dei-venti-bbf", "Rosa Dei Venti", "rosa-dei-venti", "Rosa dei Venti", "Medium", "2026-08-03 sweep: exact title, developer text \"BBF\" on both sides", SWEEP_DATE],
  ["salt-bbf", "Salt", "salt", "Salt", "Medium", "2026-08-03 sweep: exact title, developer text \"BBF\" on both sides", SWEEP_DATE],
  ["sense-bbf", "Sense", "sense", "Sense", "Medium", "2026-08-03 sweep: exact title, developer text \"BBF\" on both sides", SWEEP_DATE],
  ["spirit-bbf", "Spirit", "spirit", "Spirit", "Medium", "2026-08-03 sweep: exact title, developer text \"BBF\" on both sides", SWEEP_DATE],
  ["verde-bbf", "Verde", "verde", "Verde", "Medium", "2026-08-03 sweep: exact title, developer text \"BBF\" on both sides", SWEEP_DATE],
  ["vision-bbf", "Vision", "vision", "Vision", "Medium", "2026-08-03 sweep: exact title, developer text \"BBF\" on both sides", SWEEP_DATE],
  ["synergy-bbf", "Synergy", "synergy", "Synergy", "Medium", "2026-08-03 sweep: exact title, developer text \"BBF\" on both sides, same district (Larnaca)", SWEEP_DATE],
  ["rise-bbf", "Rise", "rise", "Rise", "Medium", "2026-08-03 sweep: exact title, developer text \"BBF\" on both sides", SWEEP_DATE],
  ["nest-bbf", "Nest", "nest", "Nest", "Medium", "2026-08-03 sweep: exact title, developer text \"BBF\" on both sides", SWEEP_DATE],
  ["life-bbf", "Life", "life", "Life", "Medium", "2026-08-03 sweep: exact title, developer text \"BBF\" on both sides", SWEEP_DATE],
  ["glow-bbf", "Glow", "glow", "Glow", "Medium", "2026-08-03 sweep: exact title, developer text \"BBF\" on both sides — a second Development (\"Glow 2\") also exists, likely a distinct later phase, not this match", SWEEP_DATE],
  ["eden-bay-bbf", "Eden Bay", "eden-bay", "Eden Bay", "Medium", "2026-08-03 sweep: exact title, developer text \"BBF\" on both sides", SWEEP_DATE],
];

let created = 0, skippedExisting = 0, skippedMissing = 0;
const missing = [];

for (const [legacySlug, legacyTitle, developmentSlug, developmentName, confidence, note, foundAt] of ENTRIES) {
  const legacy = await prisma.project.findFirst({ where: { slug: legacySlug, language: "en" }, select: { id: true } });
  const dev = await prisma.development.findFirst({ where: { slug: developmentSlug }, select: { id: true } });
  if (!legacy || !dev) {
    skippedMissing++;
    missing.push({ legacySlug, developmentSlug, legacyFound: !!legacy, devFound: !!dev });
    continue;
  }

  const matchType = norm(legacyTitle) === norm(developmentName) ? "exact-title" : "fuzzy-title";
  const existing = await prisma.overlapCandidate.findUnique({
    where: { legacyProjectId_developmentId: { legacyProjectId: legacy.id, developmentId: dev.id } },
  });
  if (existing) { skippedExisting++; continue; }

  await prisma.overlapCandidate.create({
    data: { legacyProjectId: legacy.id, developmentId: dev.id, confidence, matchType, distanceMeters: null, note, foundAt },
  });
  created++;
}

console.log(JSON.stringify({ totalEntries: ENTRIES.length, created, skippedExisting, skippedMissing, missing }, null, 2));
await prisma.$disconnect();
