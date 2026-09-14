import { randomUUID } from "node:crypto";
import { hasHebrew } from "./localeTextGuards";
import type { HeTranslateInput, HeTranslateResult } from "./translateHe";

/* The queue side of the EN→HE volume translation (src/lib/ai/translateHe.ts).
 *
 * `AiGenerationQueue` rows carry the work; this module turns one row into one
 * translated field. Everything here is PURE with respect to its dependencies —
 * `processQueue` takes its prisma client and its translate function as `deps`,
 * so the tests drive it with in-memory arrays and a canned translator and never
 * touch a database or the Anthropic API. The cron route
 * (src/app/api/cron/he-translate/route.ts) is the only place that hands it the
 * real ones.
 *
 * Two rules the whole file exists to protect:
 *   - a non-empty Hebrew value is NEVER overwritten unless the queue row asks
 *     for it (`prompt === "force"`); the queue must not be able to wipe a human
 *     correction just because someone clicked "Enqueue missing" twice;
 *   - a failure is recorded on the row (`FAILED` + the message in `result`) and
 *     never swallowed, so the admin page can show what went wrong.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fn = (args: any) => Promise<any>;
/** A row as it comes back from the (untyped) delegate above. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** The slice of the Prisma client this module uses (fakes implement just this). */
export type QueuePrisma = {
  development: { findUnique: Fn; findMany: Fn };
  developmentOverride: { upsert: Fn };
  areaDescription: { findUnique: Fn; update: Fn; findMany: Fn };
  developer: { findUnique: Fn; findFirst: Fn; update: Fn; upsert: Fn; findMany: Fn };
  aiGenerationQueue: { update: Fn; create: Fn; findMany: Fn };
};

export const HE_ENTITY_TYPE = {
  developmentDescription: "development-description-he",
  developmentSeo: "development-seo-he",
  areaText: "area-text-he",
  developerProfile: "developer-profile-he",
} as const;

export type HeEntityType = (typeof HE_ENTITY_TYPE)[keyof typeof HE_ENTITY_TYPE];
export const HE_ENTITY_TYPES: HeEntityType[] = Object.values(HE_ENTITY_TYPE);

/** How many developments the deterministic sample covers (admin "Enqueue 15 sample"). */
export const SAMPLE_SIZE = 15;
/** Queue-row marker that permits overwriting an existing Hebrew value. */
export const FORCE = "force";

export type QueueRow = {
  id: string;
  entityType: string;
  entityId: string;
  prompt?: string | null;
};

export type ProcessDeps = {
  prisma: QueuePrisma;
  translate: (input: HeTranslateInput) => Promise<HeTranslateResult>;
  now?: () => Date;
};

export type ProcessSummary = {
  processed: number;
  done: number;
  failed: number;
  skipped: number;
};

/** The one write a handler can make to a row that is NOT the Hebrew one: the
 *  EN source row gains the `translationGroupId` it never had (same convention
 *  as `createTranslation`). Reported back so `processQueue` records it in the
 *  queue row's `result` instead of leaving it invisible. */
type EnGroupLink = { entity: string; enRowId: string; translationGroupId: string };

type Outcome = { skipped?: string; result?: HeTranslateResult; enGroupLink?: EnGroupLink };

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Queue-row prompt prefix noting a Hebrew developer sibling found by slug at
 * enqueue time. Lets `handleDeveloperProfile` update that exact row even when
 * it isn't (yet, or any more) linked by `translationGroupId` — the fallback
 * that matters if the EN slug drifts between enqueue and processing. */
const HE_SIBLING_PREFIX = "he-sibling:";

/** All text nodes inside a developer profile's `description` — Sanity portable
 * text (an array of blocks), an HTML string, or a plain string — flattened to
 * one string for a Hebrew-script check. Mirrors the `walk()` in
 * translateHe.ts's `outputStrings()`, minus the path bookkeeping it doesn't need. */
function developerDescriptionText(description: unknown): string {
  if (Array.isArray(description)) {
    const parts: string[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
          if (k === "text" && typeof v === "string") parts.push(v);
          else if (v && typeof v === "object") walk(v);
        }
      }
    };
    walk(description);
    return parts.join(" ");
  }
  if (typeof description === "string") return description.replace(/<[^>]+>/g, " ");
  return "";
}

