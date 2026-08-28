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
// `LeadSource` is imported as a type here too — @prisma/client exports it as
// BOTH a runtime const object and a type, but only the type is used below, so
// this import still erases fully.
import type { LeadSource, Prisma } from "@prisma/client";

export const LEAD_BUCKETS = ["leads", "partner", "newsletter"] as const;
export type LeadBucket = (typeof LEAD_BUCKETS)[number];

export const BUCKET_LABEL: Record<LeadBucket, string> = {
  leads: "Leads",
  partner: "Partner",
  newsletter: "Newsletter",
};

// Compared against typed constants rather than bare string literals. The two
// query fragments below are already protected — Prisma types LeadWhereInput's
// `source` against the enum, so a rename breaks them at build time — but a bare
// literal here would not break anything: bucketOf would simply stop matching and
// silently refile every partner lead and every subscriber into "leads".
const NEWSLETTER_SOURCE: LeadSource = "NEWSLETTER";
const PARTNER_SOURCE: LeadSource = "PARTNER";
const MANUAL_SOURCE: LeadSource = "MANUAL";

// Anything unrecognised lands in "leads". A source this function has never seen
// is far more likely to be a new enquiry channel than a new kind of mailing
// list, and the leads list is the bucket where a human will actually notice it.
export function bucketOf(source: string | null | undefined): LeadBucket {
  if (source === NEWSLETTER_SOURCE) return "newsletter";
  if (source === PARTNER_SOURCE) return "partner";
  return "leads";
}

// Moving INTO "leads" has to name a concrete source, and MANUAL is the honest
// one: a person put this lead here by hand. The cost is that a round trip does
// not restore the original — a lead that arrived as PROJECT_ENQUIRY comes back
// from Partner as MANUAL. moveLeadToBucket writes the old value into the lead's
// timeline, which is where that history survives.
//
// Returns the full LeadSource type (not a narrower literal union) so the Task 2
// server action can pass the result straight into `data: { source: ... }`
// without an `as any` cast.
export function sourceForBucket(bucket: LeadBucket): LeadSource {
  if (bucket === "newsletter") return NEWSLETTER_SOURCE;
  if (bucket === "partner") return PARTNER_SOURCE;
  return MANUAL_SOURCE;
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
