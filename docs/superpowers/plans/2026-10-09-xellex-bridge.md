# Xellex Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only HTTP API on CVE that delivers published developments — allowlisted fields, all units, all image variants — to Xellex, with a per-developer switch deciding which developers are deliverable at all.

**Architecture:** One route (`GET /api/bridge/projects`) over three new library files: a config module owning the per-developer switch, a payload builder owning the field allowlist and image fingerprints, and the route owning auth, pagination, the `updatedSince` cursor and the `removed` list. Configuration is two columns on `DeveloperAccount`; no new table. Access is logged through the existing `CronRunLog`.

**Tech Stack:** Next.js 14 App Router (route handler), Prisma/Postgres, Node `fs.stat` for image fingerprints.

**Spec:** `docs/superpowers/specs/2026-10-09-xellex-bridge-design.md` — read it first. Every design decision below is argued there, with the measurements behind it.

## Global Constraints

1. **`npx tsc --noEmit` must exit 0.** `tsconfig.json` sets **no `target`** and **no `downlevelIteration`**: wrap Map/Set iteration in `Array.from()`; the regex `/u` flag and `\p{L}` are unavailable.
2. **There is no test runner in this repo, by decision.** Do not add one. The test cycle for every task is: `tsc`, then run the real thing against the production database through a temporary route on a dev server, then read the output. Where a task says "verify", that is what it means.
3. **`.env.local` tunnels to the PRODUCTION database on `localhost:5433`.** Read-only queries only. **Never run `prisma migrate dev`, `migrate deploy` or `db push`** — they would connect to production outside the deploy path. `npx prisma generate` is local codegen and is fine. The migration in Task 1 is hand-written and reaches production only via `CVP_RUN_MIGRATE=1 ./scripts/deploy-prod.sh`.
4. **A deploy touching `prisma/schema.prisma` or `prisma/migrations/` needs `CVP_RUN_MIGRATE=1`**, or every query on the changed table 500s. This caused a ~15–20 minute outage on 2026-09-17.
5. **Admin-facing copy is English.** Public/client-facing copy is localised. This API is machine-facing; its error strings are English.
6. **Comments explain *why*, carrying the dated measurement or incident that motivated them.** Match the voice of `src/lib/feedSync.ts` and `src/lib/imageMirror.ts`.
7. **Commit messages explain reasoning, not a changelog.** End with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
8. **Every code fence in this plan stays byte-identical to the file it describes.** Change a file with a fence here → update the fence in the same commit, verified programmatically (read both, string-compare), never by eye.
9. **The shared working tree rule:** other sessions edit this repo. Never `git add -A`; add the exact paths each task names.

## Measured facts this plan is built on (production, 2026-10-09)

| | |
|---|---|
| published developments | 344 |
| developer accounts | 24 with published work, 25 total |
| unit rows | 4,872 |
| `/uploads/` image references | 46,423 (~135 per project) |
| full payload, raw JSON | 18.6 MB |
| largest single project | 370 KB |
| image store | 11 GB, 97,433 files; `public/uploads` → `/var/www/shared-uploads` (symlink) |

Image variants on disk are `<hash>_small.webp`, `_medium.webp`, `_large.webp`; the database stores the `_medium` URL. The hash is `sha1(sourceUrl)`, **not** a content hash — which is why images need `bytes` + `modified`.

## File structure

| file | responsibility |
|---|---|
| `prisma/schema.prisma` (modify) | `bridgeEnabled` / `bridgeChangedAt` on `DeveloperAccount` |
| `prisma/migrations/20261009120000_add_bridge_config/migration.sql` (new) | the two columns, additive |
| `src/lib/bridge/config.ts` (new) | read enabled developers; toggle one, stamping `bridgeChangedAt` |
| `src/lib/bridge/images.ts` (new) | one stored URL → up to three variants with `bytes` + `modified` |
| `src/lib/bridge/payload.ts` (new) | the field allowlist; one `Development` row → one wire object |
| `src/lib/bridge/query.ts` (new) | the three-table `updatedSince` cursor and the two-source `removed` list |
| `src/app/api/bridge/projects/route.ts` (new) | auth, paging, response assembly, access log |
| `src/app/admin/(panel)/feeds/bridge/page.tsx` (new) | the per-developer switch screen |
| `src/app/admin/(panel)/feeds/bridge/actions.ts` (new) | the toggle server action |

---

