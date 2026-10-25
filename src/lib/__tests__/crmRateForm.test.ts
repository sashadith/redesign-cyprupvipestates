import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRate } from "@/lib/crm/rateForm";
test("plain, decimal-comma and percent-sign inputs parse", () => {
  assert.deepEqual(parseRate("10"), { ok: true, value: 10 });
  assert.deepEqual(parseRate("5,5"), { ok: true, value: 5.5 });
  assert.deepEqual(parseRate(" 7.25 % "), { ok: true, value: 7.25 });
});
test("out-of-range and over-precise rates are rejected", () => {
  for (const bad of ["0", "-1", "100.01", "5.555", "abc", ""]) assert.equal(parseRate(bad).ok, false, bad);
  assert.deepEqual(parseRate("100"), { ok: true, value: 100 });
});

test("the rates filter matches developer names, overrides and any project of the account", async () => {
  const { filterRateAccounts } = await import("@/lib/crm/rateForm");
  const accounts = [
    { name: "Aristo", overrides: [{ projectName: "Eden Coast" }], projects: [{ name: "Eden Coast" }, { name: "Venus Gardens" }] },
    { name: "Pafilia", overrides: [], projects: [{ name: "Minthis Hills" }] },
    { name: "Korantina", overrides: [], projects: [] },
  ];
  const names = (q: string) => filterRateAccounts(accounts, q).map((a) => a.name);
  assert.deepEqual(names(""), ["Aristo", "Pafilia", "Korantina"]);
  assert.deepEqual(names("  "), ["Aristo", "Pafilia", "Korantina"]);
  assert.deepEqual(names("kor"), ["Korantina"]);
  assert.deepEqual(names("eden"), ["Aristo"]);
  assert.deepEqual(names("MINTHIS"), ["Pafilia"], "project without an override still matches");
  assert.deepEqual(names("venus"), ["Aristo"]);
  assert.deepEqual(names("zzz"), []);
});
