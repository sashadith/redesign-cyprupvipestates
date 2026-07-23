import Link from "next/link";
import { headers } from "next/headers";
import { revokePresentationAction, extendPresentationAction } from "./presentationActions";
import DeletePresentationButton from "./DeletePresentationButton";
import CollapsibleList from "../CollapsibleList";

// Same reasoning as api/admin/presentations/route.ts: build the origin from
// the actual request (this admin panel currently lives on staging), not the
// hardcoded production SITE_URL constant — otherwise the displayed links here
// would mismatch the ones actually generated (and mismatch whatever domain
// the admin is looking at this page from).
function requestOrigin(): string {
  const h = headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("host");
  return host ? `${proto}://${host}` : "https://cyprusvipestates.com";
}

export type PresentationRow = {
  id: string;
  token: string;
  status: string;
  createdAt: Date;
  expiresAt: Date | null;
  viewCount: number;
  favoritedCount: number;
  uniqueDays: number;
  perDevelopment: { developmentId: string; name: string; views: number; durationSec: number }[];
  favoritedNames: string[];
};

const fmtDuration = (sec: number) => (sec < 60 ? `${sec}s` : `${Math.round(sec / 60)}m`);

const STATUS_STYLE: Record<string, string> = {
  active: "bg-[#DCFCE7] text-[#166534]",
  expired: "bg-[#F3F4F6] text-[#6B7280]",
  revoked: "bg-[#FEE2E2] text-[#991B1B]",
};

export default function ExistingPresentations({ presentations, leadId }: { presentations: PresentationRow[]; leadId: string }) {
  if (presentations.length === 0) return null;

  async function revoke(formData: FormData) {
    "use server";
    await revokePresentationAction(String(formData.get("id")));
  }
  async function extend(formData: FormData) {
    "use server";
    await extendPresentationAction(String(formData.get("id")), 30);
  }

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
      <h2 className="text-base font-semibold text-[#111827] mb-3">Client Presentations</h2>
      <div className="space-y-2">
        {presentations.map((p) => {
          const url = `${requestOrigin()}/c/${p.token}`;
          const expired = p.expiresAt ? p.expiresAt < new Date() : false;
          const effectiveStatus = p.status === "active" && expired ? "expired" : p.status;
          return (
            <div key={p.id} className="border border-[#E5E7EB] rounded-md px-3 py-2">
              <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
                <div className="min-w-0">
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#1B4B43] font-medium hover:underline break-all">{url}</a>
                  <div className="text-xs text-[#6B7280] mt-0.5">
                    {new Date(p.createdAt).toLocaleDateString("en-GB")}
                    {" · "}{p.viewCount} view{p.viewCount === 1 ? "" : "s"}
                    {p.uniqueDays > 0 && ` (${p.uniqueDays} day${p.uniqueDays === 1 ? "" : "s"})`}
                    {" · "}{p.favoritedCount} favorited
                    {p.expiresAt && ` · expires ${new Date(p.expiresAt).toLocaleDateString("en-GB")}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`rounded px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[effectiveStatus] ?? "bg-[#F3F4F6] text-[#6B7280]"}`}>{effectiveStatus}</span>
                  <Link href={`/admin/crm/${leadId}/presentations/${p.id}/edit`} className="rounded-md border border-[#E5E7EB] text-xs px-2 py-1 hover:bg-[#F8F9FA]">Edit</Link>
                  <form action={extend}><input type="hidden" name="id" value={p.id} /><button className="rounded-md border border-[#E5E7EB] text-xs px-2 py-1 hover:bg-[#F8F9FA]">+30 days</button></form>
                  {p.status !== "revoked" && (
                    <form action={revoke}><input type="hidden" name="id" value={p.id} /><button className="rounded-md border border-[#FECACA] text-[#DC2626] text-xs px-2 py-1 hover:bg-[#FEF2F2]">Revoke</button></form>
                  )}
                  <DeletePresentationButton id={p.id} />
                </div>
              </div>
              {(p.perDevelopment.length > 0 || p.favoritedNames.length > 0) && (() => {
                const extraFavorites = p.favoritedNames.filter((n) => !p.perDevelopment.some((d) => d.name === n));
                const rowCount = p.perDevelopment.length + extraFavorites.length;
                return (
                  <details className="mt-2">
                    <summary className="text-xs text-[#1B4B43] cursor-pointer select-none">Engagement</summary>
                    <div className="mt-2">
                      <CollapsibleList itemCount={rowCount} previewCount={5}>
                        {p.perDevelopment.map((d, i) => (
                          <div key={d.developmentId} className={`flex items-center justify-between text-xs text-[#374151] ${i > 0 ? "mt-1.5" : ""}`}>
                            <span>{d.name}{p.favoritedNames.includes(d.name) && <span className="text-[#DC2626] ml-1">♥</span>}</span>
                            <span className="text-[#9CA3AF]">{d.views} view{d.views === 1 ? "" : "s"} · {fmtDuration(d.durationSec)}</span>
                          </div>
                        ))}
                        {extraFavorites.map((n, i) => (
                          <div key={n} className={`flex items-center justify-between text-xs text-[#374151] ${(p.perDevelopment.length + i) > 0 ? "mt-1.5" : ""}`}>
                            <span>{n}<span className="text-[#DC2626] ml-1">♥</span></span>
                            <span className="text-[#9CA3AF]">no card view recorded</span>
                          </div>
                        ))}
                      </CollapsibleList>
                    </div>
                  </details>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
