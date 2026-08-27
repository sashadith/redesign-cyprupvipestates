# CRM lead buckets: a Newsletter view, and moving leads between buckets

Date: 2026-08-27
Status: approved, not yet implemented

## Problem

Two requests from the operator, which turned out to share one mechanism.

**Newsletter subscribers sit in the sales pipeline.** `/api/monday-newsletter`
creates a `Lead` with `source: "NEWSLETTER"` for every sign-up, so subscribers
land in the Leads list, the Pipeline board and the Action Center alongside real
prospects. They arrive as `status: NEW` with no logged contact, which the colour
band reads as "first contact overdue" — ten red dots and ten reminders for
people who only joined a mailing list. They need their own place.

**A lead cannot be moved to Partner.** The Partner block in the lead list keys
off `source === "PARTNER"`, but `source` is not editable anywhere in the admin —
not even in the edit form. A lead that turns out to come from a partner has no
way to get there.

## Context established while designing

- `LeadSource` already has `NEWSLETTER` and `PARTNER`; `LeadInteractionType`
  already has `SYSTEM`; `LeadActivity.type` is a free-text String. **No
  migration is required for any of this work.**
- Current spread of live leads: `MANUAL` 147, `PROJECT_ENQUIRY` 12,
  `NEWSLETTER` 10, `CONTACT_FORM` 5, `PARTNER` 5.
- The ten newsletter leads are one organic sign-up plus nine imported on
  2026-08-27 from the Monday board, which held nothing but email addresses. Its
  API key is dead ("Not authenticated"), so the import was transcribed by hand
  rather than fetched.
- The Calendar page reads `bookingRequest`, not `lead`, so it needs no change.

## Design

### The shared idea: three buckets

`source` decides which bucket a lead sits in.

| Bucket | `source` | Where it shows |
| --- | --- | --- |
| Leads | everything else | Leads list |
| Partner | `PARTNER` | blue block inside the Leads list (already built) |
| Newsletter | `NEWSLETTER` | new page |

New leaf module `src/lib/crm/leadBucket.ts` — no imports beyond Prisma types, so
both server components and client components can use it:

```ts
export type LeadBucket = "leads" | "partner" | "newsletter";
export function bucketOf(source: string): LeadBucket;
export function sourceForBucket(b: LeadBucket): "MANUAL" | "PARTNER" | "NEWSLETTER";
export const BUCKET_LABEL: Record<LeadBucket, string>;
export const EXCLUDE_NEWSLETTER: Prisma.LeadWhereInput; // { source: { not: "NEWSLETTER" } }
export const ONLY_NEWSLETTER: Prisma.LeadWhereInput;    // { source: "NEWSLETTER" }
```

The module exists mostly for those two fragments. The exclusion has to appear in
five separate queries; five hand-written copies would drift apart the first time
someone adds a sixth. `ONLY_NEWSLETTER` is the counterpart the Newsletter page
and its sidebar count use, so the one place that selects newsletter leads reads
from the same module as the five that reject them, rather than repeating a bare
`"NEWSLETTER"` literal.

Moving **to** the Leads bucket sets `source = MANUAL` — "a person put this here
by hand" is the honest statement. This means a lead that arrived as
`PROJECT_ENQUIRY` comes back as `MANUAL`: the field holds one value, so the
original is recoverable only from the timeline entry the move writes. Accepted
deliberately; the alternative (stashing a shadow "original source" column) buys
little and costs a migration.

### Feature 1 — the Newsletter view

**Navigation.** One entry in `src/app/admin/(panel)/layout.tsx`, between
`Calendar` and `Trash`, with a neutral count like Trash has:

```ts
{ href: "/admin/crm/newsletter", label: "Newsletter", count: newsletterCount, countVariant: "neutral" }
```

`newsletterCount = prisma.lead.count({ where: { deletedAt: null, source: "NEWSLETTER" } })`,
fetched next to the existing `trashCount` and `activeLeadCount`.

**Page** `src/app/admin/(panel)/crm/newsletter/page.tsx` — a lean table: email,
name, subscribed on, language, and the move menu.

Deliberately **not** a reuse of the leads table. No colour dot, no status
popover, no hot toggle. Those are sales instruments, and a subscriber is not a
sales process. Modelled on `crm/trash/page.tsx`, which is the existing precedent
for "a second, simpler list of leads".

**Exclusion, in exactly five places:**

