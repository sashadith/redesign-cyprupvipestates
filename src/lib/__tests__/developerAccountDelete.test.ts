import { test } from "node:test";
import assert from "node:assert/strict";
import { developerAccountDeleteImpact } from "@/lib/developerAccountDelete";

/* 2026-10-10: deleting a DeveloperAccount cascades its developments, units and
   client-presentation items. The dialog lists what goes before asking for the
   typed name. */

type Rec = Record<string, any>;
const inList = (v: any, w: any) => (w && typeof w === "object" && "in" in w ? w.in.includes(v) : v === w);
const match = (r: Rec, where: Rec = {}) => Object.entries(where).every(([k, w]) => inList(r[k], w));

function fake() {
  const developments = [
    { id: "d1", developerAccountId: "a1", slug: "alpha-park", publicName: "Alpha Park", publishStatus: "published", override: { alias: null } },
    { id: "d2", developerAccountId: "a1", slug: "beta", publicName: "Beta (feed name)", publishStatus: "published", override: { alias: "Beta Residences" } },
    { id: "d3", developerAccountId: "a1", slug: null, publicName: "Gamma", publishStatus: "draft", override: null },
    { id: "d9", developerAccountId: "a2", slug: "other", publicName: "Other", publishStatus: "published", override: null },
  ];
  const units = [{ developmentId: "d1" }, { developmentId: "d1" }, { developmentId: "d3" }, { developmentId: "d9" }];
  const items = [{ developmentId: "d2" }, { developmentId: "d9" }];
  const redirects = [
    { targetPath: "/projects/alpha-park" },
    { targetPath: "/de/projects/alpha-park" },
    { targetPath: "/projects/alpha-park-2" }, // a different slug sharing the prefix
    { targetPath: "/developers/acme" },
    { targetPath: "/projects/other" },
  ];
  return {
    developerAccount: { findUnique: async ({ where }: any) => (where.id === "a1" ? { name: "Acme" } : null) },
    development: { findMany: async ({ where }: any) => developments.filter((d) => match(d, where)) },
    developmentUnit: { count: async ({ where }: any) => units.filter((u) => match(u, where)).length },
    clientPresentationItem: { count: async ({ where }: any) => items.filter((u) => match(u, where)).length },
    legacyProjectRedirect: { findMany: async () => redirects },
  };
}

test("impact counts only this account's rows and names its published pages", async () => {
  const i = await developerAccountDeleteImpact(fake(), "a1");
  assert.equal(i.name, "Acme");
  assert.equal(i.developments, 3);
  assert.equal(i.units, 3);
  assert.deepEqual(i.published, [{ name: "Alpha Park", slug: "alpha-park" }, { name: "Beta Residences", slug: "beta" }]); // alias wins
  assert.equal(i.presentationItems, 1);
  assert.equal(i.redirectsIn, 2); // both languages of alpha-park, not alpha-park-2
});

test("an unknown account is an error, not an empty impact", async () => {
  await assert.rejects(() => developerAccountDeleteImpact(fake(), "nope"), /not found/);
});