## Task 1: Config columns, migration, and the config module

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261009120000_add_bridge_config/migration.sql`
- Create: `src/lib/bridge/config.ts`

**Interfaces:**
- Produces: `listBridgeDevelopers(): Promise<BridgeDeveloper[]>`, `setBridgeEnabled(slug: string, enabled: boolean): Promise<void>`, `type BridgeDeveloper = { id: string; name: string; slug: string; enabled: boolean; changedAt: Date | null; publishedProjects: number }`, `enabledDeveloperIds(): Promise<string[]>`

- [x] **Step 1: Add the two columns**

In `prisma/schema.prisma`, inside `model DeveloperAccount`, directly after the `notes` field:

```prisma
  // Xellex bridge (2026-10-09) — which developers are deliverable to the second
  // portal. Default OFF: a developer account created next year must not appear
  // on a public site nobody decided to put it on.
  //
  // `bridgeChangedAt` is not bookkeeping, it is load-bearing. Switching a
  // developer off touches none of its Development rows, so their `updatedAt`
  // stays old and a pure cursor sync would never report the removal — the
  // projects would stay live on Xellex forever. The removal query reads this
  // stamp; see removedSince() in src/lib/bridge/query.ts.
  bridgeEnabled   Boolean   @default(false)
  bridgeChangedAt DateTime?
```

- [x] **Step 2: Write the migration by hand**

Create `prisma/migrations/20261009120000_add_bridge_config/migration.sql`:

```sql
-- Additive only: two nullable-or-defaulted columns on an existing table, no
-- data rewritten. Applied exclusively via the deploy path
-- (CVP_RUN_MIGRATE=1 ./scripts/deploy-prod.sh), never from a dev machine —
-- .env.local points at production.
--
-- Column order is alphabetical, not schema order, because that is what
-- `prisma migrate dev` emits for a multi-column ALTER TABLE — see
-- 20260801082214 (schema says soldOutSince then returnedToMarketAt, the
-- migration says the reverse) and 20260706054910 (seven columns, fully
-- re-sorted). Hand-writing it the other way round would leave the table's
-- physical column order disagreeing with every future generated migration.
ALTER TABLE "developer_accounts" ADD COLUMN     "bridgeChangedAt" TIMESTAMP(3),
ADD COLUMN     "bridgeEnabled" BOOLEAN NOT NULL DEFAULT false;
```

Verify the SQL against what Prisma would emit for these two field types by comparing with an existing additive migration in `prisma/migrations/` — `Boolean @default(false)` → `BOOLEAN NOT NULL DEFAULT false`, `DateTime?` → `TIMESTAMP(3)` with no `NOT NULL`. Do not run `prisma migrate dev` to find out.

- [x] **Step 3: Regenerate the client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client". This is local codegen and opens no database connection — if you doubt that, run it with `DATABASE_URL="postgresql://nobody:nobody@127.0.0.1:1/none"` and confirm it still succeeds.

- [x] **Step 4: Write the config module**

Create `src/lib/bridge/config.ts`:

```typescript
import { prisma } from "@/lib/prisma";

/** One developer account as the bridge admin screen shows it. */
export type BridgeDeveloper = {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  changedAt: Date | null;
  publishedProjects: number;
};

/**
 * Every developer account, with its switch and how much it would deliver.
 *
 * Returns ALL accounts, not just enabled ones: the screen's job is to let
 * someone turn a developer ON, which is impossible if the off ones are hidden.
 * Measured 2026-10-09: 25 accounts, 24 of them with published work.
 */
export async function listBridgeDevelopers(): Promise<BridgeDeveloper[]> {
  const [accounts, counts] = await Promise.all([
    prisma.developerAccount.findMany({
      select: { id: true, name: true, slug: true, bridgeEnabled: true, bridgeChangedAt: true },
      orderBy: { name: "asc" },
    }),
    prisma.development.groupBy({
      by: ["developerAccountId"],
      where: { publishStatus: "published" },
      _count: { _all: true },
    }),
  ]);
  const published = new Map(counts.map((c) => [c.developerAccountId, c._count._all]));
  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    enabled: a.bridgeEnabled,
    changedAt: a.bridgeChangedAt,
    publishedProjects: published.get(a.id) ?? 0,
  }));
}

/**
 * Flip one developer's switch, stamping WHEN.
 *
 * The stamp is the whole point — see the schema comment. It is written on
 * every call, including a no-op re-enable, because `removedSince` reads it as
 * "the switch was last touched at T", not as "it was turned off at T".
 */
export async function setBridgeEnabled(slug: string, enabled: boolean): Promise<void> {
  await prisma.developerAccount.update({
    where: { slug },
    data: { bridgeEnabled: enabled, bridgeChangedAt: new Date() },
  });
}

