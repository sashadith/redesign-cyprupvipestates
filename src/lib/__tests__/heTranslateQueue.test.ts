import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HE_ENTITY_TYPE,
  enqueueDevelopersForce,
  enqueueForceForDeveloper,
  enqueueForceForDevelopment,
  enqueueMissing,
  enqueueSample,
  processQueue,
  type QueuePrisma,
  type QueueRow,
} from "@/lib/ai/heTranslateQueue";
import type { HeTranslateInput, HeTranslateResult } from "@/lib/ai/translateHe";

/* In-memory prisma double. The local DATABASE_URL points at PRODUCTION, so no
   test in this repo may open a client — these arrays are the whole database. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

type Seed = {
  developments?: Row[];
  overrides?: Row[];
  areas?: Row[];
  developers?: Row[];
  queue?: Row[];
};

function fakePrisma(seed: Seed) {
  const developments = seed.developments ?? [];
  const overrides = seed.overrides ?? [];
  const areas = seed.areas ?? [];
  const developers = seed.developers ?? [];
  const queue = seed.queue ?? [];

  const withOverride = (d: Row) => ({ ...d, override: overrides.find((o) => o.developmentId === d.id) ?? null });
  const matches = (row: Row, where: Row = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && "in" in v) return (v.in as unknown[]).includes(row[k]);
      return row[k] === v;
    });

  const prisma: QueuePrisma = {
    development: {
      findUnique: async ({ where }) => {
        const d = developments.find((x) => x.id === where.id);
        return d ? withOverride(d) : null;
      },
      findMany: async ({ where, take } = {}) => {
        const out = developments
          .filter((d) => matches(d, where))
          .sort((a, b) => String(a.publicName).localeCompare(String(b.publicName)))
          .map(withOverride);
        return take ? out.slice(0, take) : out;
      },
    },
    developmentOverride: {
      upsert: async ({ where, create, update }) => {
        const existing = overrides.find((o) => o.developmentId === where.developmentId);
        if (existing) Object.assign(existing, update);
        else overrides.push({ ...create });
        return existing ?? overrides[overrides.length - 1];
      },
    },
    areaDescription: {
      findUnique: async ({ where }) => areas.find((a) => a.id === where.id) ?? null,
      update: async ({ where, data }) => {
        const a = areas.find((x) => x.id === where.id);
        assert.ok(a, "areaDescription.update on a missing row");
        Object.assign(a, data);
        return a;
      },
      findMany: async () => [...areas].sort((a, b) => String(a.areaName).localeCompare(String(b.areaName))),
    },
    developer: {
      findUnique: async ({ where }) => developers.find((d) => d.id === where.id) ?? null,
      findFirst: async ({ where }) => developers.find((d) => matches(d, where)) ?? null,
      update: async ({ where, data }) => {
        const d = developers.find((x) => x.id === where.id);
        assert.ok(d, "developer.update on a missing row");
        Object.assign(d, data);
        return d;
      },
      upsert: async ({ where, create, update }) => {
        const { language, slug } = where.language_slug;
        const existing = developers.find((d) => d.language === language && d.slug === slug);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { id: `dev-he-${slug}`, ...create };
        developers.push(row);
        return row;
      },
      findMany: async () => [...developers].sort((a, b) => String(a.title).localeCompare(String(b.title))),
    },
    aiGenerationQueue: {
      findMany: async ({ where } = {}) => queue.filter((q) => matches(q, where)),
      create: async ({ data }) => {
        const row = { id: `q${queue.length + 1}`, createdAt: new Date(), processedAt: null, ...data };
        queue.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const q = queue.find((x) => x.id === where.id);
        assert.ok(q, "aiGenerationQueue.update on a missing row");
        Object.assign(q, data);
        return q;
      },
    },
  };
  return { prisma, developments, overrides, areas, developers, queue };
}

const HE = "דירה במרחק הליכה מהים, עם מרפסת רחבה.";
const HE_2 = "דירה קרובה לים, עם נוף אל המפרץ.";

/** Canned translator: echoes a fixed Hebrew payload and records what it was asked. */
function fakeTranslate(he: Partial<HeTranslateResult["he"]>, calls: HeTranslateInput[] = []) {
  return {
    calls,
    translate: async (input: HeTranslateInput): Promise<HeTranslateResult> => {
      calls.push(input);
      return { he: he as HeTranslateResult["he"], critique: ["tightened the phrasing"], attempts: 1 };
    },
  };
}

