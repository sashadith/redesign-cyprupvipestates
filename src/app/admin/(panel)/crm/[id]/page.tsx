import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  updateLeadStatus, addLeadNote, assignLead, mergeLeads, updateLeadFollowUp, addCallLog,
  resetLeadFollowUpCadenceAction, deleteLeadInteraction,
} from "../../../actions";
import { sendCrmEmailAction, logWhatsAppSentAction } from "./emailActions";
import { listPresentationLocations } from "./presentationActions";
import PropertyMatching from "./PropertyMatching";
import ExistingPresentations, { type PresentationRow } from "./ExistingPresentations";
import DeleteLeadButton from "../DeleteLeadButton";
import CockpitCard, { type LastContact, type PresentationSummary } from "./CockpitCard";
import UnifiedTimeline, { type TimelineRow } from "./UnifiedTimeline";

export const dynamic = "force-dynamic";

// Module-level, NOT nested inside the component — a plain helper referenced
// by multiple sibling inline "use server" closures (quickNote/quickCall/
// quickWhatsApp below) must live outside the async Server Component itself.
// Next's per-action compiler extracts each "use server" function into its
// own independent compiled module; when the helper was defined inside the
// component body, quickWhatsApp's compiled action came out missing it
// entirely ("ReferenceError: parseOccurredAt is not defined" in production,
// confirmed via pm2 logs on staging) even though quickNote/quickCall's
// bundles happened to include it — a real, reproduced Next.js App Router
// closure-bundling fragility, not something to route around per-action.
//
// datetime-local input value ("2026-07-23T14:30") -> Date, or undefined
// (defaults to now server-side) if left blank/invalid.
function parseOccurredAt(formData: FormData): Date | undefined {
  const raw = String(formData.get("occurredAt") ?? "");
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function LeadDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const [lead, users] = await Promise.all([
    prisma.lead.findFirst({
      where: { id, deletedAt: null },
      include: {
        interactions: { orderBy: { occurredAt: "desc" } },
        projectInterest: true,
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!lead) notFound();

  // Possible duplicates: same email or phone, different record (audit H2).
  // Matches must be non-empty on BOTH sides — a bare `{ email: lead.email }`
  // silently matched every other empty-email lead against each other once
  // bulk imports started leaving `email: ""` on contact-less rows (2026-07-24
  // monday.com import: 63 leads with no email, each showing ~20 false
  // "duplicates" of unrelated people). Phone is also normalized (digits
  // only) so formatting differences ("+971 56 342 8755" vs "+971563428755")
  // don't cause false negatives — compared in JS since Postgres can't
  // normalize on the fly; the lead table is small enough (low hundreds) for
  // this to be cheap, same tradeoff already made elsewhere in this file.
  const normalizeEmail = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();
  const normalizePhone = (p: string | null | undefined) => (p ?? "").replace(/[^\d]/g, "");
  const myEmail = normalizeEmail(lead.email);
  const myPhone = normalizePhone(lead.phone);
  const duplicates = !myEmail && !myPhone ? [] : (
    await prisma.lead.findMany({
      where: { id: { not: id }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, source: true, status: true, createdAt: true },
    })
  ).filter((d) => (myEmail && normalizeEmail(d.email) === myEmail) || (myPhone && normalizePhone(d.phone) === myPhone))
    .slice(0, 20);

  // Time in current stage: since the most recent STATUS_CHANGE, else since creation (audit M2).
  const lastChange = lead.interactions.find((i) => i.type === "STATUS_CHANGE");
  const stageSince = lastChange?.occurredAt ?? lead.createdAt;
  const stageDays = Math.floor((Date.now() - new Date(stageSince).getTime()) / 86_400_000);

  // Lead Cockpit "last contact" — newest interaction that actually represents
  // contact with the lead (direction set), not internal/system bookkeeping.
  const lastContactRow = lead.interactions.find((i) => i.direction != null);
  const lastContact: LastContact = lastContactRow
    ? { occurredAt: lastContactRow.occurredAt, direction: lastContactRow.direction, channel: lastContactRow.channel }
    : null;

  // Client Presentation system: matching-panel data + existing presentations for this lead.
  const [session, locations, rawPresentations] = await Promise.all([
    auth(),
    listPresentationLocations(),
    prisma.clientPresentation.findMany({
      where: { leadId: id },
      orderBy: { createdAt: "desc" },
      include: {
        views: { select: { developmentId: true, durationSec: true, createdAt: true } },
        items: { select: { developmentId: true, isFavorited: true, development: { select: { publicName: true, override: { select: { alias: true } } } } } },
      },
    }),
  ]);
  const presentationRows: PresentationRow[] = rawPresentations.map((p) => {
    const uniqueDays = new Set(p.views.map((v) => v.createdAt.toISOString().slice(0, 10))).size;
    const perDev = new Map<string, { views: number; durationSec: number }>();
    for (const v of p.views) {
      if (!v.developmentId) continue;
      const cur = perDev.get(v.developmentId) ?? { views: 0, durationSec: 0 };
      cur.views += 1; cur.durationSec += v.durationSec ?? 0;
      perDev.set(v.developmentId, cur);
    }
    const nameOf = (devId: string) => {
      const it = p.items.find((i) => i.developmentId === devId);
      return it?.development.override?.alias || it?.development.publicName || "—";
    };
    return {
      id: p.id, token: p.token, status: p.status, createdAt: p.createdAt, expiresAt: p.expiresAt,
      viewCount: p.views.length, favoritedCount: p.items.filter((i) => i.isFavorited).length,
      uniqueDays,
      perDevelopment: Array.from(perDev.entries()).map(([developmentId, v]) => ({ developmentId, name: nameOf(developmentId), views: v.views, durationSec: v.durationSec })),
      favoritedNames: p.items.filter((i) => i.isFavorited).map((i) => i.development.override?.alias || i.development.publicName),
    };
  });
  // Cockpit's compact summary references the most recent presentation only
  // (rawPresentations is already newest-first) — the full per-presentation
  // breakdown, including older ones, stays in ExistingPresentations below.
  const primary = rawPresentations[0];
  const presentationSummary: PresentationSummary = primary
    ? {
        sentAt: primary.createdAt,
        viewCount: primary.views.length,
        favoritedCount: primary.items.filter((i) => i.isFavorited).length,
        lastViewedAt: primary.views.length ? new Date(Math.max(...primary.views.map((v) => v.createdAt.getTime()))) : null,
      }
    : null;
  const currentUser = session?.user ? { id: (session.user as any).id as string, name: session.user.name ?? "Advisor" } : null;

  const timelineRows: TimelineRow[] = lead.interactions.map((i) => ({
    id: i.id,
    type: i.type,
    direction: i.direction,
    channel: i.channel,
    subject: i.subject,
    body: i.body,
    occurredAt: i.occurredAt.toISOString(),
    createdByName: i.createdByName,
    metadata: i.metadata as TimelineRow["metadata"],
  }));

  // Absorbed into CockpitCard's detail groups (see that component) — computed
  // once here, same shape the old page.tsx <dl> built inline.
  const utm = [lead.utmSource, lead.utmMedium, lead.utmCampaign, lead.utmTerm, lead.utmContent].filter(Boolean).join(" / ");
  const clickId = [lead.gclid ? `gclid: ${lead.gclid}` : null, lead.fbclid ? `fbclid: ${lead.fbclid}` : null].filter(Boolean).join("  ·  ");

  async function setStatus(formData: FormData) {
    "use server";
    await updateLeadStatus(id, String(formData.get("status")), String(formData.get("reason") ?? ""));
  }
  async function assign(formData: FormData) {
    "use server";
    await assignLead(id, String(formData.get("assignedToId") ?? ""));
  }
  async function merge(formData: FormData) {
    "use server";
    await mergeLeads(id, String(formData.get("sourceId")));
  }
  async function saveFollowUp(formData: FormData) {
    "use server";
    await updateLeadFollowUp(id, String(formData.get("nextFollowUpAt") ?? ""));
  }
  async function resetFollowUp() {
    "use server";
    await resetLeadFollowUpCadenceAction(id);
  }
  async function quickNote(formData: FormData) {
    "use server";
    await addLeadNote(id, String(formData.get("note") ?? ""), parseOccurredAt(formData), formData.get("leadReacted") === "on");
  }
  async function quickCall(formData: FormData) {
    "use server";
    await addCallLog(id, String(formData.get("note") ?? ""), parseOccurredAt(formData), formData.get("leadReacted") === "on");
  }
  async function sendEmail(opts: { subject: string; body: string; occurredAt?: Date; leadReacted?: boolean }) {
    "use server";
    return sendCrmEmailAction(id, opts);
  }
  async function sendPresentationEmail(opts: { subject: string; body: string; leadReacted?: boolean; presentationToken?: string }) {
    "use server";
    return sendCrmEmailAction(id, { ...opts, skipCadence: true });
  }
  // Walkthrough-2 feedback: +WhatsApp is now log-only, same shape as
  // quickNote/quickCall (no more wa.me tab-opening — sending happens on the
  // advisor's own phone regardless).
  async function quickWhatsApp(formData: FormData) {
    "use server";
    await logWhatsAppSentAction(id, {
      body: String(formData.get("note") ?? ""),
      occurredAt: parseOccurredAt(formData),
      leadReacted: formData.get("leadReacted") === "on",
    });
  }
  async function deleteInteraction(interactionId: string) {
    "use server";
    await deleteLeadInteraction(interactionId);
  }

  return (
    <div className="max-w-4xl">
      <Link href="/admin/crm" className="text-sm text-[#1B4B43] hover:underline">← Back to leads</Link>

      <div className="mt-2 mb-6">
        <CockpitCard
          stageDays={stageDays}
          lead={{
            id,
            firstName: lead.firstName,
            lastName: lead.lastName,
            status: lead.status,
            languagePreference: lead.languagePreference,
            nationality: lead.nationality,
            source: lead.source,
            phone: lead.phone,
            email: lead.email,
            preferredChannel: lead.preferredChannel,
            nextFollowUpAt: lead.nextFollowUpAt,
            autoFollowUpCount: lead.autoFollowUpCount,
            assignedTo: lead.assignedTo,
            budgetMin: lead.budgetMin,
            budgetMax: lead.budgetMax,
            timeline: lead.timeline,
            financing: lead.financing,
            propertyTypeInterest: lead.propertyTypeInterest,
            projectInterestTitle: lead.projectInterest?.title ?? null,
            message: lead.message,
            notes: lead.notes,
            pageSource: lead.pageSource,
            utm,
            clickId,
            referrer: lead.referrer,
            createdAt: lead.createdAt,
            telegramNotified: lead.telegramNotified,
            emailNotified: lead.emailNotified,
          }}
          users={users}
          lastContact={lastContact}
          presentationSummary={presentationSummary}
          assignAction={assign}
          saveFollowUpAction={saveFollowUp}
          resetFollowUpAction={resetFollowUp}
          setStatusAction={setStatus}
        />
      </div>

      {duplicates.length > 0 && (
        <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-[#9A3412] mb-2">⚠ Possible duplicate{duplicates.length > 1 ? "s" : ""} ({duplicates.length})</h2>
          <ul className="space-y-2">
            {duplicates.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <Link href={`/admin/crm/${d.id}`} className="text-[#1B4B43] font-medium hover:underline">{d.firstName} {d.lastName}</Link>
                  <span className="text-[#6B7280]"> · {d.email}{d.phone ? ` · ${d.phone}` : ""} · {d.source.replace(/_/g, " ")} · {new Date(d.createdAt).toLocaleDateString("en-GB")}</span>
                </span>
                <form action={merge}>
                  <input type="hidden" name="sourceId" value={d.id} />
                  <button className="rounded-md border border-[#9A3412] text-[#9A3412] text-xs px-2 py-1 hover:bg-[#9A3412] hover:text-white">Merge into this lead</button>
                </form>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-[#9A3412]/70 mt-2">Merging moves the other lead’s activity here and deletes it.</p>
        </div>
      )}

      <div className="mb-6">
        <UnifiedTimeline
          interactions={timelineRows}
          leadEmail={lead.email}
          leadPhone={lead.phone}
          addNoteAction={quickNote}
          addCallAction={quickCall}
          sendEmailAction={sendEmail}
          logWhatsAppAction={quickWhatsApp}
          deleteAction={deleteInteraction}
        />
      </div>

      <div className="space-y-6 mb-6">
        <ExistingPresentations presentations={presentationRows} leadId={id} />
        <PropertyMatching
          leadId={id}
          lead={{ firstName: lead.firstName, budgetMin: lead.budgetMin, budgetMax: lead.budgetMax, propertyTypeInterest: lead.propertyTypeInterest, languagePreference: lead.languagePreference, phone: lead.phone, email: lead.email, lastMatchFilters: lead.lastMatchFilters as any }}
          locations={locations}
          currentUser={currentUser}
          users={users}
          sendPresentationEmailAction={sendPresentationEmail}
        />
      </div>

      {/* Walkthrough-2 feedback: moved from directly under the Cockpit card to
          the very bottom of the page, below every section, so it's not next
          to anything easy to misclick into. Status duration moved back up
          into the CockpitCard header (next to the locale badge). */}
      <div className="pt-4 border-t border-[#E5E7EB]">
        <DeleteLeadButton id={id} redirectTo="/admin/crm" label="Delete lead" />
      </div>
    </div>
  );
}
