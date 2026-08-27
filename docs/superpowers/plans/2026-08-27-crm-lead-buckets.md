# CRM Lead Buckets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give newsletter subscribers their own CRM page out of the sales pipeline, and let a lead be moved between the Leads, Partner and Newsletter buckets.

**Architecture:** `Lead.source` already decides the bucket, so no schema change is needed anywhere. A new leaf module `src/lib/crm/leadBucket.ts` owns the mapping and two Prisma `where` fragments; five queries import the exclusion fragment, one page imports its inverse, and one server action writes the field and records the old value in the lead timeline.

**Tech Stack:** Next.js 15 App Router (server components + server actions), Prisma, TypeScript, Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-27-crm-lead-buckets-design.md`

---

## A note on testing, before you start

**This repository has no unit-test runner.** No vitest, no jest, no `npm test`
script, no `*.test.ts` anywhere. Do not add one — that is a change to the
project's tooling that nobody asked for, and this feature is not the place to
argue for it.

The house pattern for testing a pure module is `scripts/qa/*.mjs`: a plain Node
script that bundles the TypeScript module with esbuild (a transitive dependency)
and asserts against it. `scripts/qa/availability-table-check.mjs` is the working
example — read it before Task 1. Task 1 follows it exactly, so the pure logic in
this feature genuinely does get a test-first cycle.

Everything that touches Prisma or React is verified by `npx tsc --noEmit`,
`npm run build`, and the live read-only checks in Task 8.

**The database is production.** `.env.local` tunnels to the live database on
`localhost:5433`; there is no staging copy. Read freely, and never run a write
script against it without the operator's explicit go-ahead.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/crm/leadBucket.ts` | **new.** The bucket vocabulary: which bucket a source belongs to, which source a bucket writes, and the two Prisma fragments. Imports only Prisma types, so client components can use it. |
| `scripts/qa/lead-buckets-check.mjs` | **new.** Self-test for the above. |
| `src/app/admin/actions.ts` | **modify.** Add `moveLeadToBucket`. |
| `src/app/admin/(panel)/crm/MoveLeadMenu.tsx` | **new.** The client control that calls it. |
| `src/app/admin/(panel)/crm/LeadRow.tsx` | **modify.** Render the menu in the row. |
| `src/app/admin/(panel)/crm/[id]/page.tsx` | **modify.** Render the menu on the detail page. |
| `src/app/admin/(panel)/crm/newsletter/page.tsx` | **new.** The Newsletter list. |
| `src/app/admin/(panel)/layout.tsx` | **modify.** Nav entry, its count, and the excluded Leads count. |
| `src/app/admin/(panel)/crm/filters.ts` | **modify.** Exclusion in `buildLeadWhere`; a dropdown list without `NEWSLETTER`. |
| `src/app/admin/(panel)/crm/page.tsx` | **modify.** Use that dropdown list. |
| `src/app/admin/(panel)/crm/board/page.tsx` | **modify.** Exclusion. |
| `src/lib/actionCenter/rules/crm.ts` | **modify.** Exclusion. |
| `src/lib/actionCenter/rules/developers.ts` | **modify.** Exclusion. |
| `src/app/api/monday-newsletter/route.ts` | **modify.** De-duplicate on email alone. |

`src/app/admin/(panel)/crm/export/route.ts` is deliberately **not** in this list.
It already calls `buildLeadWhere`, so Task 5 gives it the exclusion for free.

---

## Task 1: The bucket module

**Files:**
- Create: `src/lib/crm/leadBucket.ts`
- Test: `scripts/qa/lead-buckets-check.mjs`

- [ ] **Step 1: Read the existing QA script to copy its shape**

Run: `sed -n 1,50p scripts/qa/availability-table-check.mjs`

You are copying two things from it: the defensive `esbuild` import (it is a
transitive dependency and may vanish), and the `check(name, actual, expected)`
helper that counts failures instead of throwing on the first one.

- [ ] **Step 2: Write the failing test**

Create `scripts/qa/lead-buckets-check.mjs`:

```js
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
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `node scripts/qa/lead-buckets-check.mjs`
Expected: FAIL — esbuild errors with `Could not resolve "src/lib/crm/leadBucket.ts"`, because the module does not exist yet.

- [ ] **Step 4: Write the module**

Create `src/lib/crm/leadBucket.ts`:

```ts
// Which of the three CRM buckets a lead sits in, and how to move it between them.
//
// `Lead.source` is the only thing that decides this — there is no separate
// column — so the buckets are mutually exclusive by construction: a lead cannot
// be both a newsletter subscriber and a partner lead. That limitation is
// deliberate and its consequences are written down in
// docs/superpowers/specs/2026-08-27-crm-lead-buckets-design.md. Giving
// subscribers their own flag belongs to the newsletter system, not here.
//
// A leaf module on purpose: it imports only Prisma's generated TYPES, which
// disappear at compile time, so "use client" components can import it too.
import type { Prisma } from "@prisma/client";

export const LEAD_BUCKETS = ["leads", "partner", "newsletter"] as const;
export type LeadBucket = (typeof LEAD_BUCKETS)[number];

export const BUCKET_LABEL: Record<LeadBucket, string> = {
  leads: "Leads",
  partner: "Partner",
  newsletter: "Newsletter",
};

// Anything unrecognised lands in "leads". A source this function has never seen
// is far more likely to be a new enquiry channel than a new kind of mailing
// list, and the leads list is the bucket where a human will actually notice it.
export function bucketOf(source: string | null | undefined): LeadBucket {
  if (source === "NEWSLETTER") return "newsletter";
  if (source === "PARTNER") return "partner";
  return "leads";
}

// Moving INTO "leads" has to name a concrete source, and MANUAL is the honest
// one: a person put this lead here by hand. The cost is that a round trip does
// not restore the original — a lead that arrived as PROJECT_ENQUIRY comes back
// from Partner as MANUAL. moveLeadToBucket writes the old value into the lead's
// timeline, which is where that history survives.
export function sourceForBucket(bucket: LeadBucket): "MANUAL" | "PARTNER" | "NEWSLETTER" {
  if (bucket === "newsletter") return "NEWSLETTER";
  if (bucket === "partner") return "PARTNER";
  return "MANUAL";
}

// The server action receives this straight off a form submission, so it is a
// type guard rather than a cast.
export function isLeadBucket(v: unknown): v is LeadBucket {
  return typeof v === "string" && (LEAD_BUCKETS as readonly string[]).includes(v);
}

// Query fragments, shared so they cannot drift. Five queries hide newsletter
// leads and one page shows them; if those two ever disagreed about what a
// newsletter lead is, subscribers would be invisible in both places at once.
export const EXCLUDE_NEWSLETTER: Prisma.LeadWhereInput = { source: { not: "NEWSLETTER" } };
export const ONLY_NEWSLETTER: Prisma.LeadWhereInput = { source: "NEWSLETTER" };
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node scripts/qa/lead-buckets-check.mjs`
Expected: every line prints `ok`, last line `all passed`, exit code 0.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/crm/leadBucket.ts scripts/qa/lead-buckets-check.mjs
git commit -m "Add the CRM lead-bucket vocabulary and its self-test"
```

---

## Task 2: The server action

**Files:**
- Modify: `src/app/admin/actions.ts` (add after `updateLeadStatus`, which ends at line 754)

- [ ] **Step 1: Read the action you are copying**

Run: `sed -n 720,755p src/app/admin/actions.ts`

`updateLeadStatus` is the template: `requireSession()`, validate, write the
field, then write **both** a `LeadActivity` row and a `LeadInteraction` row, then
`revalidatePath`. Every lead mutation in this file writes both. Do not write
only one.

- [ ] **Step 2: Add the import**

At the top of `src/app/admin/actions.ts`, alongside the other `@/lib` imports:

```ts
import { bucketOf, sourceForBucket, isLeadBucket, BUCKET_LABEL } from "@/lib/crm/leadBucket";
```

- [ ] **Step 3: Add the action**

Insert immediately after `updateLeadStatus` ends (after its closing brace on
line 754, before the comment block that begins `// 2026-08-11 — the optional
second step StatusPopover's`):

```ts
// Moving a lead between the three CRM buckets (Leads / Partner / Newsletter).
//
// `source` IS the bucket — there is no separate column — so this overwrites it,
// and that write is lossy: a lead that arrived as PROJECT_ENQUIRY comes back
// from Partner as MANUAL, because sourceForBucket has no way to know what it
// used to be. The timeline rows below are the only place that history survives,
// which is why this action writes them even though nothing reads them yet.
export async function moveLeadToBucket(id: string, bucket: string) {
  const session = await requireSession();
  if (!isLeadBucket(bucket)) throw new Error("Invalid bucket");

  const lead = await prisma.lead.findUnique({ where: { id }, select: { source: true } });
  if (!lead) throw new Error("Lead not found");
  // Already there: return before writing anything. A no-op must not leave a
  // timeline entry claiming a change that did not happen.
  if (bucketOf(lead.source) === bucket) return;

  const fromSource = lead.source;
  const toSource = sourceForBucket(bucket);
  await prisma.lead.update({ where: { id }, data: { source: toSource as any } });

  const content = `Moved to ${BUCKET_LABEL[bucket]} — source changed from ${fromSource} to ${toSource}`;
  await prisma.leadActivity.create({
    data: {
      leadId: id,
      type: "SOURCE_CHANGE",
      content,
      createdBy: session.user?.name ?? "admin",
      createdById: (session.user as any)?.id ?? null,
    },
  });
  await prisma.leadInteraction.create({
    data: {
      leadId: id,
      type: "SYSTEM",
      channel: "SYSTEM",
      body: content,
      // Structured as well as prose, for the same reason updateLeadStatus writes
      // metadata.toStatus: a later consumer should not have to parse a sentence
      // to find out where a lead came from.
      metadata: { fromSource, toSource, toBucket: bucket },
      createdByUserId: (session.user as any)?.id ?? null,
      createdByName: session.user?.name ?? "admin",
    },
  });

  revalidatePath(`/admin/crm/${id}`);
  revalidatePath("/admin/crm");
  revalidatePath("/admin/crm/newsletter");
  revalidatePath("/admin");
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

If it complains that `LeadActivity.type` will not accept `"SOURCE_CHANGE"`, you
have the wrong model — `LeadActivity.type` is a plain `String` in
`prisma/schema.prisma:831`, while `LeadInteraction.type` is the
`LeadInteractionType` enum, which is why the two rows use different type values.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/actions.ts
git commit -m "Add moveLeadToBucket, recording the overwritten source in the timeline"
```

---

## Task 3: The move control

**Files:**
- Create: `src/app/admin/(panel)/crm/MoveLeadMenu.tsx`

- [ ] **Step 1: Read the client component you are copying**

Run: `cat "src/app/admin/(panel)/crm/DeleteLeadButton.tsx"`

Note the three things it does that this component also needs: `useTransition`
for the pending state, `e.stopPropagation()` because the whole table row is a
link, and a `confirm()` before acting.

- [ ] **Step 2: Write the component**

Create `src/app/admin/(panel)/crm/MoveLeadMenu.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { moveLeadToBucket } from "../../actions";
import { LEAD_BUCKETS, BUCKET_LABEL, bucketOf, type LeadBucket } from "@/lib/crm/leadBucket";

// An action menu, not a state display. Its value is always "" and the lead's
// current bucket is filtered out of the options, so picking an option can only
// ever mean "move there".
//
// A controlled <select> showing the current bucket would be wrong here: when the
// user cancels the confirm dialog nothing re-renders, so the browser would keep
// showing the bucket they picked while the lead never moved.
//
// A <select> rather than a popover like StatusPopover next door: that one is a
// portal-rendered panel because changing a status can require capturing a
// contact afterwards. Moving a bucket never does.
export default function MoveLeadMenu({
  id, source, className,
}: {
  id: string;
  source: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const current = bucketOf(source);

  return (
    <select
      aria-label="Move lead to another list"
      disabled={pending}
      value=""
      // The table row is wrapped in a link; without this, opening the menu
      // navigates to the lead instead.
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const next = e.target.value as LeadBucket;
        if (!next || next === current) return;
        if (!confirm(`Move this lead to ${BUCKET_LABEL[next]}?`)) return;
        startTransition(() => { moveLeadToBucket(id, next); });
      }}
      className={className ?? "rounded-md border border-[#E5E7EB] bg-white text-xs px-2 py-1 text-[#6B7280] disabled:opacity-50"}
    >
      <option value="">{pending ? "Moving…" : "Move…"}</option>
      {LEAD_BUCKETS.filter((b) => b !== current).map((b) => (
        <option key={b} value={b}>{BUCKET_LABEL[b]}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/(panel)/crm/MoveLeadMenu.tsx"
git commit -m "Add the lead move menu"
```

---

## Task 4: Wire the control into the two lead views

**Files:**
- Modify: `src/app/admin/(panel)/crm/LeadRow.tsx`
- Modify: `src/app/admin/(panel)/crm/leadListShared.ts` (the `LeadRowData` type)
- Modify: `src/app/admin/(panel)/crm/[id]/page.tsx:327-329`

- [ ] **Step 1: Add `source` to the row's data type**

`LeadRow` renders from `LeadRowData` in `leadListShared.ts`, which does not carry
`source` today. Add it to the type, after `status`:

```ts
export type LeadRowData = {
  id: string; firstName: string; lastName: string;
  languagePreference: string | null; sourceLocale: string | null;
  countryOfResidence: string | null; status: string; source: string; createdAt: Date;
  hotAt: Date | null; budgetMax: number | null; viewingScheduledAt: Date | null;
  email: string | null; phone: string | null;
  assignedTo: { name: string } | null;
  interactions: { occurredAt: Date; type: string }[];
};
```

The list page uses `include`, not `select`, so `source` is already fetched — this
is a type change only, and `npx tsc --noEmit` in Step 4 will confirm that.

- [ ] **Step 2: Render the menu in the row**

In `src/app/admin/(panel)/crm/LeadRow.tsx`, add the import next to the others:

```tsx
import MoveLeadMenu from "./MoveLeadMenu";
```

and replace the final cell (the last `<td>` before `</tr>`):

```tsx
      <td className="px-4 py-2.5 text-right"><DeleteLeadButton id={l.id} /></td>
```

with:

```tsx
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-2">
          <MoveLeadMenu id={l.id} source={l.source} />
          <DeleteLeadButton id={l.id} />
        </div>
      </td>
```

- [ ] **Step 3: Render it on the detail page**

In `src/app/admin/(panel)/crm/[id]/page.tsx`, add the import next to
`DeleteLeadButton`'s on line 14:

```tsx
import MoveLeadMenu from "../MoveLeadMenu";
```

and replace lines 327-329:

```tsx
      <div className="pt-4 border-t border-[#E5E7EB]">
        <DeleteLeadButton id={id} redirectTo="/admin/crm" label="Delete lead" />
      </div>
```

with:

```tsx
      {/* Move sits at the opposite end of the row from Delete. The comment above
          puts Delete down here so it is not next to anything easy to misclick
          into; a <select> needs a deliberate second click to commit, so it does
          not reintroduce that hazard. */}
      <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-between">
        <MoveLeadMenu id={id} source={lead.source} className="rounded-md border border-[#E5E7EB] bg-white text-sm px-3 py-1.5 text-[#6B7280] disabled:opacity-50" />
        <DeleteLeadButton id={id} redirectTo="/admin/crm" label="Delete lead" />
      </div>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