const row = (over: Partial<QueueRow> & Pick<QueueRow, "entityType" | "entityId">): QueueRow => ({
  id: "q1",
  prompt: null,
  ...over,
});

const NOW = new Date("2026-09-13T10:00:00.000Z");
const now = () => NOW;

// ── per-entity writes ───────────────────────────────────────────────────────

test("processQueue writes descriptionHE and marks the row DONE", async () => {
  const f = fakePrisma({
    developments: [{ id: "d1", publicName: "Azure Living", area: "Germasogeia", district: "Limassol", description: "An English description." }],
    overrides: [{ developmentId: "d1", descriptionEN: "A two-bedroom apartment by the sea." }],
    queue: [{ id: "q1", entityType: HE_ENTITY_TYPE.developmentDescription, entityId: "d1", status: "PENDING" }],
  });
  const t = fakeTranslate({ text: HE });
  const summary = await processQueue([row({ entityType: HE_ENTITY_TYPE.developmentDescription, entityId: "d1" })], {
    prisma: f.prisma,
    translate: t.translate,
    now,
  });

  assert.deepEqual(summary, { processed: 1, done: 1, failed: 0, skipped: 0 });
  assert.equal(f.overrides[0].descriptionHE, HE);
  assert.equal(f.queue[0].status, "DONE");
  assert.equal(f.queue[0].processedAt, NOW);
  assert.deepEqual(f.queue[0].result.critique, ["tightened the phrasing"]);
  // The English override text wins over the raw feed description.
  assert.equal(t.calls[0].en.text, "A two-bedroom apartment by the sea.");
  assert.match(t.calls[0].facts?.join(" ") ?? "", /Germasogeia, Limassol, Cyprus/);
});

test("processQueue merges titleHE/descHE into the existing seo JSON without losing the other locales", async () => {
  const f = fakePrisma({
    developments: [{ id: "d1", publicName: "Azure Living" }],
    overrides: [{ developmentId: "d1", seo: { titleEN: "Azure Living apartments", descEN: "Sea-view homes.", titleDE: "Wohnungen" } }],
    queue: [{ id: "q1", entityType: HE_ENTITY_TYPE.developmentSeo, entityId: "d1", status: "PENDING" }],
  });
  const t = fakeTranslate({ title: HE, description: HE_2 });
  await processQueue([row({ entityType: HE_ENTITY_TYPE.developmentSeo, entityId: "d1" })], { prisma: f.prisma, translate: t.translate, now });

  assert.equal(f.overrides[0].seo.titleHE, HE);
  assert.equal(f.overrides[0].seo.descHE, HE_2);
  assert.equal(f.overrides[0].seo.titleDE, "Wohnungen", "existing locales must survive the merge");
  assert.equal(f.overrides[0].seo.titleEN, "Azure Living apartments");
});

test("processQueue writes AreaDescription.textHE", async () => {
  const f = fakePrisma({
    areas: [{ id: "a1", areaSlug: "germasogeia", areaName: "Germasogeia", district: "Limassol", textEN: "A coastal suburb." }],
    queue: [{ id: "q1", entityType: HE_ENTITY_TYPE.areaText, entityId: "a1", status: "PENDING" }],
  });
  const t = fakeTranslate({ text: HE });
  await processQueue([row({ entityType: HE_ENTITY_TYPE.areaText, entityId: "a1" })], { prisma: f.prisma, translate: t.translate, now });

  assert.equal(f.areas[0].textHE, HE);
  assert.equal(t.calls[0].kind, "areaText");
});

