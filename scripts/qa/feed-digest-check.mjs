#!/usr/bin/env node
/* Self-test for buildFeedDigestMessage() — the nightly feed email.

   It replaced one message per developer per event type, each carrying a bare
   count ("Domenica Group: 10 new units awaiting review") with no way to tell
   which units without opening the admin and hunting. Four developers meant
   four such emails.

     node scripts/qa/feed-digest-check.mjs

   Exits non-zero on any failed assertion. */
import { build } from "esbuild";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const scratch = join(process.cwd(), "node_modules", ".feed-digest-check");
mkdirSync(scratch, { recursive: true });
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
const out = await build({
  entryPoints: ["src/lib/feedNotifications.ts"],
  bundle: true, platform: "node", format: "esm", write: false,
  external: ["@prisma/client", "nodemailer"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
const f = join(scratch, "n.mjs");
writeFileSync(f, out.outputFiles[0].text);
const { buildFeedDigestMessage } = await import(f);

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `\n       erwartet ${JSON.stringify(expected)}, war ${JSON.stringify(actual)}`}`);
};
const u = (id, dev, ref, label) => ({ developmentId: id, development: dev, ref, label });
const empty = { newUnits: [], removed: [], blocked: [] };

console.log("\na quiet night sends nothing");
check("no events at all", buildFeedDigestMessage(empty), null);
check("empty line arrays still count as nothing",
  buildFeedDigestMessage({ ...empty, newUnits: [{ dev: "bbf", lines: [] }] }), null);

console.log("\nsection order: decisions, then live changes, then drafts");
{
  const m = buildFeedDigestMessage({
    blocked: [{ dev: "medousa", missing: 105, total: 436 }],
    removed: [{ dev: "bbf", nowSoldOut: [], lines: [u("d1", "Heart", "H1", "Nr. 1")] }],
    newUnits: [{ dev: "bbf", lines: [u("d2", "Golf Valley", "G1", "Nr. 1")] }],
  });
  const iBlocked = m.text.indexOf("NEEDS A DECISION");
  const iRemoved = m.text.indexOf("REMOVED FROM THE CATALOGUE");
  const iNew = m.text.indexOf("AWAITING YOUR REVIEW");
  check("blocked comes first", iBlocked >= 0 && iBlocked < iRemoved, true);
  check("removed before new", iRemoved < iNew, true);
  check("subject lists all three", m.subject, "Feed sync: 1 feed refused, 1 removed, 1 new");
}

console.log("\ndevelopers are alphabetical, so two mornings are comparable");
{
  const m = buildFeedDigestMessage({
    ...empty,
    newUnits: [
      { dev: "squareone", lines: [u("d1", "Neon", "N1", "Nr. 1")] },
      { dev: "bbf", lines: [u("d2", "Golf Valley", "G1", "Nr. 1")] },
      { dev: "island-blue", lines: [u("d3", "Aurora", "A1", "Nr. 1")] },
    ],
  });
  check("BBF before Island Blue before Square One",
    m.text.indexOf("BBF") < m.text.indexOf("Island Blue") && m.text.indexOf("Island Blue") < m.text.indexOf("Square One"), true);
}

console.log("\nunits are grouped under their project, with a link");
{
  const m = buildFeedDigestMessage({
    ...empty,
    // Uptown is fed FIRST so the alphabetical check cannot pass on insertion
    // order alone — it did, until a mutation exposed it.
    newUnits: [{ dev: "domenica", lines: [
      u("dB", "Uptown", "U1", "Villa 3"), u("dA", "Thea", "T1", "Nr. 14"), u("dA", "Thea", "T2", "Nr. 15"),
    ]}],
  });
  // Both Thea units under one heading even though a third project interleaves.
  check("Thea listed once with its count", (m.text.match(/Thea \(2\)/g) || []).length, 1);
  // Fed in as Thea, Uptown, Thea — so a working grouping must also sort, not
  // merely dedupe. Without the sort this passed anyway.
  check("projects alphabetical within a developer", m.text.indexOf("Thea (2)") < m.text.indexOf("Uptown (1)"), true);
  check("each project links to itself", m.text.includes("/admin/developments/dA") && m.text.includes("/admin/developments/dB"), true);
  check("a blocked feed links to its filtered list",
    buildFeedDigestMessage({ ...empty, blocked: [{ dev: "medousa", missing: 1, total: 2 }] })
      .text.includes("/admin/developments?dev=medousa"), true);
}

console.log("\nlong lists are capped, and say so");
{
  const many = Array.from({ length: 20 }, (_, i) => u("dA", "Big", `R${i}`, `Nr. ${i}`));
  const m = buildFeedDigestMessage({ ...empty, newUnits: [{ dev: "bbf", lines: many }] });
  check("count is the real one", m.text.includes("Big (20)"), true);
  // Counting the bullets, not just looking for the summary line: the "… and N
  // more" line is computed from the total and appears even when the slice is
  // gone, so on its own it proved nothing.
  check("exactly 15 bullets printed", (m.text.match(/^ +· /gm) || []).length, 15);
  check("and the rest summarised", m.text.includes("… and 5 more"), true);
  check("subject counts all 20", m.subject, "Feed sync: 20 new");
}

console.log("\nsold-out follows its developer's removals");
{
  const m = buildFeedDigestMessage({
    ...empty,
    removed: [{ dev: "island-blue", nowSoldOut: ["Harmony Residences"], lines: [u("d1", "Harmony Residences", "A1", "Nr. 1")] }],
  });
  check("sold-out line present", m.text.includes("Harmony Residences now shows as sold out."), true);
}

console.log(`\n${failures ? `${failures} failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
