import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateLeadStatus, addLeadNote, assignLead, mergeLeads } from "../../../actions";
import { StatusBadge } from "@/app/admin/status-badge";

export const dynamic = "force-dynamic";

const STATUSES = ["NEW", "QUALIFIED", "CONTACTED", "VIEWING_SCHEDULED", "OFFER", "CLOSED", "LOST"];

export default async function LeadDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const [lead, users] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: {
        activities: { orderBy: { createdAt: "desc" } },
        projectInterest: true,
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!lead) notFound();

  // Possible duplicates: same email or phone, different record (audit H2).
  const duplicates = await prisma.lead.findMany({
    where: {
      id: { not: id },
      OR: [{ email: lead.email }, ...(lead.phone ? [{ phone: lead.phone }] : [])],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, source: true, status: true, createdAt: true },
  });

  // Time in current stage: since the most recent STATUS_CHANGE, else since creation (audit M2).
  const lastChange = lead.activities.find((a) => a.type === "STATUS_CHANGE");
  const stageSince = lastChange?.createdAt ?? lead.createdAt;
  const stageDays = Math.floor((Date.now() - new Date(stageSince).getTime()) / 86_400_000);

  async function setStatus(formData: FormData) {
    "use server";
    await updateLeadStatus(id, String(formData.get("status")), String(formData.get("reason") ?? ""));
  }
  async function note(formData: FormData) {
    "use server";
    await addLeadNote(id, String(formData.get("note") ?? ""));
  }
  async function assign(formData: FormData) {
    "use server";
    await assignLead(id, String(formData.get("assignedToId") ?? ""));
  }
  async function merge(formData: FormData) {
    "use server";
    await mergeLeads(id, String(formData.get("sourceId")));
  }

  const field = (label: string, value: any) =>
    value ? (
      <div className="py-2 border-b border-[#E5E7EB] last:border-0">
        <dt className="text-xs text-[#6B7280]">{label}</dt>
        <dd className="text-sm mt-0.5 break-words">{Array.isArray(value) ? value.join(", ") : String(value)}</dd>
      </div>
    ) : null;

  return (
    <div className="max-w-4xl">
      <Link href="/admin/crm" className="text-sm text-[#1B4B43] hover:underline">← Back to leads</Link>
      <div className="flex items-center gap-3 mt-2 mb-2">
        <h1 className="text-2xl font-semibold">{lead.firstName} {lead.lastName}</h1>
        <StatusBadge status={lead.status} />
        <Link href={`/admin/crm/${id}/edit`} className="ml-auto text-sm text-[#1B4B43] hover:underline">Edit details</Link>
      </div>
      <p className="text-xs text-[#9CA3AF] mb-6">In {lead.status.replace(/_/g, " ")} for {stageDays} day{stageDays === 1 ? "" : "s"}</p>

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

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-lg border border-[#E5E7EB] p-5">
          <h2 className="text-sm font-semibold mb-2">Lead details</h2>
          <dl>
            {field("Email", lead.email)}
            {field("Phone", lead.phone)}
            {field("Nationality", lead.nationality)}
            {field("Language", lead.languagePreference)}
            {field("Budget", lead.budgetMin || lead.budgetMax ? `€${lead.budgetMin ?? "?"} – €${lead.budgetMax ?? "?"}` : null)}
            {field("Timeline", lead.timeline)}
            {field("Financing", lead.financing)}
            {field("Property interest", lead.propertyTypeInterest)}
            {field("Project interest", lead.projectInterest?.title)}
            {field("Message", lead.message)}
            {field("Internal note (intake)", lead.notes)}
            {field("Source", lead.source.replace(/_/g, " "))}
            {field("Page", lead.pageSource)}
            {field("UTM", [lead.utmSource, lead.utmMedium, lead.utmCampaign, lead.utmTerm, lead.utmContent].filter(Boolean).join(" / "))}
            {field("Click ID", [lead.gclid ? `gclid: ${lead.gclid}` : null, lead.fbclid ? `fbclid: ${lead.fbclid}` : null].filter(Boolean).join("  ·  "))}
            {field("Referrer", lead.referrer)}
            {field("Assigned to", lead.assignedTo?.name)}
            {field("Received", new Date(lead.createdAt).toLocaleString("en-GB"))}
            {field("Notified", `Telegram: ${lead.telegramNotified ? "✓" : "—"}  ·  Email: ${lead.emailNotified ? "✓" : "—"}`)}
          </dl>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
            <h2 className="text-sm font-semibold mb-3">Assigned to</h2>
            <form action={assign} className="flex gap-2">
              <select name="assignedToId" defaultValue={lead.assignedToId ?? ""}
                className="flex-1 rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm">
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button className="rounded-md bg-[#1B4B43] text-white text-sm px-3 hover:bg-[#142E2D]">Save</button>
            </form>
          </div>

          <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
            <h2 className="text-sm font-semibold mb-3">Status</h2>
            <form action={setStatus} className="space-y-2">
              <select name="status" defaultValue={lead.status}
                className="w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm">
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
              <input name="reason" placeholder="Reason / note (optional)"
                className="w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" />
              <button className="w-full rounded-md bg-[#1B4B43] text-white text-sm py-1.5 hover:bg-[#142E2D]">Save</button>
            </form>
          </div>

          <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
            <h2 className="text-sm font-semibold mb-3">Add note</h2>
            <form action={note} className="space-y-2">
              <textarea name="note" rows={3} required
                className="w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" placeholder="Internal note…" />
              <button className="w-full rounded-md bg-[#C29A5E] text-white text-sm py-1.5 hover:opacity-90">Add note</button>
            </form>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 mt-6 max-w-3xl">
        <h2 className="text-sm font-semibold mb-3">Activity</h2>
        {lead.activities.length === 0 ? (
          <p className="text-sm text-[#6B7280]">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {lead.activities.map((a) => (
              <li key={a.id} className="text-sm">
                <span className="text-xs text-[#6B7280]">{new Date(a.createdAt).toLocaleString("en-GB")} · {a.type}{a.createdBy ? ` · ${a.createdBy}` : ""}</span>
                <div>{a.content}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