test("processQueue creates the Hebrew developer row in the English row's translation group", async () => {
  const portable = [{ _type: "block", _key: "b1", children: [{ _type: "span", _key: "s1", text: "Founded in Limassol.", marks: [] }] }];
  const f = fakePrisma({
    developers: [
      {
        id: "dev1", language: "en", slug: "cyfield", title: "Cyfield", translationGroupId: "grp-1",
        excerpt: "A Cypriot developer.", description: portable, seo: { metaTitle: "Cyfield", metaDescription: "Homes by Cyfield." },
      },
    ],
    queue: [{ id: "q1", entityType: HE_ENTITY_TYPE.developerProfile, entityId: "dev1", status: "PENDING" }],
  });
  const hePortable = [{ _type: "block", _key: "b1", children: [{ _type: "span", _key: "s1", text: HE, marks: [] }] }];
  const t = fakeTranslate({ slug: "cyfield", title: "Cyfield", excerpt: HE_2, portableText: hePortable, seo: { metaTitle: HE, metaDescription: HE_2 } });
  await processQueue([row({ entityType: HE_ENTITY_TYPE.developerProfile, entityId: "dev1" })], { prisma: f.prisma, translate: t.translate, now });

  const he = f.developers.find((d) => d.language === "he");
  assert.ok(he, "a Hebrew developer row should have been created");
  assert.equal(he.slug, "cyfield", "the slug stays Latin");
  assert.equal(he.sanityId, "he-cyfield");
  assert.equal(he.translationGroupId, "grp-1");
  assert.equal(he.excerpt, HE_2);
  assert.deepEqual(he.description, hePortable);
});

test("processQueue gives an ungrouped English developer a translation group before translating", async () => {
  const f = fakePrisma({
    developers: [{ id: "dev1", language: "en", slug: "cyfield", title: "Cyfield", excerpt: "A Cypriot developer.", translationGroupId: null }],
    queue: [{ id: "q1", entityType: HE_ENTITY_TYPE.developerProfile, entityId: "dev1", status: "PENDING" }],
  });
  const t = fakeTranslate({ slug: "cyfield", title: "Cyfield", excerpt: HE });
  await processQueue([row({ entityType: HE_ENTITY_TYPE.developerProfile, entityId: "dev1" })], { prisma: f.prisma, translate: t.translate, now });

  const en = f.developers.find((d) => d.language === "en");
  const he = f.developers.find((d) => d.language === "he");
  assert.ok(en);
  assert.ok(he);
  assert.ok(en.translationGroupId, "the English row gets a group id");
  assert.equal(he.translationGroupId, en.translationGroupId);

  // …and that write to a NON-Hebrew row is disclosed in the queue row's result.
  const done = f.queue.find((q) => q.id === "q1");
  const link = (done?.result as { enGroupLink?: { entity: string; enRowId: string; translationGroupId: string } })?.enGroupLink;
  assert.deepEqual(link, { entity: "developer", enRowId: "dev1", translationGroupId: en.translationGroupId });
});

test("processQueue reports no enGroupLink when the English developer already has a translation group", async () => {
  const f = fakePrisma({
    developers: [{ id: "dev1", language: "en", slug: "cyfield", title: "Cyfield", excerpt: "A Cypriot developer.", translationGroupId: "grp-1" }],
    queue: [{ id: "q1", entityType: HE_ENTITY_TYPE.developerProfile, entityId: "dev1", status: "PENDING" }],
  });
  const t = fakeTranslate({ slug: "cyfield", title: "Cyfield", excerpt: HE });
  await processQueue([row({ entityType: HE_ENTITY_TYPE.developerProfile, entityId: "dev1" })], { prisma: f.prisma, translate: t.translate, now });

  const done = f.queue.find((q) => q.id === "q1");
  assert.equal((done?.result as Record<string, unknown>)?.enGroupLink, undefined);
});