| File | Change |
| --- | --- |
| `crm/filters.ts` → `buildLeadWhere` | newsletter leaves the Leads list **and the CSV export** |
| `(panel)/layout.tsx` → `activeLeadCount` | sidebar count 60 → 50 |
| `crm/board/page.tsx` | leaves the Pipeline |
| `lib/actionCenter/rules/crm.ts` | no more reminders for subscribers |
| `lib/actionCenter/rules/developers.ts` | not counted as an "interested lead" |

Two entries were corrected after reading the code, having first been guessed
from file names:

- **`crm/export/route.ts` needs no edit.** It already calls `buildLeadWhere(sp)`
  and inherits the exclusion — as it should, since an export that disagreed with
  the list it came from would be worse than either.
- **`rules/developers.ts` does need one.** Its `backInStockReminders()` counts
  leads whose `pageSource` contains a project slug, and the newsletter route
  stores `pageSource: page`. A subscriber who signed up while reading a project
  page would otherwise be reported as someone who "had enquired about this
  project".

**One trap inside `buildLeadWhere`.** It assigns `where.source` from the URL
filter *after* the base object is built, so a plain `source: { not: "NEWSLETTER" }`
in the base would be silently overwritten by `?source=NEWSLETTER` — the exclusion
would evaporate exactly when someone went looking for newsletter leads. It goes
into an `AND` array instead, where nothing can clobber it. `NEWSLETTER` also
comes out of the Leads page's source dropdown, since that filter can no longer
match anything.

The Dashboard (`(panel)/page.tsx`) keeps counting every lead. Its "leads by
source" breakdown is a census, not a work queue, and hiding a source from a
source breakdown would be actively misleading.

### Feature 2 — moving a lead between buckets

**`MoveLeadMenu.tsx`** (client component): a small menu offering the three
buckets, with the current one disabled. Rendered in three places — the lead row
next to the delete button, the lead detail page, and the newsletter table.

**Server action `moveLeadToBucket(id, bucket)`** in `src/app/admin/actions.ts`,
following `updateLeadStatus` (same file) step for step:

1. `requireSession()`, validate `bucket` against the three known values.
2. Read the current `source`. If it already maps to the target bucket, return
   without writing — a no-op must not litter the timeline.
3. Update `source` to `sourceForBucket(bucket)`.
4. Write **both** timeline rows, as every other lead mutation does:
   - `LeadActivity` with `type: "SOURCE_CHANGE"`
   - `LeadInteraction` with `type: SYSTEM`, `channel: "SYSTEM"`,
     `metadata: { fromSource, toSource }`
   - body: `Moved to Partner — source changed from PROJECT_ENQUIRY to PARTNER`
5. `revalidatePath` for `/admin/crm/${id}`, `/admin/crm`,
   `/admin/crm/newsletter`, `/admin`.

Writing `metadata` structured rather than only as prose follows the reasoning
already recorded for `metadata.toStatus` in `updateLeadStatus`: a later consumer
should not have to parse a sentence.

### One adjacent fix

`/api/monday-newsletter` de-duplicates on `email` **and** `source: "NEWSLETTER"`.
Once a subscriber can be moved out of the newsletter bucket, a re-subscription
would no longer match and would create a **second lead with the same address**.
Drop `source` from that lookup so it matches on email alone.

This is one line, and the bug it prevents is one this very feature introduces.

## Out of scope

- **Bulk selection.** Decided against: the lead list has no checkboxes today, so
  it would mean a selection layer plus a bulk-action bar for an occasional
  re-filing job.
- **A subscriber model.** Three people from the Monday import (Petra Götting,
  Iwona Pajak, Rolf van Dyk) are simultaneously lost leads and newsletter
  subscribers. They will never appear in the Newsletter view, because `source`
  can hold only one of the two, and overwriting `MANUAL` would destroy a real
  lead's provenance. Solving this properly needs a separate flag or table, and
  it belongs to the newsletter system the operator plans to build next — not
  here. Recorded so it is not rediscovered as a bug.
- **The dead Monday key.** Sign-ups reach the CRM but not Monday, and the route
  reports success to the visitor either way. A separate decision: repair the
  token, or retire the Monday branch now that the CRM is the system of record.

## Verification

- `bucketOf` / `sourceForBucket` round-trip for all eleven `LeadSource` values.
- After the change, with 10 newsletter leads live: sidebar Leads count reads 50,
  Newsletter reads 10, and no newsletter lead appears in the Leads list, the
  Pipeline, the Action Center or the CSV export.
- Moving a lead to Partner and back to Leads leaves exactly two timeline entries
  and ends at `source = MANUAL`.
- Moving a lead to the bucket it is already in writes nothing.
