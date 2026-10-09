import { test } from "node:test";
import assert from "node:assert/strict";
import {
  developerImpact,
  deactivateDeveloperGroup,
  reactivateDeveloperGroup,
  deleteDeveloperGroup,
  deleteConfirmationMatches,
  groupWhere,
} from "@/lib/developerLifecycle";
import { localizedHref } from "@/lib/locale";

/* 2026-10-09: public developer pages can be deactivated (308 to /developers)
   or deleted from the admin. Every operation acts on the whole translation
   group; archiving the developer's projects is opt-in. */

type Rec = Record<string, any>;

function matches(rec: Rec, where: Rec = {}): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("in" in v) return v.in.includes(rec[k]);
      if ("not" in v) return rec[k] !== v.not;
    }
    return rec[k] === v;
  });
}

function table(rows: Rec[]) {
  return {
    rows,
    findUnique: async ({ where }: any) => rows.find((r) => matches(r, where)) ?? null,
    findFirst: async ({ where }: any) => rows.find((r) => matches(r, where)) ?? null,
    findMany: async ({ where }: any = {}) => rows.filter((r) => matches(r, where)),
    count: async ({ where }: any = {}) => rows.filter((r) => matches(r, where)).length,
    updateMany: async ({ where, data }: any) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
    deleteMany: async ({ where }: any) => {
      const keep = rows.filter((r) => !matches(r, where));
      const n = rows.length - keep.length;
      rows.splice(0, rows.length, ...keep);
      return { count: n };
    },
  };
}

function fixture() {
  const dev = (id: string, language: string, extra: Rec = {}) =>
    ({ id, translationGroupId: "g1", language, slug: "acme", title: language === "en" ? "Acme Homes" : `Acme ${language}`, deactivatedAt: null, ...extra });
  const db: any = {
    developer: table([dev("en1", "en"), dev("de1", "de"), dev("pl1", "pl"), { id: "solo", translationGroupId: null, language: "en", slug: "solo", title: "Solo", deactivatedAt: null }, { ...dev("x", "en"), translationGroupId: "g2", slug: "other", title: "Other" }]),
    developerAccount: table([{ id: "acc1", name: "Acme (feed)", developerTranslationGroupId: "g1" }, { id: "acc2", name: "Other", developerTranslationGroupId: "g2" }]),
    development: table([
      { id: "d1", developerAccountId: "acc1", publishStatus: "published", slug: "acme-one", publicName: "Acme One", publishedAt: new Date() },
      { id: "d2", developerAccountId: "acc1", publishStatus: "draft", slug: null, publicName: "Acme Two", publishedAt: null },
      { id: "d3", developerAccountId: "acc2", publishStatus: "published", slug: "other-one", publicName: "Other One", publishedAt: new Date() },
    ]),
    project: table([
      { id: "p1", developerId: "en1", status: "PUBLISHED", language: "en", slug: "old-acme" },
      { id: "p2", developerId: "de1", status: "PUBLISHED", language: "de", slug: "old-acme" },
      { id: "p3", developerId: "en1", status: "ARCHIVED", language: "en", slug: "older-acme" },
      { id: "p4", developerId: "x", status: "PUBLISHED", language: "en", slug: "other-old" },
    ]),
    aiGenerationQueue: table([
      { id: "q1", entityId: "en1", status: "PENDING" },
      { id: "q2", entityId: "en1", status: "DONE" },
      { id: "q3", entityId: "x", status: "PENDING" },
    ]),
    legacyProjectRedirect: table([
      { id: "r1", projectId: "p3", targetPath: localizedHref("en", ["developers", "acme"]) },
      { id: "r2", projectId: "p9", targetPath: localizedHref("de", ["developers", "acme"]) },
      { id: "r3", projectId: "p8", targetPath: localizedHref("en", ["developers", "other"]) },
      { id: "r4", projectId: "p7", targetPath: localizedHref("en", ["projects", "acme-one"]) },
    ]),
  };
  db.$transaction = (ops: Promise<unknown>[]) => Promise.all(ops);
  return db;
}

test("groupWhere: the group when there is one, the row alone otherwise", () => {
  assert.deepEqual(groupWhere({ id: "a", translationGroupId: "g" }), { translationGroupId: "g" });
  assert.deepEqual(groupWhere({ id: "a", translationGroupId: null }), { id: "a" });
});

test("impact counts the whole group from any language row", async () => {
  const i = await developerImpact(fixture(), "de1");
  assert.equal(i.title, "Acme Homes"); // EN title, even when opened from DE
  assert.deepEqual(i.rows.map((r) => r.id).sort(), ["de1", "en1", "pl1"]);
  assert.deepEqual(i.account, { id: "acc1", name: "Acme (feed)" });
  assert.deepEqual(i.publishedDevelopments.map((d) => d.id), ["d1"]);
  assert.deepEqual(i.publishedProjects.map((p) => p.id).sort(), ["p1", "p2"]);
  assert.equal(i.linkingProjects, 3);
});