// ── the no-overwrite rule ───────────────────────────────────────────────────

test("processQueue skips a development whose Hebrew description is already filled", async () => {
  const f = fakePrisma({
    developments: [{ id: "d1", publicName: "Azure Living" }],
    overrides: [{ developmentId: "d1", descriptionEN: "English text.", descriptionHE: "טקסט קיים בעברית." }],
    queue: [{ id: "q1", entityType: HE_ENTITY_TYPE.developmentDescription, entityId: "d1", status: "PENDING" }],
  });
  const t = fakeTranslate({ text: HE });
  const summary = await processQueue([row({ entityType: HE_ENTITY_TYPE.developmentDescription, entityId: "d1" })], {
    prisma: f.prisma, translate: t.translate, now,
  });

  assert.deepEqual(summary, { processed: 1, done: 1, failed: 0, skipped: 1 });
  assert.equal(t.calls.length, 0, "no model call for a skipped row");
  assert.equal(f.overrides[0].descriptionHE, "טקסט קיים בעברית.");
  assert.equal(f.queue[0].status, "DONE");
  assert.equal(f.queue[0].result.skipped, true);
  assert.match(f.queue[0].result.reason, /already filled/);
});

test('prompt "force" overwrites an existing Hebrew value', async () => {
  const f = fakePrisma({
    developments: [{ id: "d1", publicName: "Azure Living" }],
    overrides: [{ developmentId: "d1", descriptionEN: "English text.", descriptionHE: "טקסט קיים בעברית." }],
    queue: [{ id: "q1", entityType: HE_ENTITY_TYPE.developmentDescription, entityId: "d1", status: "PENDING", prompt: "force" }],
  });
  const t = fakeTranslate({ text: HE });
  const summary = await processQueue([row({ entityType: HE_ENTITY_TYPE.developmentDescription, entityId: "d1", prompt: "force" })], {
    prisma: f.prisma, translate: t.translate, now,
  });

  assert.equal(summary.skipped, 0);
  assert.equal(f.overrides[0].descriptionHE, HE);
});

// ── failures ────────────────────────────────────────────────────────────────

test("processQueue marks a row FAILED with the translator's error message and keeps going", async () => {
  const f = fakePrisma({
    developments: [{ id: "d1", publicName: "Azure Living" }, { id: "d2", publicName: "Blue Bay" }],
    overrides: [
      { developmentId: "d1", descriptionEN: "English text." },
      { developmentId: "d2", descriptionEN: "More English text." },
    ],
    queue: [
      { id: "q1", entityType: HE_ENTITY_TYPE.developmentDescription, entityId: "d1", status: "PENDING" },
      { id: "q2", entityType: HE_ENTITY_TYPE.developmentDescription, entityId: "d2", status: "PENDING" },
    ],
  });
  let call = 0;
  const summary = await processQueue(
    [
      row({ id: "q1", entityType: HE_ENTITY_TYPE.developmentDescription, entityId: "d1" }),
      row({ id: "q2", entityType: HE_ENTITY_TYPE.developmentDescription, entityId: "d2" }),
    ],
    {
      prisma: f.prisma,
      now,
      translate: async (): Promise<HeTranslateResult> => {
        if (++call === 1) throw new Error("Hebrew translation failed after 2 attempt(s): em-dash");
        return { he: { text: HE }, critique: [], attempts: 1 };
      },
    },
  );

  assert.deepEqual(summary, { processed: 2, done: 1, failed: 1, skipped: 0 });
  assert.equal(f.queue[0].status, "FAILED");
  assert.match(f.queue[0].result.error, /em-dash/);
  assert.equal(f.queue[0].processedAt, NOW);
  assert.equal(f.queue[1].status, "DONE");
});

