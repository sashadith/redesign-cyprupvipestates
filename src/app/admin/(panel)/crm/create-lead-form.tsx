"use client";
import { useFormState, useFormStatus } from "react-dom";
import { createLead } from "../../actions";

const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";
const STATUSES = ["NEW", "QUALIFIED", "CONTACTED", "VIEWING_SCHEDULED", "OFFER", "CLOSED", "LOST"];
const TIMELINES = ["", "IMMEDIATE", "THREE_MONTHS", "SIX_MONTHS", "ONE_YEAR", "JUST_LOOKING"];
const FINANCING = ["", "CASH", "MORTGAGE", "UNDECIDED"];
const PROP_TYPES = ["Apartment", "Villa", "Townhouse", "Penthouse"];

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D] disabled:opacity-60">
      {pending ? "Creating…" : "Create lead"}
    </button>
  );
}

export default function CreateLeadForm({ users }: { users: { id: string; name: string }[] }) {
  const [state, action] = useFormState<{ error?: string } | null>(createLead as any, null);
  return (
    <form action={action} className="space-y-5 max-w-2xl">
      {state?.error && <p className="text-sm text-[#C0392B] bg-[#C0392B]/10 rounded px-3 py-2">{state.error}</p>}

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
        <h2 className="text-sm font-semibold">Contact</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm mb-1">First name *</label><input name="firstName" required className={input} /></div>
          <div><label className="block text-sm mb-1">Last name</label><input name="lastName" className={input} /></div>
          <div><label className="block text-sm mb-1">Email *</label><input name="email" type="email" required className={input} /></div>
          <div><label className="block text-sm mb-1">Phone</label><input name="phone" className={input} /></div>
          <div><label className="block text-sm mb-1">Nationality</label><input name="nationality" className={input} /></div>
          <div><label className="block text-sm mb-1">Language</label>
            <select name="languagePreference" className={input} defaultValue=""><option value="">—</option>{["en", "de", "pl", "ru"].map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}</select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
        <h2 className="text-sm font-semibold">Qualification</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm mb-1">Budget min (€)</label><input name="budgetMin" type="number" min="0" className={input} /></div>
          <div><label className="block text-sm mb-1">Budget max (€)</label><input name="budgetMax" type="number" min="0" className={input} /></div>
          <div><label className="block text-sm mb-1">Timeline</label>
            <select name="timeline" className={input} defaultValue="">{TIMELINES.map((t) => <option key={t} value={t}>{t ? t.replace(/_/g, " ") : "—"}</option>)}</select>
          </div>
          <div><label className="block text-sm mb-1">Financing</label>
            <select name="financing" className={input} defaultValue="">{FINANCING.map((f) => <option key={f} value={f}>{f || "—"}</option>)}</select>
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Property interest</label>
          <div className="flex flex-wrap gap-3">
            {PROP_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="propertyTypeInterest" value={t} /> {t}</label>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
        <h2 className="text-sm font-semibold">Details</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm mb-1">Status</label>
            <select name="status" className={input} defaultValue="NEW">{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>
          </div>
          <div><label className="block text-sm mb-1">Assign to</label>
            <select name="assignedToId" className={input} defaultValue=""><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          </div>
        </div>
        <div><label className="block text-sm mb-1">Message</label><textarea name="message" rows={2} className={input} /></div>
        <div><label className="block text-sm mb-1">Internal note</label><textarea name="notes" rows={2} className={input} /></div>
      </div>

      <SubmitBtn />
    </form>
  );
}