Both views already fetch `source`: the list page and the detail page each use
`include` (`crm/page.tsx:119` and `crm/[id]/page.tsx:47`), which returns every
scalar column. Step 1 is therefore a type-only change, and this typecheck is
what proves it.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build completes. If it aborts with "Too many database connections",
that is the shared production database refusing more connections, not your code —
wait and re-run once rather than looping.

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/(panel)/crm/LeadRow.tsx" "src/app/admin/(panel)/crm/leadListShared.ts" "src/app/admin/(panel)/crm/[id]/page.tsx"
git commit -m "Offer the move menu in the lead row and on the lead page"
```

At this point **feature 2 is complete and usable**: a lead can be moved to
Partner and back. Feature 1 follows.

---

## Task 5: The Newsletter page and its nav entry

Build the page **before** the exclusions in Task 6, so no lead is ever invisible
between two commits.

**Files:**
- Create: `src/app/admin/(panel)/crm/newsletter/page.tsx`
- Modify: `src/app/admin/(panel)/layout.tsx:18` (signature), `:44` (nav), `:80` (counts)

- [ ] **Step 1: Read the page you are copying**

Run: `sed -n 1,60p "src/app/admin/(panel)/crm/trash/page.tsx"`

Trash is the existing precedent for "a second, simpler list of leads": a plain
server component, `export const dynamic = "force-dynamic"`, one `findMany`, one
table, a back-link to the leads list.

- [ ] **Step 2: Write the page**

Create `src/app/admin/(panel)/crm/newsletter/page.tsx`:

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ONLY_NEWSLETTER } from "@/lib/crm/leadBucket";
import { adminDate } from "@/lib/adminTime";
import MoveLeadMenu from "../MoveLeadMenu";

export const dynamic = "force-dynamic";

// Deliberately NOT the leads table. No colour dot, no status popover, no hot
// flame: those are sales instruments, and a subscriber is not a sales process.
// The only action offered here is moving one out — a subscriber who turns into
// a real enquiry belongs in Leads, where all of that applies again.
export default async function CrmNewsletter() {
  const leads = await prisma.lead.findMany({
    where: { deletedAt: null, ...ONLY_NEWSLETTER },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, email: true, source: true, createdAt: true,
      languagePreference: true, sourceLocale: true,
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">
          Newsletter <span className="text-base font-normal text-[#6B7280]">({leads.length})</span>
        </h1>
        <Link href="/admin/crm" className="text-sm text-[#1B4B43] hover:underline">← Back to leads</Link>
      </div>
      <p className="text-sm text-[#6B7280] mb-4">
        Newsletter subscribers, kept out of the leads list, the pipeline and the Action Center.
        Move one to Leads when they turn into a real enquiry.
      </p>

      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Email</th>
              <th className="text-left font-medium px-4 py-2.5">Subscribed</th>
              <th className="text-left font-medium px-4 py-2.5">Language</th>
              <th className="text-right font-medium px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {leads.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-[#6B7280]">No subscribers yet.</td></tr>
            ) : leads.map((l) => (
              <tr key={l.id} className="hover:bg-[#F8F9FA]">
                <td className="px-4 py-2.5 font-medium text-[#111827]">
                  {/* Linked to the full lead page: the row here is intentionally
                      thin, and everything else about the person lives there. */}
                  <Link href={`/admin/crm/${l.id}`} className="hover:underline">{l.email ?? "—"}</Link>
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">{adminDate(l.createdAt)}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">
                  {(l.languagePreference ?? l.sourceLocale ?? "—").toUpperCase()}
                </td>
                <td className="px-4 py-2.5 text-right"><MoveLeadMenu id={l.id} source={l.source} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the nav entry and its count**

In `src/app/admin/(panel)/layout.tsx`, add the import:

```ts
import { EXCLUDE_NEWSLETTER, ONLY_NEWSLETTER } from "@/lib/crm/leadBucket";
```

Change `buildModules`'s signature (line 18) to take the new count:

```ts
function buildModules(isAdmin: boolean, isOwner: boolean, trashCount: number, activeLeadCount: number, newsletterCount: number, actionCenterCount: number): NavModule[] {
```

Add the nav entry to the `crm` module's `pages`, between Calendar and Trash:

```ts
        { href: "/admin/crm", label: "Leads", count: activeLeadCount, countVariant: "neutral" },
        { href: "/admin/crm/board", label: "Pipeline" },
        { href: "/admin/crm/calendar", label: "Calendar" },
        { href: "/admin/crm/newsletter", label: "Newsletter", count: newsletterCount, countVariant: "neutral" },
        { href: "/admin/crm/trash", label: "Trash", count: trashCount, countVariant: "neutral" },
```

Fetch the count next to the existing two (around line 80) and pass it through:

```ts
  const trashCount = await prisma.lead.count({ where: { deletedAt: { not: null } } });
  const activeLeadCount = await prisma.lead.count({ where: { deletedAt: null, status: { notIn: ["LOST", "CLOSED"] }, ...EXCLUDE_NEWSLETTER } });
  const newsletterCount = await prisma.lead.count({ where: { deletedAt: null, ...ONLY_NEWSLETTER } });
  const actionCenterCount = (await getActionCenterItems()).length;
  const modules = buildModules(user?.role === "ADMIN", dbUser.isOwner, trashCount, activeLeadCount, newsletterCount, actionCenterCount);
```

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(panel)/crm/newsletter/page.tsx" "src/app/admin/(panel)/layout.tsx"
git commit -m "Give newsletter subscribers their own CRM page"
```

---

## Task 6: Keep newsletter leads out of the sales views

**Files:**
- Modify: `src/app/admin/(panel)/crm/filters.ts:6` and `:13`
- Modify: `src/app/admin/(panel)/crm/page.tsx:12` and `:183`
- Modify: `src/app/admin/(panel)/crm/board/page.tsx:27`
- Modify: `src/lib/actionCenter/rules/crm.ts:161`
- Modify: `src/lib/actionCenter/rules/developers.ts:399`

- [ ] **Step 1: Exclude them from the shared lead filter**

In `src/app/admin/(panel)/crm/filters.ts`, add the import:

```ts
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
```

Add the dropdown list under `LEAD_SOURCES` (line 6):

```ts
// The Leads page's own dropdown. NEWSLETTER is missing on purpose: those leads
// live on their own page now, so filtering the leads list by it could only ever
// return an empty list.
export const LEAD_LIST_SOURCES = LEAD_SOURCES.filter((s) => s !== "NEWSLETTER");
```

Change the first line of `buildLeadWhere` (line 13):

```ts
  const where: Prisma.LeadWhereInput = { deletedAt: null };
```

to:

```ts
  // The exclusion goes in AND, never as a top-level `source` key: the URL's own
  // source filter is assigned to where.source further down, and would silently
  // overwrite it. The exclusion would then evaporate for exactly the query that
  // went looking for newsletter leads.
  const where: Prisma.LeadWhereInput = { deletedAt: null, AND: [EXCLUDE_NEWSLETTER] };
```

This one edit also covers the CSV export, which calls `buildLeadWhere`.

- [ ] **Step 2: Drop NEWSLETTER from the filter dropdown**

In `src/app/admin/(panel)/crm/page.tsx`, change the import on line 12 from
`LEAD_SOURCES` to `LEAD_LIST_SOURCES`, and line 183 from:

```tsx
      <LeadFilterBar statuses={LEAD_STATUSES} sources={LEAD_SOURCES} locales={LEAD_LOCALES} users={users} />
```

to:

```tsx
      <LeadFilterBar statuses={LEAD_STATUSES} sources={LEAD_LIST_SOURCES} locales={LEAD_LOCALES} users={users} />
```

- [ ] **Step 3: Exclude them from the Pipeline board**

In `src/app/admin/(panel)/crm/board/page.tsx`, add the import and change line 27:

```ts
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
```

```ts
  const leads = await prisma.lead.findMany({ where: { deletedAt: null, ...EXCLUDE_NEWSLETTER }, orderBy: { updatedAt: "desc" }, take: BOARD_CAP });
```

- [ ] **Step 4: Exclude them from the Action Center**

In `src/lib/actionCenter/rules/crm.ts`, add the import and change line 161:

```ts
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
```

```ts
    where: { status: { in: [...ACTIVE_LEAD_STATUSES] }, deletedAt: null, ...EXCLUDE_NEWSLETTER },
```

In `src/lib/actionCenter/rules/developers.ts`, add the same import and change
line 399:

```ts
          // Newsletter leads carry a pageSource too — the sign-up form records
          // the page it was submitted from — so without this a subscriber who
          // joined while reading a project page would be reported as someone
          // who "had enquired about this project".
          where: { pageSource: { contains: `/projects/${d.slug}` }, status: { in: [...WARM_CONTACT_STATUSES] }, deletedAt: null, ...EXCLUDE_NEWSLETTER },
```

- [ ] **Step 5: Typecheck and build**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: both succeed.

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/(panel)/crm/filters.ts" "src/app/admin/(panel)/crm/page.tsx" "src/app/admin/(panel)/crm/board/page.tsx" src/lib/actionCenter/rules/crm.ts src/lib/actionCenter/rules/developers.ts
git commit -m "Keep newsletter subscribers out of the leads list, pipeline and Action Center"
```

---

## Task 7: Stop a re-subscription creating a duplicate lead

**Files:**
- Modify: `src/app/api/monday-newsletter/route.ts:48-51`

- [ ] **Step 1: Understand what breaks without this**

Run: `sed -n 46,56p src/app/api/monday-newsletter/route.ts`

The de-duplication matches on `email` **and** `source: "NEWSLETTER"`. Once a
subscriber can be moved out of the newsletter bucket, their source is no longer
`NEWSLETTER`, so a re-subscription stops matching and creates a second lead with
the same address. This bug does not exist today — Task 4 introduces it.

- [ ] **Step 2: Match on email alone**

Replace:

```ts
      const existing = await prisma.lead.findFirst({
        where: { email: emailNorm, source: "NEWSLETTER" },
        select: { id: true },
      });
```

with:

```ts
      // Match on the address alone, NOT on source as well. A subscriber can be
      // moved out of the newsletter bucket (see moveLeadToBucket) — matching on
      // source too would stop recognising them and create a second lead with the
      // same address the next time they subscribed.
      const existing = await prisma.lead.findFirst({
        where: { email: emailNorm },
        select: { id: true },
      });
```

Also update the comment on line 46 from `Light dedupe: one NEWSLETTER lead per
email.` to `Light dedupe: one lead per email address, whatever bucket it is in.`

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/monday-newsletter/route.ts
git commit -m "De-duplicate newsletter sign-ups on the address alone"
```

---

## Task 8: Verify against the live data, then hand over

**Files:** none — this task only reads and reports.

- [ ] **Step 1: Re-run the module self-test**

Run: `node scripts/qa/lead-buckets-check.mjs`
Expected: `all passed`, exit code 0.

- [ ] **Step 2: Check the live numbers**

The exclusion has to produce specific counts. Run this read-only script on the
server, where the database credentials already live:

```bash
cat > /tmp/lead-buckets-live-check.mjs <<'EOF'
import { readFileSync } from "node:fs";
for (const l of readFileSync("/var/www/shared/.env", "utf8").split("\n")) {
  if (!l.includes("=") || l.trim().startsWith("#")) continue;
  const i = l.indexOf("=");
  process.env[l.slice(0, i).trim()] ||= l.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}
const { PrismaClient } = await import("/var/www/cyprusvipestates/node_modules/@prisma/client/default.js");
const p = new PrismaClient();
const EX = { source: { not: "NEWSLETTER" } };
const rows = [
  ["Leads (sidebar count)", await p.lead.count({ where: { deletedAt: null, status: { notIn: ["LOST", "CLOSED"] }, ...EX } })],
  ["Newsletter", await p.lead.count({ where: { deletedAt: null, source: "NEWSLETTER" } })],
  ["Pipeline board", await p.lead.count({ where: { deletedAt: null, ...EX } })],
  ["newsletter leaking into pipeline", await p.lead.count({ where: { deletedAt: null, source: "NEWSLETTER", ...EX } })],
];
for (const [k, v] of rows) console.log(`  ${k.padEnd(34)} ${v}`);
await p.$disconnect();
EOF
scp -q -i ~/.ssh/cvp_vps /tmp/lead-buckets-live-check.mjs root@72.60.89.239:/tmp/
ssh -i ~/.ssh/cvp_vps root@72.60.89.239 "node /tmp/lead-buckets-live-check.mjs"
```

Expected, given the ten subscribers imported on 2026-08-27:

```
  Leads (sidebar count)              50
  Newsletter                         10
  Pipeline board                     170
  newsletter leaking into pipeline   0
```

The last row is the one that matters: it applies the exclusion to a query that
asks only for newsletter leads, so it must be 0 by construction. Anything else
means `EXCLUDE_NEWSLETTER` is not what the module says it is.

`Leads` was 60 before this work. If it still reads 60, the exclusion is not
reaching the query — check that `AND` survived the `{ ...baseWhere, status: … }`
spreads in `crm/page.tsx:98-100`.

- [ ] **Step 3: Click through the admin**

The operator is signed in on the Chrome whose deviceId starts `f809a0c5`; ask
them to run this list, or drive it yourself if that browser is connected.

- [ ] Sidebar shows `Newsletter 10` between Calendar and Trash, and `Leads 50`.
- [ ] `/admin/crm/newsletter` lists ten addresses, newest first.
- [ ] No newsletter address appears in `/admin/crm`, `/admin/crm/board`, or the Action Center on `/admin`.
- [ ] The source dropdown on `/admin/crm` no longer offers `NEWSLETTER`.
- [ ] On a newsletter row, `Move… → Leads` moves it; it leaves the Newsletter page and appears in the leads list.
- [ ] On that lead's page, the timeline shows `Moved to Leads — source changed from NEWSLETTER to MANUAL`.
- [ ] `Move… → Partner` on any lead lands it in the blue Partner block.
- [ ] Move the lead back to Newsletter so the ten are whole again.

- [ ] **Step 4: Hand over the deploy**

Do not deploy. The production deploy script is the operator's to run:

```bash
./scripts/deploy-prod.sh
```

Push with `git push origin HEAD`, **never** `git push origin main`: this working
tree is shared with other sessions and HEAD is often not `main`, in which case
the named form pushes an unchanged ref, exits 0, and prints nothing.

---

## Known limitations to state when handing over

Both are in the spec; repeat them in the handover so they are not filed as bugs.

- **A lead can be in only one bucket.** Three people from the Monday import
  (Petra Götting, Iwona Pajak, Rolf van Dyk) are both lost leads and newsletter
  subscribers. They will not appear on the Newsletter page, because `source`
  holds one value and overwriting `MANUAL` would destroy a real lead's origin.
  Fixing it means giving subscribers their own field, which belongs to the
  newsletter system.
- **A round trip does not restore the original source.** A `PROJECT_ENQUIRY`
  lead moved to Partner and back becomes `MANUAL`. The timeline entry records
  where it came from.
- **The Monday API key is dead**, unrelated to this work. Sign-ups reach the CRM
  but not Monday, and the route reports success to the visitor either way.