test("processQueue fails a row whose English source is missing, without calling the model", async () => {
  const f = fakePrisma({
    developments: [{ id: "d1", publicName: "Azure Living" }],
    queue: [{ id: "q1", entityType: HE_ENTITY_TYPE.developmentSeo, entityId: "d1", status: "PENDING" }],
  });
  const t = fakeTranslate({ title: HE });
  const summary = await processQueue([row({ entityType: HE_ENTITY_TYPE.developmentSeo, entityId: "d1" })], {
    prisma: f.prisma, translate: t.translate, now,
  });

  assert.equal(summary.failed, 1);
  assert.equal(t.calls.length, 0);
  assert.match(f.queue[0].result.error, /no English SEO meta/);
});

test("processQueue fails an unknown entityType instead of throwing", async () => {
  const f = fakePrisma({ queue: [{ id: "q1", entityType: "nonsense", entityId: "x", status: "PENDING" }] });
  const t = fakeTranslate({ text: HE });
  const summary = await processQueue([row({ entityType: "nonsense", entityId: "x" })], { prisma: f.prisma, translate: t.translate, now });
  assert.equal(summary.failed, 1);
  assert.match(f.queue[0].result.error, /unknown entityType/);
});

// ── enqueue helpers ─────────────────────────────────────────────────────────

test("enqueueMissing(developments) queues only what has English and lacks Hebrew, and never duplicates a pending row", async () => {
  const f = fakePrisma({
    developments: [
      { id: "d1", publicName: "Azure Living", publishStatus: "published" },
      { id: "d2", publicName: "Blue Bay", publishStatus: "published" },
      { id: "d3", publicName: "Coral Court", publishStatus: "draft" },
    ],
    overrides: [
      { developmentId: "d1", descriptionEN: "English text.", seo: { titleEN: "Azure", descEN: "Homes." } },
      { developmentId: "d2", descriptionEN: "English text.", descriptionHE: "כבר תורגם." },
    ],
  });

  // d1: English description + English meta, no Hebrew → both kinds queued.
  // d2: Hebrew description already there, no English meta → nothing queued.
  // d3: draft → out of scope entirely.
  const first = await enqueueMissing("developments", f.prisma);
  assert.equal(first.created, 2);
  assert.deepEqual(
    f.queue.map((q) => `${q.entityType}:${q.entityId}`).sort(),
    [`${HE_ENTITY_TYPE.developmentDescription}:d1`, `${HE_ENTITY_TYPE.developmentSeo}:d1`].sort(),
  );

  const second = await enqueueMissing("developments", f.prisma);
  assert.equal(second.created, 0, "a second click adds nothing");
});

test("enqueueMissing(areas) and enqueueMissing(developers) queue the right rows", async () => {
  const f = fakePrisma({
    areas: [
      { id: "a1", areaName: "Germasogeia", textEN: "A coastal suburb." },
      { id: "a2", areaName: "Kato Paphos", textEN: "A seafront quarter.", textHE: "רובע חוף." },
      { id: "a3", areaName: "Zakaki", textEN: "" },
    ],
    developers: [
      { id: "dev1", language: "en", slug: "cyfield", title: "Cyfield", translationGroupId: "g1" },
      { id: "dev2", language: "en", slug: "pafilia", title: "Pafilia", translationGroupId: "g2" },
      // dev3 has a real Hebrew excerpt — a sibling only counts as "done" once
      // it actually contains Hebrew script, not merely by existing.
      { id: "dev3", language: "he", slug: "pafilia", title: "Pafilia", translationGroupId: "g2", excerpt: HE },
    ],
  });

  assert.equal((await enqueueMissing("areas", f.prisma)).created, 1);
  assert.equal(f.queue[0].entityId, "a1");
  assert.equal((await enqueueMissing("developers", f.prisma)).created, 1);
  assert.equal(f.queue[1].entityId, "dev1");
});