/** Ids of the developer accounts currently deliverable. */
export async function enabledDeveloperIds(): Promise<string[]> {
  const rows = await prisma.developerAccount.findMany({
    where: { bridgeEnabled: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
```

- [x] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0, no output.

Then confirm the new columns are visible to the client but **absent from production** (the migration has not been deployed):

```bash
node --env-file=.env.local -e '
const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();
p.developerAccount.findFirst({select:{slug:true,bridgeEnabled:true}})
 .then(r=>console.log("unexpected: column already exists",r))
 .catch(e=>console.log("expected P2022 (column missing in prod):",e.code))
 .finally(()=>p.$disconnect());'
```
Expected: `expected P2022 (column missing in prod): P2022`. That confirms both that the client knows the column and that production does not have it yet — exactly the state before the deploy.

- [x] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261009120000_add_bridge_config/migration.sql src/lib/bridge/config.ts docs/superpowers/plans/2026-10-09-xellex-bridge.md
git commit
```

---

## Task 2: Image variants and fingerprints

**Files:**
- Create: `src/lib/bridge/images.ts`

**Interfaces:**
- Produces: `type ImageVariant = { url: string; bytes: number; modified: string }`, `type BridgeImage = { stored: string; variants: Partial<Record<"small" | "medium" | "large", ImageVariant>> }`, `imagesFor(urls: string[]): Promise<BridgeImage[]>`

- [x] **Step 1: Write the module**

Create `src/lib/bridge/images.ts`:

```typescript
import { stat } from "node:fs/promises";
import { join } from "node:path";

const SITE_URL = "https://cyprusvipestates.com";
const SIZES = ["small", "medium", "large"] as const;
type Size = (typeof SIZES)[number];

export type ImageVariant = { url: string; bytes: number; modified: string };
export type BridgeImage = { stored: string; variants: Partial<Record<Size, ImageVariant>> };

/**
 * Why a fingerprint is needed at all, and why it is stat() rather than a hash.
 *
 * imageMirror.ts names files `<hash>_<size>.webp` where the hash is
 * sha1(sourceUrl) — derived from the SOURCE URL, not from the bytes. A
 * developer who replaces a photo at the same URL therefore produces the same
 * filename with different content, and a consumer keyed on the URL would never
 * re-download it. `bytes` + `modified` catches that; the filename cannot.
 *
 * A content hash would be stronger and is deliberately not built: hashing
 * 11 GB per export is not affordable, and storing a hash at mirror time means
 * changing the mirroring path, which this feature has no other reason to
 * touch. The residual blind spot — a file rewritten to the same byte length
 * within the same second — is stated in the spec rather than left implied.
 */
const MIRROR_RE = /^(\/uploads\/developments\/[^/]+\/[0-9a-f]+)_(small|medium|large)(\.[a-z0-9]+)$/i;

/** Absolute path on disk for a /uploads/... URL. In production
 *  public/uploads is a symlink to /var/www/shared-uploads; join() follows it. */
const diskPath = (url: string) => join(process.cwd(), "public", url.replace(/^\//, ""));

async function variantOf(url: string): Promise<ImageVariant | null> {
  try {
    const s = await stat(diskPath(url));
    if (!s.isFile()) return null;
    return { url: `${SITE_URL}${url}`, bytes: s.size, modified: s.mtime.toISOString() };
  } catch {
    // A URL in the database with no file behind it. Real: mirroring can fail
    // after the row is written. Skipped rather than thrown — one missing photo
    // must not fail a whole project's delivery.
    return null;
  }
}

/**
 * Expand stored image URLs into every variant that actually exists on disk.
 *
 * The database stores the _medium URL; _small and _large are siblings whose
 * names differ only in the suffix. Each one is stat()'d rather than assumed:
 * measured 2026-10-09 the three-variant set is the norm, but a URL that does
 * not match the mirrored pattern at all (an un-mirrored or raw
 * content-hashed file) still has to be delivered, so it falls through as a
 * single variant under its own size key.
 */
export async function imagesFor(urls: string[]): Promise<BridgeImage[]> {
  const out: BridgeImage[] = [];
  for (const stored of urls) {
    if (typeof stored !== "string" || !stored.startsWith("/uploads/")) continue;
    const m = stored.match(MIRROR_RE);
    const variants: Partial<Record<Size, ImageVariant>> = {};
    if (m) {
      const [, base, , ext] = m;
      for (const size of SIZES) {
        const v = await variantOf(`${base}_${size}${ext}`);
        if (v) variants[size] = v;
      }
    } else {
      const v = await variantOf(stored);
      if (v) variants.medium = v;
    }
    if (Object.keys(variants).length > 0) out.push({ stored, variants });
  }
  return out;
}
```

- [x] **Step 2: Verify against real files**

Run: `npx tsc --noEmit` → exit 0.

Then check it against the production image store. `public/uploads` does not exist in a worktree, so point the check at the real mirror over SSH instead of guessing:

```bash
ssh -i ~/.ssh/cvp_vps root@72.60.89.239 "ls /var/www/shared-uploads/developments/bbf-19/ | head -3"
```

Expected: three files sharing one hash with `_small` / `_medium` / `_large` suffixes. Confirm your `MIRROR_RE` matches that exact shape, including the extension, and say in your report how many of a sample project's stored URLs produced three variants versus fewer.

- [x] **Step 3: Commit**

```bash
git add src/lib/bridge/images.ts docs/superpowers/plans/2026-10-09-xellex-bridge.md
git commit
```

---

## Task 3: The payload allowlist

**Files:**
- Create: `src/lib/bridge/payload.ts`

**Interfaces:**
- Consumes: `imagesFor` and `BridgeImage` from `src/lib/bridge/images.ts` (Task 2)
- Produces: `type BridgeProject`, `buildProject(row: DevelopmentWithRelations): Promise<BridgeProject>`, `type DevelopmentWithRelations` (the Prisma payload type the query in Task 4 must produce)

- [ ] **Step 1: Write the module**

Create `src/lib/bridge/payload.ts`:

```typescript
import type { Prisma } from "@prisma/client";
import { imagesFor, type BridgeImage } from "./images";

/**
 * The shape Task 4's query must select. Declared here, next to the allowlist
 * it feeds, so the query cannot quietly start fetching a column this file
 * would then pass through untouched.
 */
export const BRIDGE_INCLUDE = {
  override: true,
  units: { orderBy: { sortIndex: "asc" } },
  developerAccount: { select: { name: true, slug: true } },
  // A RELATION, not a JSON array — DevelopmentSlugHistory rows, one per
  // retired slug. Verified against the schema 2026-10-09, because treating it
  // as a scalar array would have silently delivered [] for every project and
  // left Xellex unable to build redirects for anything ever renamed here.
  slugHistory: { select: { slug: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.DevelopmentInclude;

export type DevelopmentWithRelations = Prisma.DevelopmentGetPayload<{ include: typeof BRIDGE_INCLUDE }>;

/**
 * WITHHELD, by allowlist rather than by omission.
 *
 * The first draft of this feature said "deliver the whole row". That would
 * have exported `driveFolderId`, and on this site a Drive folder id IS an
 * access token: those folders are shared by anonymous link (see the Drive and
 * Korantina connectors). It would have handed a second portal read access to
 * developers' source folders.
 *
 *   driveFolderId, driveImagesModified  — the credential above, plus its clock
 *   developerAccountId, dev, feedProjectId, feedKey — internal source identity;
 *       feedKey is literally "<vendor>:<id>"
 *   syncedAt, imageDriftDetectedAt, newFromFeed — sync bookkeeping
 *   presentationItems, supersedesProjects — CRM and migration relations
 *
 * An allowlist also fails safe forward: a column added to Development next
 * year is withheld until someone decides it should travel, instead of
 * appearing on a public portal the week it is created.
 */
export type BridgeUnit = {
  id: string; ref: string | null; name: string | null; label: string | null; type: string | null;
  status: string | null; price: number | null; currency: string | null;
  beds: string | null; baths: string | null;
  areaBuilt: string | null; areaInternal: string | null; areaPlot: string | null;
  areaVeranda: string | null; areaVerandaOpen: string | null;
  floor: string | null; unitNumber: string | null; storage: string | null; guestWc: string | null;
  orientation: string | null; latitude: number | null; longitude: number | null;
  attrs: unknown; amenities: unknown; sortIndex: number | null;
  photos: BridgeImage[]; plans: BridgeImage[];
};

export type BridgeProject = {
  id: string;
  slug: string | null;
  slugHistory: string[];
  publicName: string;
  developerName: string;
  developer: string | null;
  developerAccount: { name: string; slug: string };
  category: string | null; status: string | null; stage: string | null;
  completion: string | null; energy: string | null;
  district: string | null; town: string | null; area: string | null;
  priceFrom: number | null; priceTo: number | null; currency: string | null;
  latitude: number | null; longitude: number | null;
  unitsTotal: number; unitsAvailable: number;
  soldOutSince: string | null; returnedToMarketAt: string | null;
  description: string | null;
  amenities: unknown; distances: unknown; extraFacts: unknown;
  publishedAt: string | null;
  updatedAt: string;
  override: {
    alias: string | null; heroVideo: string | null;
    descriptionEN: string | null; descriptionDE: string | null;
    descriptionPL: string | null; descriptionRU: string | null; descriptionHE: string | null;
    promoBlocksEN: unknown; promoBlocksDE: unknown;
    promoBlocksPL: unknown; promoBlocksRU: unknown; promoBlocksHE: unknown;
    seo: unknown; vatApplies: boolean | null;
  } | null;
  mainImage: BridgeImage | null;
  gallery: BridgeImage[];
  plans: BridgeImage[];
  units: BridgeUnit[];
};

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export async function buildProject(row: DevelopmentWithRelations): Promise<BridgeProject> {
  const o = row.override;
  // The override's images win over the development's when set — same precedence
  // the public project page applies, so Xellex shows what cyprusvipestates.com
  // shows rather than the raw feed gallery an admin already replaced.
  const galleryUrls = strings(o?.gallery).length > 0 ? strings(o?.gallery) : strings(row.gallery);
  const [mainImage, gallery, plans] = await Promise.all([
    o?.mainImage ? imagesFor([o.mainImage]) : Promise.resolve([]),
    imagesFor(galleryUrls),
    imagesFor(strings(row.plans)),
  ]);

  const units: BridgeUnit[] = [];
  for (const u of row.units) {
    const [photos, unitPlans] = await Promise.all([imagesFor(strings(u.photos)), imagesFor(strings(u.plans))]);
    units.push({
      id: u.id, ref: u.ref, name: u.name, label: u.label, type: u.type,
      status: u.status, price: u.price, currency: u.currency,
      beds: u.beds, baths: u.baths,
      areaBuilt: u.areaBuilt, areaInternal: u.areaInternal, areaPlot: u.areaPlot,
      areaVeranda: u.areaVeranda, areaVerandaOpen: u.areaVerandaOpen,
      floor: u.floor, unitNumber: u.unitNumber, storage: u.storage, guestWc: u.guestWc,
      orientation: u.orientation, latitude: u.latitude, longitude: u.longitude,
      attrs: u.attrs, amenities: u.amenities, sortIndex: u.sortIndex,
      photos, plans: unitPlans,
    });
  }

  return {
    id: row.id,
    slug: row.slug,
    // Xellex builds its own URLs and needs the retired slugs to set up its own
    // redirects when a project is renamed on this side.
    slugHistory: row.slugHistory.map((h) => h.slug),
    publicName: o?.alias || row.publicName,
    developerName: row.developerName,
    developer: row.developer,
    developerAccount: { name: row.developerAccount.name, slug: row.developerAccount.slug },
    category: row.category, status: row.status,
    stage: o?.stage ?? row.stage,
    completion: o?.completion ?? row.completion,
    energy: o?.energy ?? row.energy,
    district: o?.district ?? row.district,
    town: o?.town ?? row.town,
    area: o?.area ?? row.area,
    priceFrom: row.priceFrom, priceTo: row.priceTo, currency: row.currency,
    latitude: o?.latitude ?? row.latitude,
    longitude: o?.longitude ?? row.longitude,
    unitsTotal: row.unitsTotal, unitsAvailable: row.unitsAvailable,
    soldOutSince: iso(row.soldOutSince),
    returnedToMarketAt: iso(row.returnedToMarketAt),
    description: row.description,
    amenities: o?.amenities ?? row.amenities,
    distances: row.distances,
    extraFacts: row.extraFacts,
    publishedAt: iso(row.publishedAt),
    updatedAt: row.updatedAt.toISOString(),
    override: o
      ? {
          alias: o.alias, heroVideo: o.heroVideo,
          descriptionEN: o.descriptionEN, descriptionDE: o.descriptionDE,
          descriptionPL: o.descriptionPL, descriptionRU: o.descriptionRU, descriptionHE: o.descriptionHE,
          promoBlocksEN: o.promoBlocksEN, promoBlocksDE: o.promoBlocksDE,
          promoBlocksPL: o.promoBlocksPL, promoBlocksRU: o.promoBlocksRU, promoBlocksHE: o.promoBlocksHE,
          seo: o.seo, vatApplies: o.vatApplies,
        }
      : null,
    mainImage: mainImage[0] ?? null,
    gallery,
    plans,
    units,
  };
}
```

**Note on Hebrew:** all five languages ship, `descriptionHE` / `promoBlocksHE` included — the operator confirmed this explicitly on 2026-10-09 when asked, after being told the override carries five languages and not the four the spec first said. `/he` has been live on CVE since 2026-09-26. This does not conflict with the standing rule never to *author or edit* Hebrew content: delivering an existing field is not authoring one. Do not drop these fields on the assumption they were an oversight.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → exit 0. The `satisfies Prisma.DevelopmentInclude` on `BRIDGE_INCLUDE` is what makes a typo in the include a compile error rather than a silently missing relation.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bridge/payload.ts docs/superpowers/plans/2026-10-09-xellex-bridge.md
git commit
```

---

## Task 4: The cursor and the removal list

**Files:**
- Create: `src/lib/bridge/query.ts`

**Interfaces:**
- Consumes: `BRIDGE_INCLUDE`, `DevelopmentWithRelations` from `payload.ts` (Task 3)
- Produces: `changedSince(since: Date | null, cursorId: string | null, limit: number): Promise<DevelopmentWithRelations[]>`, `removedSince(since: Date): Promise<string[]>`

- [ ] **Step 1: Write the module**

Create `src/lib/bridge/query.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { BRIDGE_INCLUDE, type DevelopmentWithRelations } from "./payload";

/**
 * Deliverable projects, optionally only those touched since `since`.
 *
 * The cursor spans three tables PLUS the developer's switch. A unit's price
 * changing does not touch its Development row, and an admin editing the German
 * description touches only the override — a cursor on Development.updatedAt
 * alone would deliver a project's first version and then never mention it again.
 *
 * The fourth branch is the one that is easy to miss, and it was missed in this
 * plan's first draft. Switching a developer ON is exactly as invisible as
 * switching it off: its projects' rows do not change, so none of the three
 * timestamps moves, and an incremental consumer would never learn they became
 * deliverable — they would reappear only on a full export, which this design
 * discourages. bridgeChangedAt means "the switch was last touched at T", and
 * both this query and removedSince() read it, in opposite directions.
 *
 * Paged by id rather than by any date: ids are stable and total-ordered, so a
 * row edited mid-pagination cannot jump between pages or be skipped. Page size
 * is a latency budget, not a payload one — 18.6 MB for all 344 projects is one
 * ordinary gzipped response, but assembling them means ~46,000 fs.stat calls,
 * and that belongs in seven requests rather than one held-open connection.
 */
export async function changedSince(
  since: Date | null,
  cursorId: string | null,
  limit: number,
): Promise<DevelopmentWithRelations[]> {
  return prisma.development.findMany({
    where: {
      publishStatus: "published",
      developerAccount: { bridgeEnabled: true },
      ...(since
        ? {
            OR: [
              { updatedAt: { gt: since } },
              { override: { updatedAt: { gt: since } } },
              { units: { some: { updatedAt: { gt: since } } } },
              // Re-enabled after `since`. The outer where already requires
              // bridgeEnabled: true, so this admits exactly "an enabled
              // developer whose switch was touched in this window" — the
              // mirror of removedSince()'s second source.
              { developerAccount: { bridgeChangedAt: { gt: since } } },
            ],
          }
        : {}),
    },
    include: BRIDGE_INCLUDE,
    orderBy: { id: "asc" },
    take: limit,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });
}

/**
 * Ids that were deliverable and are not any more. TWO sources, and the second
 * is the one that gets forgotten.
 *
 * 1. A project whose own row changed after `since` and which no longer
 *    qualifies — depublished or archived.
 * 2. EVERY project of a developer whose switch was last touched after `since`
 *    and is now off.
 *
 * Without (2) the removal is invisible: flipping a developer's switch writes
 * nothing to its Development rows, their updatedAt stays old, no incremental
 * call ever mentions them, and they stay live on the second portal forever.
 * That is the failure this list exists to prevent, and it is why
 * DeveloperAccount carries bridgeChangedAt at all.
 *
 * The list may contain ids Xellex never received — a project depublished under
 * a developer that was never enabled, for instance. That is deliberate:
 * tracking what was actually delivered would need a per-consumer ledger, and
 * an unknown id is a no-op on the receiving side.
 */
export async function removedSince(since: Date): Promise<string[]> {
  const rows = await prisma.development.findMany({
    where: {
      OR: [
        { publishStatus: { not: "published" }, updatedAt: { gt: since } },
        { developerAccount: { bridgeEnabled: false, bridgeChangedAt: { gt: since } } },
      ],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
```

- [ ] **Step 2: Verify the cursor logic against production**

Run: `npx tsc --noEmit` → exit 0.

Then prove the three-table cursor actually catches a unit-only change. Read-only — this reads timestamps, it does not write:

```bash
node --env-file=.env.local -e '
const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();
(async()=>{
  const d=await p.development.findFirst({where:{publishStatus:"published"},include:{units:{orderBy:{updatedAt:"desc"},take:1},override:true}});
  const dev=d.updatedAt, unit=d.units[0]?.updatedAt, ov=d.override?.updatedAt;
  console.log("development.updatedAt:",dev?.toISOString());
  console.log("newest unit.updatedAt:",unit?.toISOString()??"(none)");
  console.log("override.updatedAt  :",ov?.toISOString()??"(none)");
  console.log("a Development-only cursor would miss unit/override changes:",
    !!(unit&&unit>dev)||!!(ov&&ov>dev));
  await p.$disconnect();})();'
```

Report the three timestamps and whether any project in the sample has a unit or override newer than its development row — that is the concrete evidence the three-way `OR` is needed rather than assumed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bridge/query.ts docs/superpowers/plans/2026-10-09-xellex-bridge.md
git commit
```

---

## Task 5: The route

**Files:**
- Create: `src/app/api/bridge/projects/route.ts`

**Interfaces:**
- Consumes: `changedSince`, `removedSince` (Task 4); `buildProject`, `BridgeProject` (Task 3)
- Produces: `GET /api/bridge/projects` — the public contract

- [ ] **Step 1: Write the route**

Create `src/app/api/bridge/projects/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { changedSince, removedSince } from "@/lib/bridge/query";
import { buildProject, type BridgeProject } from "@/lib/bridge/payload";

export const dynamic = "force-dynamic";

/** 344 published projects today; seven pages. Sized by the ~46,000 fs.stat
 *  calls a full export costs, not by response bytes. If the catalogue doubles,
 *  lower this rather than letting the latency rise. */
const PAGE_SIZE = 50;

/**
 * The read-only bridge to Xellex, the operator's second public portal.
 * Spec: docs/superpowers/specs/2026-10-09-xellex-bridge-design.md
 *
 * Auth is a HEADER, deliberately unlike the cron routes' `?key=` — those run
 * from a local crontab, while this key lives in a third system and would
 * otherwise be written into every access log, proxy log and Referer along the
 * way.
 */
export async function GET(req: NextRequest) {
  const started = Date.now();
  const key = req.headers.get("x-api-key");
  if (!process.env.XELLEX_API_KEY || key !== process.env.XELLEX_API_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sinceRaw = req.nextUrl.searchParams.get("updatedSince");
  const cursor = req.nextUrl.searchParams.get("cursor");
  let since: Date | null = null;
  if (sinceRaw) {
    const d = new Date(sinceRaw);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "updatedSince is not a valid ISO 8601 timestamp" }, { status: 400 });
    }
    since = d;
  }

  // Taken BEFORE the queries. A change landing while this request runs must
  // fall inside the consumer's NEXT window, not vanish between the two.
  const generatedAt = new Date();

  try {
    const rows = await changedSince(since, cursor, PAGE_SIZE + 1);
    const page = rows.slice(0, PAGE_SIZE);
    const complete = rows.length <= PAGE_SIZE;
    const projects: BridgeProject[] = [];
    for (const row of page) projects.push(await buildProject(row));

    // Removals belong to the whole sync, not to a page: sent once, on the last
    // page, so a consumer that stops paginating early never acts on a partial
    // removal list. Meaningless without `since` — on a full export everything
    // absent is removed by definition.
    const removed = complete && since ? await removedSince(since) : [];

    const body = {
      generatedAt: generatedAt.toISOString(),
      complete,
      cursor: complete ? null : (page[page.length - 1]?.id ?? null),
      projects,
      removed,
    };

    await prisma.cronRunLog.create({
      data: {
        job: "xellex-bridge",
        ok: true,
        message: `${since ? "incremental" : "full"}: ${projects.length} projects, ${removed.length} removed, complete=${complete}`,
        durationMs: Date.now() - started,
      },
    });

    return NextResponse.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.cronRunLog
      .create({ data: { job: "xellex-bridge", ok: false, message: message.slice(0, 500), durationMs: Date.now() - started } })
      .catch(() => {});
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify `tsc`**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bridge/projects/route.ts docs/superpowers/plans/2026-10-09-xellex-bridge.md
git commit
```

---

## Task 6: The admin screen

**Files:**
- Create: `src/app/admin/(panel)/feeds/bridge/page.tsx`
- Create: `src/app/admin/(panel)/feeds/bridge/actions.ts`
- Modify: `src/app/admin/(panel)/layout.tsx` (one nav entry)

**Interfaces:**
- Consumes: `listBridgeDevelopers`, `setBridgeEnabled` (Task 1)

This task has no code fence: `src/app/admin/(panel)/feeds/page.tsx` is the styleguide. Read it first and match its layout, table shape, spacing and data-loading pattern. The requirements below are binding; the visual detail is yours.

- [ ] **Step 1: The server action**

`actions.ts`, following the admin auth pattern in `src/app/admin/actions.ts` exactly — `auth()`, then **re-validate against the DB** (`prisma.user.findUnique(... isActive)`) before acting. That re-validation is not boilerplate: without it a deactivated user keeps acting for the remainder of their JWT lifetime (audit M3). Name the helper for what it checks; `requireAdmin` is already taken in `actions.ts` by a stricter helper that also demands `role === "ADMIN"`, and the bridge screen sits under Analytics/Feeds, which is not role-gated.

The action takes `(slug: string, enabled: boolean)`, calls `setBridgeEnabled`, and `revalidatePath("/admin/feeds/bridge")`.

- [ ] **Step 2: The screen**

A table of all 25 developer accounts from `listBridgeDevelopers()`: name, slug, published-project count, a switch, and when it was last changed. Sorted with enabled developers first, then by name, so the deliverable set is readable at a glance.

Above the table, one line stating what the switch means in plain English — that turning a developer on publishes its projects to a second public website, and turning it off removes them there on Xellex's next sync. An admin must not have to read a spec to know that this screen is not a filter.

A developer with 0 published projects is shown but its switch is disabled, with the reason as a tooltip: enabling it would deliver nothing, and the row exists so nobody wonders where that developer went.

- [ ] **Step 3: The nav entry**

In `src/app/admin/(panel)/layout.tsx`, add `{ href: "/admin/feeds/bridge", label: "Xellex Bridge" }` to the module that already contains the Feeds pages. The sidebar matches longest-prefix, so this does not disturb the existing `/admin/feeds` entry — verify that claim in `Sidebar.tsx`'s `matchLen`/`resolveActive` before relying on it.

- [ ] **Step 4: Verify it compiles and renders**

Run: `npx tsc --noEmit` → exit 0.

Then start a dev server and load the route. `/admin/*` redirects to `/admin/login` before rendering, so you cannot see the page itself — do not try to authenticate, and do not use browser automation:

```bash
ln -sfn /Users/sashadith/cvp-analysis/node_modules node_modules
cp /Users/sashadith/cvp-analysis/.env.local .env.local
NEW_PROJECTS_INDEXABLE=true nohup npx next dev -p 3011 > /tmp/bridge-dev.log 2>&1 & disown
# wait for the port, then:
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:3011/admin/feeds/bridge
```

Expected: `307 -> http://localhost:3011/admin/login`, the route compiled in the dev log, and **no 500**. Note that the page will hit the `bridgeEnabled` column, which does not exist in production until the deploy — so expect a Prisma `P2022` and make sure the screen surfaces it as a readable "awaiting deploy" state rather than a crash.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(panel)/feeds/bridge/page.tsx" "src/app/admin/(panel)/feeds/bridge/actions.ts" "src/app/admin/(panel)/layout.tsx" docs/superpowers/plans/2026-10-09-xellex-bridge.md
git commit
```

---

## Task 7: End-to-end verification against production, then hand off

**Requires the production tunnel on `localhost:5433`** (`ssh -i ~/.ssh/cvp_vps -N -f -o ExitOnForwardFailure=yes -L 5433:localhost:5432 root@72.60.89.239`). Read-only.

**The blocker you will hit first, and it is expected:** `bridgeEnabled` does not exist in production until the migration is deployed, so `changedSince` cannot run end to end here. Verify everything that does not depend on that column, and say plainly in the hand-off which checks had to wait for the deploy. Do not work around it by applying the migration yourself.

- [ ] **Step 1: Verify the payload builder against a real project**

Temporary route `src/app/api/bridge-probe/route.ts` (created and deleted inside this task) that calls `buildProject` on one published development fetched with `BRIDGE_INCLUDE` — bypassing `changedSince`, so the missing column does not block it. Check, and report:

- the withheld fields are **absent** — grep the serialised output for `driveFolderId`, `feedKey`, `feedProjectId`, `syncedAt`, `developerAccountId`. **Any hit is a failure, and `driveFolderId` is the one that matters: it is an access token.**
- how many images resolved to three variants versus fewer, and whether any stored URL produced none
- the payload size of one project against the 370 KB measured for the largest

- [ ] **Step 2: Verify auth**

```bash
curl -s -o /dev/null -w "no key   -> %{http_code}\n" http://localhost:3011/api/bridge/projects
curl -s -o /dev/null -H "x-api-key: wrong" -w "bad key  -> %{http_code}\n" http://localhost:3011/api/bridge/projects
```
Expected: `401` both times, with `XELLEX_API_KEY` unset locally — which also proves the route fails closed when the variable is missing rather than letting everyone in.

- [ ] **Step 3: Delete the probe, clean up, build**

```bash
pkill -f "next dev -p 3011"; rm -rf src/app/api/bridge-probe .next
npx next build   # needs node_modules + .env.local in place
rm -rf .next node_modules .env.local
git status --porcelain   # must be empty
```

- [ ] **Step 4: Commit** (the probe route must not be in it)

- [ ] **Step 5: Hand off to the operator — deployment is their call, not yours**

State:
- **The deploy needs the migration flag:** `CVP_RUN_MIGRATE=1 ./scripts/deploy-prod.sh`, dry run first. Without it every query on `developer_accounts` 500s — that is the 2026-09-17 outage, ~15–20 minutes.
- **`XELLEX_API_KEY` must exist in `/var/www/shared/.env` before the deploy**, or the route returns 401 to everything. Generate it with `openssl rand -hex 32`; it is a new secret, not a copy of an existing key.
- **Every developer ships OFF.** Nothing reaches Xellex until someone turns a switch on, which is the intended first-run state — not a bug to fix after the deploy.
- The checks that could not run locally because the column was missing, listed explicitly, so the operator knows what is still unproven after the deploy.

---

## What this plan does not build

No push or webhooks. No write path from Xellex. No content other than developments — no blog, landing pages or case studies. No drafts. No per-project switch; the switch is per developer, as specified. No second consumer: the key, the log job name and the route are all single-tenant, and a second portal would be a new decision, not a configuration change.
