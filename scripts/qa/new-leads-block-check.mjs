#!/usr/bin/env node
/* Self-test for isUntouchedNewLead() — the rule behind the CRM's "New leads"
   block (src/app/admin/(panel)/crm/leadListShared.ts).

   The rule exists because "has this lead been contacted" is NOT the same
   question as "has anyone worked this lead". Kevin Glaubitt set the boundary
   on 2026-09-06: 47 interactions, every one of them SYSTEM or
   PRESENTATION_EVENT, so every contact-based test called him untouched while
   the operator had been working him for weeks — assigned, presentation drafted.

   On production data today the block is legitimately empty, so these synthetic
   cases are the only thing proving it can fill at all.

     node scripts/qa/new-leads-block-check.mjs

   Exits non-zero on any failed assertion. */
import { build } from "esbuild";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const scratch = join(process.cwd(), "node_modules", ".new-leads-check");
mkdirSync(scratch, { recursive: true });
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
const out = await build({
  entryPoints: ["src/app/admin/(panel)/crm/leadListShared.ts"],
  bundle: true, platform: "node", format: "esm", write: false,
  external: ["@prisma/client", ".prisma/client"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
const f = join(scratch, "shared.mjs");
writeFileSync(f, out.outputFiles[0].text);
const { isUntouchedNewLead, HUMAN_TOUCH_TYPES, LAST_CONTACT_TYPES } = await import(f);

let failures = 0;
const check = (name, actual, expected) => {
  if (actual === expected) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${expected}, got ${actual}`);
};

// A lead that just arrived and that nobody has opened yet.
const untouched = {
  status: "NEW",
  assignedTo: null,
  nextFollowUpAt: null,
  _count: { interactions: 0, presentations: 0 },
};
const w = (o) => ({ ...untouched, ...o });

console.log("\nthe block fills");
check("a brand-new, untouched lead belongs in it", isUntouchedNewLead(untouched), true);

console.log("\nand empties again — each of these means someone worked it");
check("assigned to someone",        isUntouchedNewLead(w({ assignedTo: { name: "Sascha Dith" } })), false);
check("a follow-up was scheduled",  isUntouchedNewLead(w({ nextFollowUpAt: new Date() })), false);
check("a presentation was drafted", isUntouchedNewLead(w({ _count: { interactions: 0, presentations: 1 } })), false);
check("a call/mail/note is logged", isUntouchedNewLead(w({ _count: { interactions: 1, presentations: 0 } })), false);
check("the status moved on",        isUntouchedNewLead(w({ status: "CONTACTED" })), false);

console.log("\nthe Kevin Glaubitt case — worked, but never contacted");
// Assigned and carrying a presentation, with 47 SYSTEM/PRESENTATION_EVENT rows
// that HUMAN_TOUCH_TYPES deliberately does not count.
check("stays out of the block",
  isUntouchedNewLead({ status: "NEW", assignedTo: { name: "Sascha Dith" }, nextFollowUpAt: null,
    _count: { interactions: 0, presentations: 1 } }), false);
// ...and would still be out on the assignment alone, with no presentation.
check("assignment alone is enough to keep him out",
  isUntouchedNewLead({ status: "NEW", assignedTo: { name: "Sascha Dith" }, nextFollowUpAt: null,
    _count: { interactions: 0, presentations: 0 } }), false);

console.log("\nwhat counts as a human touch");
check("NOTE counts",            HUMAN_TOUCH_TYPES.includes("NOTE"), true);
check("CALL counts",            HUMAN_TOUCH_TYPES.includes("CALL"), true);
check("WHATSAPP_IN counts",     HUMAN_TOUCH_TYPES.includes("WHATSAPP_IN"), true);
// The two that made every earlier attempt at this misfire.
check("SYSTEM does NOT count",             HUMAN_TOUCH_TYPES.includes("SYSTEM"), false);
check("PRESENTATION_EVENT does NOT count", HUMAN_TOUCH_TYPES.includes("PRESENTATION_EVENT"), false);
check("STATUS_CHANGE does NOT count",      HUMAN_TOUCH_TYPES.includes("STATUS_CHANGE"), false);
// NOTE is work on the lead but not contact with it, so the two lists differ.
check("NOTE is not a last-contact type",   LAST_CONTACT_TYPES.includes("NOTE"), false);


console.log("\nbucket order — HOT wins over New (operator's call, 2026-09-06)");
/* Mirrors the chain in crm/page.tsx exactly. Kept here because the ordering is
   the whole behaviour: reversing two branches silently moves leads between
   blocks and nothing else would notice. */
function bucketOf(l) {
  if (l.status === "KEEP_CONTACT") return "keep";
  if (l.hotAt) return "hot";
  if (isUntouchedNewLead(l)) return "new";
  if (l.source === "PARTNER") return "partner";
  return "band";
}
const untouchedHot = { ...untouched, hotAt: new Date() };
check("an untouched HOT lead goes to Hot, not New", bucketOf(untouchedHot), "hot");
check("an untouched plain lead goes to New",        bucketOf(untouched), "new");
check("an untouched PARTNER lead goes to New",      bucketOf({ ...untouched, source: "PARTNER" }), "new");
check("a worked partner lead goes to Partner",
  bucketOf({ ...untouched, source: "PARTNER", assignedTo: { name: "Sascha Dith" } }), "partner");
check("KEEP_CONTACT still wins over everything",
  bucketOf({ ...untouched, status: "KEEP_CONTACT", hotAt: new Date() }), "keep");
check("a worked lead falls through to the colour bands",
  bucketOf({ ...untouched, assignedTo: { name: "Sascha Dith" } }), "band");

console.log(`\n${failures ? `${failures} failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