test("enqueueSample queues description + SEO rows for the first 15 published developments, by name", async () => {
  const f = fakePrisma({
    developments: Array.from({ length: 20 }, (_, i) => ({
      id: `d${i}`,
      publicName: `Project ${String(20 - i).padStart(2, "0")}`,
      publishStatus: i === 19 ? "draft" : "published",
    })),
  });
  const { created } = await enqueueSample(f.prisma);
  assert.equal(created, 30, "15 developments × (description + seo)");
  const names = new Set(f.queue.map((q) => q.entityId));
  assert.equal(names.size, 15);
  // Ordered by publicName ascending: "Project 01" is d19 — but d19 is a draft,
  // so the sample starts at "Project 02" (d18).
  assert.ok(names.has("d18"));
  assert.ok(!names.has("d19"));
});

test("enqueueForceForDevelopment queues both kinds with the force marker", async () => {
  const f = fakePrisma({ developments: [{ id: "d1", publicName: "Azure Living", publishStatus: "published" }] });
  const { created } = await enqueueForceForDevelopment(f.prisma, "d1");
  assert.equal(created, 2);
  assert.ok(f.queue.every((q) => q.prompt === "force" && q.locale === "he" && q.status === "PENDING"));
});

// ── developer "has a real Hebrew profile" gating ────────────────────────────
// A manually-created translation (createTranslation() in admin/actions.ts)
// copies the EN title/excerpt/description through verbatim — still English.
// The queue must see through that and not treat the row's mere existence as done.

test("enqueueMissing(developers) queues an EN-copied Hebrew sibling but not one with real Hebrew script, noting the sibling's id", async () => {
  const f = fakePrisma({
    developers: [
      // dev1's sibling exists but is an EN copy (no Hebrew script anywhere) → must be queued.
      { id: "dev1", language: "en", slug: "cyfield", title: "Cyfield", translationGroupId: "g1", excerpt: "A Cypriot developer." },
      { id: "dev1-he", language: "he", slug: "cyfield", title: "Cyfield", translationGroupId: "g1", excerpt: "A Cypriot developer." },
      // dev2's sibling has a real Hebrew excerpt → already done, must not be queued.
      { id: "dev2", language: "en", slug: "pafilia", title: "Pafilia", translationGroupId: "g2", excerpt: "A developer." },
      { id: "dev2-he", language: "he", slug: "pafilia", title: "Pafilia", translationGroupId: "g2", excerpt: HE },
    ],
  });

  const { created } = await enqueueMissing("developers", f.prisma);
  assert.equal(created, 1, "only the EN-copied sibling's English row is queued");
  assert.equal(f.queue[0].entityId, "dev1");
  assert.equal(f.queue[0].prompt, "he-sibling:dev1-he", "the sibling's id is noted so the processor updates it, not creates a duplicate");
});

test('prompt "force" re-translates a developer that already has a real Hebrew sibling, and updates it by id', async () => {
  const f = fakePrisma({
    developers: [
      { id: "dev1", language: "en", slug: "cyfield", title: "Cyfield", translationGroupId: "g1", excerpt: "A Cypriot developer." },
      { id: "dev1-he", language: "he", slug: "cyfield", title: "Cyfield", translationGroupId: "g1", excerpt: HE },
    ],
    queue: [{ id: "q1", entityType: HE_ENTITY_TYPE.developerProfile, entityId: "dev1", status: "PENDING", prompt: "force" }],
  });
  const t = fakeTranslate({ slug: "cyfield", title: "Cyfield", excerpt: HE_2 });
  const summary = await processQueue(
    [row({ entityType: HE_ENTITY_TYPE.developerProfile, entityId: "dev1", prompt: "force" })],
    { prisma: f.prisma, translate: t.translate, now },
  );

  assert.equal(summary.skipped, 0, "force bypasses the already-has-real-Hebrew skip");
  assert.equal(f.developers.filter((d) => d.language === "he").length, 1, "no duplicate row created");
  const he = f.developers.find((d) => d.id === "dev1-he");
  assert.ok(he);
  assert.equal(he.excerpt, HE_2, "the existing row was updated in place");
});

