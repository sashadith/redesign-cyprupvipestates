"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDeveloperImpact, deactivateDeveloper, reactivateDeveloper, deleteDeveloper } from "@/app/admin/actions";
import { deleteConfirmationMatches, type DeveloperImpact } from "@/lib/developerLifecycle";

// Deactivate / reactivate / delete for a public developer page (2026-10-09).
// Every action covers ALL language versions of the page. The dialogs load the
// impact (linked account, published projects) fresh when opened, so the
// numbers shown are the ones the action will act on.
type Mode = "deactivate" | "delete" | null;

const LANG = (rows: DeveloperImpact["rows"]) => rows.map((r) => r.language.toUpperCase()).join(", ");

export default function DeveloperLifecycleControls({ id, deactivatedAt }: { id: string; deactivatedAt: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [impact, setImpact] = useState<DeveloperImpact | null>(null);
  const [archive, setArchive] = useState<"keep" | "archive">("keep");
  const [typed, setTyped] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();

  const open = (m: Mode) => {
    setMode(m); setImpact(null); setArchive("keep"); setTyped(""); setMsg(null);
    start(async () => setImpact(await getDeveloperImpact(id)));
  };
  const close = () => setMode(null);

  const runDeactivate = () => start(async () => {
    const r = await deactivateDeveloper(id, archive === "archive");
    setMsg(r);
    if (r.ok) { setMode(null); router.refresh(); }
  });
  const runReactivate = () => start(async () => {
    const r = await reactivateDeveloper(id);
    setMsg(r);
    if (r.ok) router.refresh();
  });
  const runDelete = () => start(async () => {
    const r = await deleteDeveloper(id, typed); // redirects on success
    if (r?.error) setMsg(r);
  });

  const projectCount = impact ? impact.publishedDevelopments.length + impact.publishedProjects.length : 0;

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-4 mb-6 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm">
          <span className="font-medium text-[#111827]">Public page: </span>
          {deactivatedAt ? (
            <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-[#FEE2E2] text-[#991B1B]">
              Inactive since {new Date(deactivatedAt).toLocaleDateString("en-GB")} · redirects to /developers
            </span>
          ) : (
            <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-[#DCFCE7] text-[#166534]">Active</span>
          )}
        </div>
        <div className="flex gap-2">
          {deactivatedAt ? (
            <button type="button" onClick={runReactivate} disabled={pending}
              className="rounded-md border border-[#E5E7EB] text-sm px-3 py-1.5 hover:bg-[#F8F9FA] disabled:opacity-60">
              {pending ? "…" : "Reactivate"}
            </button>
          ) : (
            <button type="button" onClick={() => open("deactivate")} disabled={pending}
              className="rounded-md border border-[#FCD34D] text-[#92400E] text-sm px-3 py-1.5 hover:bg-[#FFFBEB] disabled:opacity-60">
              Deactivate
            </button>
          )}
          <button type="button" onClick={() => open("delete")} disabled={pending}
            className="rounded-md border border-[#FCA5A5] text-[#991B1B] text-sm px-3 py-1.5 hover:bg-[#FEF2F2] disabled:opacity-60">
            Delete
          </button>
        </div>
      </div>
      {msg && !mode && (
        <p className={`text-xs ${msg.error ? "text-[#991B1B]" : "text-[#166534]"}`}>{msg.error ?? msg.ok}</p>
      )}

      {mode && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 w-full max-w-lg space-y-4">
            {!impact ? (
              <p className="text-sm text-[#6B7280]">Loading…</p>
            ) : mode === "deactivate" ? (
              <>
                <h3 className="text-base font-semibold">Deactivate “{impact.title}”?</h3>
                <p className="text-sm text-[#6B7280]">
                  The developer page goes offline in all languages ({LANG(impact.rows)}) and redirects (308) to the
                  developers overview. It leaves the overview, the sitemap and the “Developer” link on project pages.
                  You can reactivate it at any time.
                </p>
                {impact.redirectsIn.length > 0 && (
                  <p className="text-sm text-[#6B7280]">
                    {impact.redirectsIn.length} old project URL{impact.redirectsIn.length === 1 ? "" : "s"} currently redirect here; they are re-pointed to the developers overview.
                  </p>
                )}
                <fieldset className="space-y-2 text-sm">
                  <label className="flex items-start gap-2">
                    <input type="radio" name="archive" checked={archive === "keep"} onChange={() => setArchive("keep")} className="mt-1" />
                    <span><span className="font-medium">Keep project pages live</span><br />
                      <span className="text-[#6B7280]">Only the developer page goes offline.</span></span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input type="radio" name="archive" checked={archive === "archive"} onChange={() => setArchive("archive")} className="mt-1" disabled={projectCount === 0} />
                    <span><span className="font-medium">Also archive all its projects</span>{" "}
                      <span className="text-[#6B7280]">({projectCount} published page{projectCount === 1 ? "" : "s"})</span><br />
                      <span className="text-[#6B7280]">
                        {impact.account ? <>Developments of “{impact.account.name}”: {impact.publishedDevelopments.length}. </> : <>No linked developer account. </>}
                        Legacy project pages: {impact.publishedProjects.length}. Archived pages return 404; reactivating does not republish them.
                      </span></span>
                  </label>
                </fieldset>
                {impact.publishedDevelopments.length > 0 && archive === "archive" && (
                  <ul className="max-h-40 overflow-y-auto text-xs border border-[#E5E7EB] rounded-md divide-y divide-[#E5E7EB]">
                    {impact.publishedDevelopments.map((d) => (
                      <li key={d.id} className="px-3 py-1 text-[#374151]">{d.name}{d.slug ? <span className="text-[#9CA3AF]"> · /projects/{d.slug}</span> : null}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-[#991B1B]">Delete “{impact.title}” permanently?</h3>
                <div className="rounded-md border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#991B1B] space-y-1">
                  <p>All {impact.rows.length} language version{impact.rows.length === 1 ? "" : "s"} ({LANG(impact.rows)}) are deleted. The URLs then return 404. This cannot be undone.</p>
                  {impact.account && <p>The developer account “{impact.account.name}” is unlinked from this page (the account and its developments stay).</p>}
                  {impact.linkingProjects > 0 && <p>{impact.linkingProjects} legacy project{impact.linkingProjects === 1 ? "" : "s"} lose their “Developer” link.</p>}
                  {projectCount > 0 && <p>{projectCount} published project page{projectCount === 1 ? "" : "s"} stay live.</p>}
                  {impact.redirectsIn.length > 0 && <p>{impact.redirectsIn.length} old project URL{impact.redirectsIn.length === 1 ? "" : "s"} that redirect here are re-pointed to the developers overview.</p>}
                </div>
                <label className="block text-sm">
                  Type <span className="font-medium">{impact.title}</span> to confirm
                  <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus
                    className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#991B1B]" />
                </label>
              </>
            )}
            {msg?.error && <p className="text-xs text-[#991B1B]">{msg.error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={close} className="rounded-md border border-[#E5E7EB] text-sm px-4 py-2 hover:bg-[#F8F9FA]">Cancel</button>
              {impact && mode === "deactivate" && (
                <button type="button" onClick={runDeactivate} disabled={pending}
                  className="rounded-md bg-amber-800 text-white text-sm font-medium px-4 py-2 hover:bg-amber-900 disabled:opacity-60">
                  {pending ? "Deactivating…" : archive === "archive" ? `Deactivate + archive ${projectCount}` : "Deactivate"}
                </button>
              )}
              {impact && mode === "delete" && (
                <button type="button" onClick={runDelete}
                  disabled={pending || !deleteConfirmationMatches(typed, impact.title)}
                  className="rounded-md bg-[#991B1B] text-white text-sm font-medium px-4 py-2 hover:bg-[#7F1D1D] disabled:opacity-60">
                  {pending ? "Deleting…" : "Delete permanently"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