/** A Hebrew developer row only counts as "has a real Hebrew profile" once it
 * actually contains Hebrew script in the excerpt or the description's text —
 * not merely once the row exists. An EN-copied row (e.g. from the manual
 * "create translation" admin flow, which copies the source verbatim) must not
 * count as done, or the queue would never pick it back up. */
export function hasHebrewDeveloperProfile(row: Row | null | undefined): boolean {
  if (!row) return false;
  return hasHebrew(str(row.excerpt)) || hasHebrew(developerDescriptionText(row.description));
}

/** Minimal fact list for a development — qualitative only, never a figure. */
function developmentFacts(d: Record<string, unknown>): string[] {
  const loc = [d.area, d.town, d.district].map(str).filter(Boolean);
  return [
    str(d.publicName) ? `Project name: ${str(d.publicName)}` : "",
    loc.length ? `Location: ${Array.from(new Set(loc)).join(", ")}, Cyprus` : "",
    str(d.category) ? `Property type: ${str(d.category)}` : "",
    str(d.stage) ? `Construction stage: ${str(d.stage)}` : "",
  ].filter(Boolean);
}

// ── per-entity handlers ─────────────────────────────────────────────────────

async function handleDevelopmentDescription(row: QueueRow, deps: ProcessDeps, force: boolean): Promise<Outcome> {
  const d = await deps.prisma.development.findUnique({ where: { id: row.entityId }, include: { override: true } });
  if (!d) throw new Error(`development ${row.entityId} not found`);
  const en = str(d.override?.descriptionEN) || str(d.description);
  if (!en) throw new Error("no English description to translate");
  if (str(d.override?.descriptionHE) && !force) return { skipped: "descriptionHE already filled" };

  const result = await deps.translate({ kind: "developmentDescription", en: { text: en }, facts: developmentFacts(d) });
  const he = str(result.he.text);
  if (!he) throw new Error("translator returned an empty description");
  await deps.prisma.developmentOverride.upsert({
    where: { developmentId: d.id },
    create: { developmentId: d.id, descriptionHE: he },
    update: { descriptionHE: he },
  });
  return { result };
}

async function handleDevelopmentSeo(row: QueueRow, deps: ProcessDeps, force: boolean): Promise<Outcome> {
  const d = await deps.prisma.development.findUnique({ where: { id: row.entityId }, include: { override: true } });
  if (!d) throw new Error(`development ${row.entityId} not found`);
  const seo = (d.override?.seo && typeof d.override.seo === "object" ? d.override.seo : {}) as Record<string, unknown>;
  const enTitle = str(seo.titleEN);
  const enDesc = str(seo.descEN);
  if (!enTitle && !enDesc) throw new Error("no English SEO meta to translate");
  if ((str(seo.titleHE) || str(seo.descHE)) && !force) return { skipped: "seo.titleHE/descHE already filled" };

  const result = await deps.translate({
    kind: "developmentSeo",
    en: { ...(enTitle ? { title: enTitle } : {}), ...(enDesc ? { description: enDesc } : {}) },
    facts: developmentFacts(d),
  });
  await deps.prisma.developmentOverride.upsert({
    where: { developmentId: d.id },
    create: { developmentId: d.id, seo: { ...seo, titleHE: str(result.he.title), descHE: str(result.he.description) } },
    update: { seo: { ...seo, titleHE: str(result.he.title), descHE: str(result.he.description) } },
  });
  return { result };
}

async function handleAreaText(row: QueueRow, deps: ProcessDeps, force: boolean): Promise<Outcome> {
  const a = await deps.prisma.areaDescription.findUnique({ where: { id: row.entityId } });
  if (!a) throw new Error(`area description ${row.entityId} not found`);
  const en = str(a.textEN);
  if (!en) throw new Error("no English area text to translate");
  if (str(a.textHE) && !force) return { skipped: "textHE already filled" };

  const result = await deps.translate({
    kind: "areaText",
    en: { text: en },
    facts: [str(a.areaName) ? `Area: ${str(a.areaName)}` : "", str(a.district) ? `District: ${str(a.district)}` : ""].filter(Boolean),
  });
  const he = str(result.he.text);
  if (!he) throw new Error("translator returned an empty area text");
  await deps.prisma.areaDescription.update({ where: { id: a.id }, data: { textHE: he } });
  return { result };
}