test("deactivate without archiving touches only the developer rows", async () => {
  const db = fixture();
  const now = new Date("2026-10-09T10:00:00Z");
  await deactivateDeveloperGroup(db, "en1", { archiveProjects: false }, now);
  const rows = db.developer.rows;
  for (const id of ["en1", "de1", "pl1"]) assert.equal(rows.find((r: Rec) => r.id === id).deactivatedAt, now);
  assert.equal(rows.find((r: Rec) => r.id === "x").deactivatedAt, null);
  assert.equal(db.development.rows.find((d: Rec) => d.id === "d1").publishStatus, "published");
  assert.equal(db.project.rows.find((p: Rec) => p.id === "p1").status, "PUBLISHED");
  assert.equal(db.developerAccount.rows[0].developerTranslationGroupId, "g1"); // link kept for reactivation
});

test("deactivate with archiving takes the group's published projects offline, nothing else", async () => {
  const db = fixture();
  const r = await deactivateDeveloperGroup(db, "en1", { archiveProjects: true });
  assert.deepEqual(r.archivedDevelopments.map((d) => d.id), ["d1"]);
  const d = (id: string) => db.development.rows.find((x: Rec) => x.id === id);
  assert.equal(d("d1").publishStatus, "archived");
  assert.equal(d("d1").publishedAt, null);
  assert.equal(d("d2").publishStatus, "draft");
  assert.equal(d("d3").publishStatus, "published"); // another developer's
  const p = (id: string) => db.project.rows.find((x: Rec) => x.id === id);
  assert.equal(p("p1").status, "ARCHIVED");
  assert.equal(p("p2").status, "ARCHIVED");
  assert.equal(p("p4").status, "PUBLISHED");
});

test("deactivate re-points redirects that land on the page and drops pending HE jobs", async () => {
  const db = fixture();
  const i = await developerImpact(db, "en1");
  assert.deepEqual(i.redirectsIn.map((r) => r.id).sort(), ["r1", "r2"]);
  await deactivateDeveloperGroup(db, "en1", { archiveProjects: false });
  const t = (id: string) => db.legacyProjectRedirect.rows.find((r: Rec) => r.id === id).targetPath;
  assert.equal(t("r1"), localizedHref("en", ["developers"]));
  assert.equal(t("r2"), localizedHref("de", ["developers"])); // each in its own language
  assert.equal(t("r3"), localizedHref("en", ["developers", "other"])); // another developer's page
  assert.equal(t("r4"), localizedHref("en", ["projects", "acme-one"]));
  assert.deepEqual(db.aiGenerationQueue.rows.map((q: Rec) => q.id).sort(), ["q2", "q3"]);
});

test("reactivate clears the whole group and does not republish projects", async () => {
  const db = fixture();
  await deactivateDeveloperGroup(db, "en1", { archiveProjects: true });
  await reactivateDeveloperGroup(db, "pl1");
  for (const id of ["en1", "de1", "pl1"]) assert.equal(db.developer.rows.find((r: Rec) => r.id === id).deactivatedAt, null);
  assert.equal(db.development.rows.find((x: Rec) => x.id === "d1").publishStatus, "archived");
});

test("delete refuses without the right name and changes nothing", async () => {
  const db = fixture();
  await assert.rejects(() => deleteDeveloperGroup(db, "en1", "Acme"), /Acme Homes/);
  await assert.rejects(() => deleteDeveloperGroup(db, "en1", ""), /Acme Homes/);
  assert.equal(db.developer.rows.length, 5);
});

test("delete removes the group, unlinks the account, drops pending HE jobs only", async () => {
  const db = fixture();
  await deleteDeveloperGroup(db, "de1", "  acme homes ");
  assert.deepEqual(db.developer.rows.map((r: Rec) => r.id).sort(), ["solo", "x"]);
  assert.equal(db.developerAccount.rows.find((a: Rec) => a.id === "acc1").developerTranslationGroupId, null);
  assert.equal(db.developerAccount.rows.find((a: Rec) => a.id === "acc2").developerTranslationGroupId, "g2");
  assert.deepEqual(db.aiGenerationQueue.rows.map((q: Rec) => q.id).sort(), ["q2", "q3"]);
  assert.equal(db.development.rows.length, 3); // projects survive a page delete
  const t = (id: string) => db.legacyProjectRedirect.rows.find((r: Rec) => r.id === id).targetPath;
  assert.equal(t("r1"), localizedHref("en", ["developers"])); // no redirect into a 404
  assert.equal(t("r2"), localizedHref("de", ["developers"]));
});

test("a row without a group is handled on its own", async () => {
  const db = fixture();
  const i = await developerImpact(db, "solo");
  assert.equal(i.account, null);
  assert.deepEqual(i.rows.map((r) => r.id), ["solo"]);
  await deleteDeveloperGroup(db, "solo", "Solo");
  assert.equal(db.developer.rows.length, 4);
  assert.equal(db.developerAccount.rows.filter((a: Rec) => a.developerTranslationGroupId == null).length, 0);
});

test("delete confirmation compares the title loosely, never empty", () => {
  assert.equal(deleteConfirmationMatches("SOL  properties", "SOL Properties"), true);
  assert.equal(deleteConfirmationMatches("SOL", "SOL Properties"), false);
  assert.equal(deleteConfirmationMatches("   ", "   "), false);
});
