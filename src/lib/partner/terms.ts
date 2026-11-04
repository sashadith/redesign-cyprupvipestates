import { parseRate } from "@/lib/crm/rateForm";

export type PartnerTermsInput = { handoverShare: string; fixShare: string; trustMode: boolean; managerUserId: string | null };

function share(raw: unknown, label: string): { ok: true; value: number } | { ok: false; error: string } {
  const s = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw : "";
  const r = parseRate(s);
  if (!r.ok) return { ok: false, error: `${label}: ${r.error}` };
  if (r.value < 0 || r.value > 100) return { ok: false, error: `${label}: must be between 0 and 100.` };
  return r;
}

export function parseTerms(raw: unknown):
  | { ok: true; value: { handoverShare: number; fixShare: number; trustMode: boolean; managerUserId: string | null } }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid input." };
  const r = raw as Record<string, unknown>;
  const h = share(r.handoverShare, "Handover share");
  if (!h.ok) return h;
  const f = share(r.fixShare, "Fix share");
  if (!f.ok) return f;
  if (typeof r.trustMode !== "boolean") return { ok: false, error: "Invalid trust mode." };
  const m = r.managerUserId;
  if (m !== null && (typeof m !== "string" || !m)) return { ok: false, error: "Invalid manager." };
  return { ok: true, value: { handoverShare: h.value, fixShare: f.value, trustMode: r.trustMode, managerUserId: m as string | null } };
}