async function handleDeveloperProfile(row: QueueRow, deps: ProcessDeps, force: boolean): Promise<Outcome> {
  const en = await deps.prisma.developer.findUnique({ where: { id: row.entityId } });
  if (!en) throw new Error(`developer ${row.entityId} not found`);
  if (en.language === "he") throw new Error("queue row points at the Hebrew developer row, not the English source");

  // Same contract as createTranslation() in src/app/admin/actions.ts: the source
  // row owns the translation group, and gets one generated if it has none yet.
  let groupId: string = str(en.translationGroupId);
  let enGroupLink: EnGroupLink | undefined;
  if (!groupId) {
    groupId = randomUUID();
    await deps.prisma.developer.update({ where: { id: en.id }, data: { translationGroupId: groupId } });
    // Disclosed in the queue row's `result` — this is a write to the EN row.
    enGroupLink = { entity: "developer", enRowId: en.id, translationGroupId: groupId };
  }

  // Prefer the group-linked sibling; fall back to the one an earlier
  // enqueueMissing() noted by id (found by slug back then) if the group link
  // isn't there yet — covers a manually-created translation that never got a
  // translationGroupId, or one whose slug has since drifted from the EN row's.
  let heRow = await deps.prisma.developer.findFirst({ where: { translationGroupId: groupId, language: "he" } });
  if (!heRow && typeof row.prompt === "string" && row.prompt.startsWith(HE_SIBLING_PREFIX)) {
    heRow = await deps.prisma.developer.findUnique({ where: { id: row.prompt.slice(HE_SIBLING_PREFIX.length) } });
  }
  if (heRow && hasHebrewDeveloperProfile(heRow) && !force) {
    return { skipped: "Hebrew developer row already filled", enGroupLink };
  }

  const enSeo = (en.seo && typeof en.seo === "object" ? en.seo : {}) as Record<string, unknown>;
  const portable = Array.isArray(en.description) ? en.description : undefined;
  const plain = typeof en.description === "string" ? en.description : undefined;

  const result = await deps.translate({
    kind: "developerProfile",
    en: {
      slug: str(en.slug),
      title: str(en.title),
      ...(str(en.excerpt) ? { excerpt: str(en.excerpt) } : {}),
      ...(portable ? { portableText: portable } : {}),
      ...(plain ? { description: plain } : {}),
      ...(str(enSeo.metaTitle) || str(enSeo.metaDescription)
        ? { seo: { metaTitle: str(enSeo.metaTitle), metaDescription: str(enSeo.metaDescription) } }
        : {}),
    },
  });

  const heDescription = result.he.portableText ?? result.he.description;
  const data: Record<string, unknown> = {
    translationGroupId: groupId,
    title: str(en.title),
    ...(str(en.titleFull) ? { titleFull: str(en.titleFull) } : {}),
    ...(result.he.excerpt ? { excerpt: result.he.excerpt } : {}),
    ...(heDescription !== undefined ? { description: heDescription } : {}),
    ...(result.he.seo ? { seo: result.he.seo } : {}),
    ...(en.logo ? { logo: en.logo } : {}),
  };

  if (heRow) {
    // Update the row we already found, by id — never by slug. A slug-keyed
    // upsert here would silently create a second row (orphaning `heRow`) the
    // moment the EN slug and the Hebrew row's slug diverge; updating by id
    // can't miss the target no matter how the slugs have drifted.
    await deps.prisma.developer.update({ where: { id: heRow.id }, data });
  } else {
    await deps.prisma.developer.upsert({
      where: { language_slug: { language: "he", slug: str(en.slug) } },
      create: { ...data, sanityId: `he-${str(en.slug)}`, slug: str(en.slug), language: "he" },
      update: data,
    });
  }
  return { result, enGroupLink };
}

const HANDLERS: Record<string, (row: QueueRow, deps: ProcessDeps, force: boolean) => Promise<Outcome>> = {
  [HE_ENTITY_TYPE.developmentDescription]: handleDevelopmentDescription,
  [HE_ENTITY_TYPE.developmentSeo]: handleDevelopmentSeo,
  [HE_ENTITY_TYPE.areaText]: handleAreaText,
  [HE_ENTITY_TYPE.developerProfile]: handleDeveloperProfile,
};