test("handleDeveloperProfile updates the Hebrew sibling by id even when its slug has drifted from the EN slug", async () => {
  const f = fakePrisma({
    developers: [
      // The EN slug changed after the Hebrew row was created; both still share translationGroupId "g1".
      { id: "dev1", language: "en", slug: "cyfield-new-slug", title: "Cyfield", translationGroupId: "g1", excerpt: "A Cypriot developer." },
      { id: "dev1-he", language: "he", slug: "cyfield-old-slug", title: "Cyfield", translationGroupId: "g1", excerpt: "A Cypriot developer." },
    ],
    queue: [{ id: "q1", entityType: HE_ENTITY_TYPE.developerProfile, entityId: "dev1", status: "PENDING" }],
  });
  const t = fakeTranslate({ slug: "cyfield-new-slug", title: "Cyfield", excerpt: HE });
  await processQueue([row({ entityType: HE_ENTITY_TYPE.developerProfile, entityId: "dev1" })], { prisma: f.prisma, translate: t.translate, now });

  assert.equal(f.developers.filter((d) => d.language === "he").length, 1, "no second row created under the new slug");
  const he = f.developers.find((d) => d.id === "dev1-he");
  assert.ok(he);
  assert.equal(he.excerpt, HE, "the original row, found via translationGroupId, was updated in place");
  assert.equal(he.slug, "cyfield-old-slug", "the drifted slug itself is left untouched");
});

test("enqueueMissing's noted sibling id is used by the processor even without a translationGroupId link", async () => {
  const f = fakePrisma({
    developers: [
      { id: "dev1", language: "en", slug: "cyfield", title: "Cyfield", excerpt: "A Cypriot developer." },
      // Same slug, but never linked via translationGroupId (e.g. an older manual translation).
      { id: "dev1-he", language: "he", slug: "cyfield", title: "Cyfield", excerpt: "A Cypriot developer." },
    ],
  });

  await enqueueMissing("developers", f.prisma);
  assert.equal(f.queue.length, 1);
  assert.equal(f.queue[0].prompt, "he-sibling:dev1-he");

  const t = fakeTranslate({ slug: "cyfield", title: "Cyfield", excerpt: HE });
  await processQueue(
    [row({ entityType: HE_ENTITY_TYPE.developerProfile, entityId: "dev1", prompt: f.queue[0].prompt })],
    { prisma: f.prisma, translate: t.translate, now },
  );

  assert.equal(f.developers.filter((d) => d.language === "he").length, 1, "no duplicate created despite the missing group link");
  const he = f.developers.find((d) => d.id === "dev1-he");
  assert.ok(he);
  assert.equal(he.excerpt, HE);
});

test("enqueueForceForDeveloper and enqueueDevelopersForce queue developer profile rows with the force marker", async () => {
  const f = fakePrisma({
    developers: [
      { id: "dev1", language: "en", slug: "cyfield", title: "Cyfield" },
      { id: "dev2", language: "en", slug: "pafilia", title: "Pafilia" },
      { id: "dev3", language: "he", slug: "pafilia-he", title: "Pafilia" },
    ],
  });

  const single = await enqueueForceForDeveloper(f.prisma, "dev1");
  assert.equal(single.created, 1);
  assert.equal(f.queue[0].entityId, "dev1");
  assert.equal(f.queue[0].prompt, "force");

  const bulk = await enqueueDevelopersForce(f.prisma);
  assert.equal(bulk.created, 2, "every EN developer, ignoring pending/Hebrew status");
  assert.ok(f.queue.every((q) => q.entityType === HE_ENTITY_TYPE.developerProfile && q.prompt === "force"));
});
