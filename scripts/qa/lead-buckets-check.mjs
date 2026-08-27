#!/usr/bin/env node
/* Self-test for src/lib/crm/leadBucket.ts — the mapping between Lead.source and
   the three CRM buckets (Leads / Partner / Newsletter).

   Pure: no database, no network. The module under test imports only Prisma's
   generated TYPES, which esbuild erases, so the bundle has no runtime deps.

     node scripts/qa/lead-buckets-check.mjs

   Exits non-zero if any assertion fails. */
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/* esbuild is a TRANSITIVE dependency, not a declared one. Declaring it for a
   dev-only script would force an install on the next production deploy, so it
   is imported defensively instead: a missing esbuild must say so clearly. */
let build;
try {
  ({ build } = await import("esbuild"));
} catch {
  console.error("esbuild is not installed (it is only a transitive dependency).\n  npm i -D esbuild   — or run this check from a tree where it is present.");
  process.exit(2);
}

const bundlePath = join(tmpdir(), `lead-buckets-check-${process.pid}.mjs`);
const out = await build({
  entryPoints: ["src/lib/crm/leadBucket.ts"],
  bundle: true, platform: "node", format: "esm", write: false,
});
writeFileSync(bundlePath, out.outputFiles[0].text);
process.on("exit", () => rmSync(bundlePath, { force: true }));
const LB = await import(bundlePath);

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}

/* 1. Every value of the LeadSource enum maps to a bucket. Listed in full and by
      hand: if someone adds a source to the enum, this test still passes, and
      that is correct — a new source belongs in "leads" until somebody decides
      otherwise. What must never happen silently is an EXISTING source changing
      bucket, and that is what an exhaustive list catches. */
console.log("bucketOf");
for (const s of ["CONTACT_FORM", "PROJECT_ENQUIRY", "BLOG_ENQUIRY", "WHATSAPP", "PHONE", "REFERRAL", "MANUAL", "ROI_CALCULATOR", "OTHER"]) {
  check(`${s} -> leads`, LB.bucketOf(s), "leads");
}
check("PARTNER -> partner", LB.bucketOf("PARTNER"), "partner");
check("NEWSLETTER -> newsletter", LB.bucketOf("NEWSLETTER"), "newsletter");

/* 2. A lead read straight from Prisma can have a null source in old rows; it
      must land in "leads" rather than crashing the list page. */
check("null -> leads", LB.bucketOf(null), "leads");
check("undefined -> leads", LB.bucketOf(undefined), "leads");
check("unknown string -> leads", LB.bucketOf("SOMETHING_NEW"), "leads");

/* 3. Round trip. Moving a lead INTO a bucket and asking which bucket it is now
      in must agree, or the menu would offer a move that appears to do nothing. */
console.log("sourceForBucket round trip");
for (const b of LB.LEAD_BUCKETS) {
  check(`${b} -> ${LB.sourceForBucket(b)} -> ${b}`, LB.bucketOf(LB.sourceForBucket(b)), b);
}
check("leads writes MANUAL", LB.sourceForBucket("leads"), "MANUAL");
check("partner writes PARTNER", LB.sourceForBucket("partner"), "PARTNER");
check("newsletter writes NEWSLETTER", LB.sourceForBucket("newsletter"), "NEWSLETTER");

/* 4. The guard the server action relies on. It receives a string straight off a
      form submission, so it must reject anything that is not a bucket. */
console.log("isLeadBucket");
check("accepts leads", LB.isLeadBucket("leads"), true);
check("accepts partner", LB.isLeadBucket("partner"), true);
check("accepts newsletter", LB.isLeadBucket("newsletter"), true);
check("rejects a source name", LB.isLeadBucket("NEWSLETTER"), false);
check("rejects empty", LB.isLeadBucket(""), false);
check("rejects null", LB.isLeadBucket(null), false);
check("rejects an object", LB.isLeadBucket({}), false);

/* 5. The query fragments. Asserted as data because five separate queries spread
      them into their own where-clause — a change in shape here changes what
      five pages show, so it is worth pinning. */
console.log("query fragments");
check("EXCLUDE_NEWSLETTER", LB.EXCLUDE_NEWSLETTER, { source: { not: "NEWSLETTER" } });
check("ONLY_NEWSLETTER", LB.ONLY_NEWSLETTER, { source: "NEWSLETTER" });

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