// ── the processor ───────────────────────────────────────────────────────────

/** Translate one batch of PENDING queue rows. Never throws for a single bad row. */
export async function processQueue(rows: QueueRow[], deps: ProcessDeps): Promise<ProcessSummary> {
  const at = () => (deps.now ? deps.now() : new Date());
  const summary: ProcessSummary = { processed: 0, done: 0, failed: 0, skipped: 0 };

  for (const row of rows) {
    summary.processed++;
    const handler = HANDLERS[row.entityType];
    if (!handler) {
      summary.failed++;
      await deps.prisma.aiGenerationQueue.update({
        where: { id: row.id },
        data: { status: "FAILED", result: { error: `unknown entityType "${row.entityType}"` }, processedAt: at() },
      });
      continue;
    }
    try {
      const outcome = await handler(row, deps, row.prompt === FORCE);
      if (outcome.skipped) {
        summary.skipped++;
        summary.done++;
        await deps.prisma.aiGenerationQueue.update({
          where: { id: row.id },
          data: {
            status: "DONE",
            result: {
              skipped: true,
              reason: outcome.skipped,
              ...(outcome.enGroupLink ? { enGroupLink: outcome.enGroupLink } : {}),
            },
            processedAt: at(),
          },
        });
        continue;
      }
      summary.done++;
      await deps.prisma.aiGenerationQueue.update({
        where: { id: row.id },
        data: {
          status: "DONE",
          result: {
            he: (outcome.result?.he ?? {}) as Record<string, unknown>,
            critique: outcome.result?.critique ?? [],
            attempts: outcome.result?.attempts ?? 1,
            // Disclosed rather than silent: the EN source row was given the
            // translationGroupId it lacked (see EnGroupLink).
            ...(outcome.enGroupLink ? { enGroupLink: outcome.enGroupLink } : {}),
          },
          processedAt: at(),
        },
      });
    } catch (e) {
      summary.failed++;
      const error = e instanceof Error ? e.message : String(e);
      await deps.prisma.aiGenerationQueue.update({
        where: { id: row.id },
        data: { status: "FAILED", result: { error }, processedAt: at() },
      });
    }
  }
  return summary;
}

// ── enqueue helpers ─────────────────────────────────────────────────────────

export type EnqueueKind = "developments" | "areas" | "developers";

async function pendingKeys(prisma: QueuePrisma): Promise<Set<string>> {
  const rows: QueueRow[] = await prisma.aiGenerationQueue.findMany({ where: { status: "PENDING", locale: "he" } });
  return new Set(rows.map((r) => `${r.entityType}:${r.entityId}`));
}

async function enqueue(
  prisma: QueuePrisma,
  taken: Set<string>,
  entityType: HeEntityType,
  entityId: string,
  prompt?: string,
): Promise<boolean> {
  const key = `${entityType}:${entityId}`;
  if (taken.has(key)) return false;
  taken.add(key);
  await prisma.aiGenerationQueue.create({
    data: { entityType, entityId, locale: "he", status: "PENDING", ...(prompt ? { prompt } : {}) },
  });
  return true;
}

