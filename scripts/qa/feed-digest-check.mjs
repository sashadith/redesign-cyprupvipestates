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
const empty = { newProjects: [], newUnits: [], removed: [], blocked: [] };
// The section a piece of text belongs to. Several assertions below are only
// meaningful per-section ("does the NEW UNITS wording tell me to publish?"),
// and searching the whole message would let the right words in the wrong
// section pass.
const section = (text, title) => {
  const i = text.indexOf(title);
  if (i < 0) return "";
  const rest = text.slice(i + title.length);
  const j = rest.search(/\n[^\s]/);
  return j < 0 ? rest : rest.slice(0, j);
};

console.log("\na quiet night sends nothing");
check("no events at all", buildFeedDigestMessage(empty), null);
check("empty line arrays still count as nothing",
  buildFeedDigestMessage({ ...empty, newUnits: [{ dev: "bbf", lines: [] }] }), null);
check("an empty project array too",
  buildFeedDigestMessage({ ...empty, newProjects: [{ dev: "bbf", projects: [] }] }), null);

console.log("\nwhat needs a human comes before what is only a report");
{
  const m = buildFeedDigestMessage({
    blocked: [{ dev: "medousa", missing: 105, total: 436 }],
    newProjects: [{ dev: "bbf", projects: [{ developmentId: "dP", name: "Eden Golf II" }] }],
    removed: [{ dev: "bbf", nowSoldOut: [], lines: [u("d1", "Heart", "H1", "Nr. 1")] }],
    newUnits: [{ dev: "bbf", lines: [u("d2", "Golf Valley", "G1", "Nr. 1")] }],
  });
  const at = (s) => m.text.indexOf(s);
  check("blocked first", at("NEEDS A DECISION") >= 0 && at("NEEDS A DECISION") < at("NEW PROJECTS"), true);
  check("new projects before removed", at("NEW PROJECTS") < at("REMOVED FROM THE CATALOGUE"), true);
  check("removed before new units", at("REMOVED FROM THE CATALOGUE") < at("NEW UNITS"), true);
  check("subject lists all four", m.subject,
    "Feed sync: 1 feed refused, 1 new project, 1 removed, 1 new unit");
}

/* The regression this section exists for. Until 2026-09-08 the new-units
   section read "Not live yet. Open the project to check price, area and
   photos, then publish." — wrong in every case, because unitsCreatedLines is
   only populated for an already-published development. The operator acted on
   it, looking for a publish button that was never going to be there. */
console.log("\nnew units are reported as live; only new projects ask to be published");
{
  const m = buildFeedDigestMessage({
    ...empty,
    newProjects: [{ dev: "bbf", projects: [{ developmentId: "dP", name: "Eden Golf II" }] }],
    newUnits: [{ dev: "bbf", lines: [u("d2", "Synergy", "S1", "Nr. 4.51")] }],
  });
  const units = section(m.text, "NEW UNITS");
  const projects = section(m.text, "NEW PROJECTS");
  check("units section says they are live", /already live/i.test(units), true);
  check("units section asks for nothing", /no action needed/i.test(units), true);
  check("units section never says publish", /publish/i.test(units), false);
  check("units section never says 'not live'", /not live/i.test(units), false);
  check("projects section says drafts", /draft/i.test(projects), true);
  check("projects section does ask to publish", /then publish/i.test(projects), true);
  check("heading carries it too", m.text.includes("NEW UNITS — 1 already live"), true);
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
  check("Thea listed once with its count", (m.text.match(/Thea \(2\)/g) || []).length, 1);
  check("projects alphabetical within a developer", m.text.indexOf("Thea (2)") < m.text.indexOf("Uptown (1)"), true);
  check("each project links to itself", m.text.includes("/admin/developments/dA") && m.text.includes("/admin/developments/dB"), true);
  check("a blocked feed links to its filtered list",
    buildFeedDigestMessage({ ...empty, blocked: [{ dev: "medousa", missing: 1, total: 2 }] })
      .text.includes("/admin/developments?dev=medousa"), true);
  check("new projects link to themselves", buildFeedDigestMessage({
    ...empty, newProjects: [{ dev: "bbf", projects: [{ developmentId: "dP", name: "Eden Golf II" }] }],
  }).text.includes("/admin/developments/dP"), true);
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
  check("subject counts all 20", m.subject, "Feed sync: 20 new units");
}

console.log("\nsold-out follows its developer's removals");
{
  const m = buildFeedDigestMessage({
    ...empty,
    removed: [{ dev: "island-blue", nowSoldOut: ["Harmony Residences"], lines: [u("d1", "Harmony Residences", "A1", "Nr. 1")] }],
  });
  check("sold-out line present", m.text.includes("Harmony Residences now shows as sold out."), true);
}

/* Telegram parses EVERY message as HTML (parse_mode is hardcoded in
   sendTelegramMessage), so a name carrying "&" or "<" is a delivery failure,
   not a cosmetic flaw. "G&V Hadjidemosthenous" is a real developer here. */
console.log("\nHTML is escaped, and links carry a name instead of a raw URL");
{
  const m = buildFeedDigestMessage({
    ...empty,
    newUnits: [{ dev: "bbf", lines: [u("dA", "G&V <Tower>", "R1", "Nr. 1 & 2")] }],
  });
  check("telegram escapes the ampersand", m.telegram.includes("G&amp;V"), true);
  check("telegram escapes the angle brackets", m.telegram.includes("&lt;Tower&gt;"), true);
  check("telegram leaves no raw < from data", /<(?!\/?(b|i|a)\b)/.test(m.telegram), false);
  check("email escapes it too", m.html.includes("G&amp;V &lt;Tower&gt;"), true);
  check("telegram anchors the project name", m.telegram.includes(`>G&amp;V &lt;Tower&gt; (1)</a>`), true);
  check("email anchors it as well", m.html.includes(`>G&amp;V &lt;Tower&gt; (1)</a>`), true);
  check("plain text keeps the URL visible", m.text.includes("/admin/developments/dA"), true);
  check("the URL is not raw text in telegram", m.telegram.includes("\n      https://"), false);
}

console.log("\nthe telegram body stays under the 4096-character hard limit");
{
  const huge = {
    ...empty,
    newUnits: Array.from({ length: 12 }, (_, d) => ({
      dev: "bbf",
      lines: Array.from({ length: 14 }, (_, i) => u(`d${d}`, `Development Number ${d}`, `R${i}`, `Block X · Nr. ${d}-${i}`)),
    })),
  };
  const m = buildFeedDigestMessage(huge);
  check("under the limit", m.telegram.length <= 4096, true);
  check("and says it was shortened", m.telegram.includes("Shortened to fit Telegram"), true);
  check("project links survive the trim", m.telegram.includes("/admin/developments/d0"), true);
  // The email has no such limit and must keep everything.
  check("the email keeps the detail", m.html.includes("Block X · Nr. 0-0"), true);
}

console.log(`\n${failures ? `${failures} failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