/** Queue every entity of `kind` that has no Hebrew value yet. Returns how many rows were added. */
export async function enqueueMissing(kind: EnqueueKind, prisma: QueuePrisma): Promise<{ created: number }> {
  const taken = await pendingKeys(prisma);
  let created = 0;

  if (kind === "developments") {
    const rows: Row[] = await prisma.development.findMany({
      where: { publishStatus: "published" },
      include: { override: true },
      orderBy: { publicName: "asc" },
    });
    for (const d of rows) {
      const seo = (d.override?.seo && typeof d.override.seo === "object" ? d.override.seo : {}) as Record<string, unknown>;
      const hasEnDescription = !!(str(d.override?.descriptionEN) || str(d.description));
      if (hasEnDescription && !str(d.override?.descriptionHE)) {
        if (await enqueue(prisma, taken, HE_ENTITY_TYPE.developmentDescription, d.id)) created++;
      }
      const hasEnSeo = !!(str(seo.titleEN) || str(seo.descEN));
      if (hasEnSeo && !str(seo.titleHE) && !str(seo.descHE)) {
        if (await enqueue(prisma, taken, HE_ENTITY_TYPE.developmentSeo, d.id)) created++;
      }
    }
    return { created };
  }

  if (kind === "areas") {
    const rows: Row[] = await prisma.areaDescription.findMany({ orderBy: { areaName: "asc" } });
    for (const a of rows) {
      if (str(a.textEN) && !str(a.textHE)) {
        if (await enqueue(prisma, taken, HE_ENTITY_TYPE.areaText, a.id)) created++;
      }
    }
    return { created };
  }

  const rows: Row[] = await prisma.developer.findMany({ orderBy: { title: "asc" } });
  const heRows = rows.filter((r) => r.language === "he");
  for (const d of rows) {
    if (d.language !== "en") continue;
    const sibling =
      heRows.find((r) => str(d.translationGroupId) && str(r.translationGroupId) === str(d.translationGroupId)) ??
      heRows.find((r) => str(r.slug) === str(d.slug)) ??
      null;
    // A sibling row's mere existence isn't "done" — a manually created
    // translation (createTranslation() in admin/actions.ts) copies the EN
    // text through verbatim, still English. Only real Hebrew script counts.
    if (sibling && hasHebrewDeveloperProfile(sibling)) continue;
    // Note the sibling's id (if any) on the row, so the processor updates it
    // by id instead of re-deriving it from the (possibly since-drifted) slug.
    const prompt = sibling ? `${HE_SIBLING_PREFIX}${sibling.id}` : undefined;
    if (await enqueue(prisma, taken, HE_ENTITY_TYPE.developerProfile, d.id, prompt)) created++;
  }
  return { created };
}

/** The deterministic 15-development sample: description + SEO rows for each. */
export async function enqueueSample(prisma: QueuePrisma, force = false): Promise<{ created: number }> {
  const taken = force ? new Set<string>() : await pendingKeys(prisma);
  const rows: Row[] = await prisma.development.findMany({
    where: { publishStatus: "published" },
    include: { override: true },
    orderBy: { publicName: "asc" },
    take: SAMPLE_SIZE,
  });
  let created = 0;
  for (const d of rows) {
    if (await enqueue(prisma, taken, HE_ENTITY_TYPE.developmentDescription, d.id, force ? FORCE : undefined)) created++;
    if (await enqueue(prisma, taken, HE_ENTITY_TYPE.developmentSeo, d.id, force ? FORCE : undefined)) created++;
  }
  return { created };
}

/** "Reject → re-enqueue with force" for one development (description + SEO). */
export async function enqueueForceForDevelopment(prisma: QueuePrisma, developmentId: string): Promise<{ created: number }> {
  const taken = new Set<string>();
  let created = 0;
  if (await enqueue(prisma, taken, HE_ENTITY_TYPE.developmentDescription, developmentId, FORCE)) created++;
  if (await enqueue(prisma, taken, HE_ENTITY_TYPE.developmentSeo, developmentId, FORCE)) created++;
  return { created };
}

/** "Reject → re-enqueue with force" for one developer profile — the per-row
 * counterpart to `enqueueForceForDevelopment` above, and the admin's path back
 * into the queue for a developer stuck behind a non-Hebrew sibling row. */
export async function enqueueForceForDeveloper(prisma: QueuePrisma, developerId: string): Promise<{ created: number }> {
  const taken = new Set<string>();
  const created = (await enqueue(prisma, taken, HE_ENTITY_TYPE.developerProfile, developerId, FORCE)) ? 1 : 0;
  return { created };
}

/** Force-enqueue every English developer's profile for re-translation, bypassing
 * both the no-overwrite check and the already-pending dedup — the bulk
 * counterpart to `enqueueForceForDeveloper`, mirroring `enqueueSample(force)`. */
export async function enqueueDevelopersForce(prisma: QueuePrisma): Promise<{ created: number }> {
  const taken = new Set<string>();
  const rows: Row[] = await prisma.developer.findMany({ orderBy: { title: "asc" } });
  let created = 0;
  for (const d of rows) {
    if (d.language !== "en") continue;
    if (await enqueue(prisma, taken, HE_ENTITY_TYPE.developerProfile, d.id, FORCE)) created++;
  }
  return { created };
}
