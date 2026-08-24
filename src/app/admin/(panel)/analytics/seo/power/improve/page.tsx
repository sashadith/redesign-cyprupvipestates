import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPageVerdicts } from "@/lib/seo/pagePower/pageVerdicts";
import { pagesInSuppressionWindow } from "@/lib/seo/titleSweepLog";
import { REMEASURE_WINDOW_DAYS } from "@/lib/seo/titleSweepRemeasure";
import type { PageDiagnosis } from "@/lib/seo/pagePower/types";
import type { InventoryPage } from "@/lib/seo/pagePower/inventory";
import { resolveTarget, readTargetSeo, isSeoTable, type SeoTable } from "@/lib/ai/pageImprover/target";
import { APPLY_ENABLED, type CurrentSeo, type ImprovementProposal } from "@/lib/ai/pageImprover/types";
import ImprovePanel, { type PanelDraft, type PanelHistoryRow } from "./ImprovePanel";

export const dynamic = "force-dynamic";

const SITE_URL = "https://cyprusvipestates.com";

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-lg border border-[#E5E7EB] p-5 ${className}`}>{children}</div>
);

const day = (d: Date): string => d.toISOString().slice(0, 10);

/** Same palette as the Page Power table's tabs, and exhaustive over
 *  `PageDiagnosis` for the same reason its `DIAGNOSIS_LABEL` is: a sixth
 *  diagnosis added to pagePower/types.ts must fail the build here rather than
 *  render this page's headline badge as unstyled text. */
const DIAGNOSIS_BADGE: Record<PageDiagnosis, { label: string; className: string }> = {
  buried: { label: "Buried", className: "bg-[#FDF2F1] text-[#8C1D18]" },
  unclicked: { label: "Unclicked", className: "bg-[#FEF6EA] text-[#8A5A0B]" },
  invisible: { label: "Invisible", className: "bg-[#F6F7F8] text-[#4B5563]" },
  healthy: { label: "Healthy", className: "bg-[#F0F7F3] text-[#1B5E3A]" },
  unjudged: { label: "Not enough data", className: "bg-[#F6F7F8] text-[#4B5563]" },
};

/** Where Apply's target row is edited by hand. Every folder was checked to
 *  exist on 2026-08-24 (`content/{blog,pages,developers,case-studies,projects}/[id]/page.tsx`);
 *  note that two of the five do NOT follow their table name — Singlepage is
 *  edited under `pages` and CaseStudy under `case-studies`. Keyed by `SeoTable`
 *  so a sixth writable table cannot be added in target.ts without a link for
 *  it. Development is absent on purpose: it is not a `SeoTable`, it has its own
 *  editor, and this screen refuses it outright (below). */
const EDITOR_BASE: Record<SeoTable, string> = {
  Blog: "/admin/content/blog",
  Singlepage: "/admin/content/pages",
  Developer: "/admin/content/developers",
  CaseStudy: "/admin/content/case-studies",
  Project: "/admin/content/projects",
};

type ImprovementRow = {
  id: string;
  status: string;
  diagnosis: string;
  reason: string;
  model: string;
  proposal: unknown;
  createdAt: Date;
  appliedAt: Date | null;
  appliedBy: string | null;
};

/** The draft/history rows, or the news that the table is not there yet.
 *
 *  P2021 is tolerated exactly the way `pagesInSuppressionWindow` tolerates it,
 *  and for the same reason: `page_improvements` reaches a database only through
 *  the deploy path, so between the migration being written and that deploy this
 *  query has no table ANYWHERE — including local dev, which runs against the
 *  production tunnel. Every other error rethrows; a blanket catch here would
 *  render "no drafts yet" over a broken database, which looks exactly like the
 *  normal empty state. */
async function loadImprovements(pageKey: string): Promise<{ rows: ImprovementRow[]; tableMissing: boolean }> {
  try {
    const rows = await prisma.pageImprovement.findMany({ where: { pageKey }, orderBy: { createdAt: "desc" } });
    return { rows, tableMissing: false };
  } catch (e) {
    if ((e as { code?: string })?.code !== "P2021") throw e;
    return { rows: [], tableMissing: true };
  }
}

/** Names for the `appliedBy` user ids, so history reads "Applied by Sascha"
 *  rather than a uuid. One query for the whole page; missing users degrade to
 *  the raw id instead of vanishing — an applied change with an unknown author
 *  is still an applied change, and hiding the author would misreport it as
 *  nobody's. */
async function applierLabels(ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true, email: true } });
  return new Map(users.map((u) => [u.id, u.name || u.email || u.id]));
}

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div>
    <div className="flex items-baseline justify-between gap-4 mb-6">
      <h1 className="text-2xl font-semibold">Improve page</h1>
      <Link href="/admin/analytics/seo/power" className="text-sm text-[#1B4B43] hover:underline shrink-0">← Back to Page Power</Link>
    </div>
    {children}
  </div>
);

export default async function ImprovePage({ searchParams }: { searchParams?: { key?: string } }) {
  // The pageKey is `locale::path` and a path contains slashes, so it travels as
  // a query param rather than a route segment. Next has already decoded it.
  const pageKey = searchParams?.key ?? "";
  if (!pageKey)
    return (
      <Shell>
        <Card><p className="text-sm text-[#6B7280]">No page selected. Open this screen from the Improve link on a Page Power row.</p></Card>
      </Shell>
    );

  const [page, verdicts, suppressedPaths] = await Promise.all([
    resolveTarget(pageKey),
    getPageVerdicts().then((v) => v.verdicts),
    pagesInSuppressionWindow(REMEASURE_WINDOW_DAYS),
  ]);

  if (!page)
    return (
      <Shell>
        <Card>
          <p className="text-sm text-[#6B7280]">
            No page in the inventory has the key <code className="text-[#111827]">{pageKey}</code>. It may have been unpublished, or the
            link may be from an older inventory.
          </p>
        </Card>
      </Shell>
    );

  const verdict = verdicts.find((v) => v.key === pageKey) ?? null;
  const suppressed = suppressedPaths.has(page.path);
  const source = page.source;
  const seoTable = source && isSeoTable(source.table) ? source.table : null;

  const [currentSeo, improvements] = await Promise.all([
    seoTable && source ? readTargetSeo(seoTable, source.id) : Promise.resolve<CurrentSeo | null>(null),
    loadImprovements(pageKey),
  ]);
  const appliers = await applierLabels(improvements.rows.map((r) => r.appliedBy).filter((id): id is string => !!id));

  const draftRow = improvements.rows.find((r) => r.status === "draft") ?? null;
  const draft: PanelDraft | null = draftRow
    ? {
        id: draftRow.id,
        createdAtLabel: day(draftRow.createdAt),
        diagnosis: draftRow.diagnosis,
        reason: draftRow.reason,
        model: draftRow.model,
        proposal: draftRow.proposal as ImprovementProposal,
      }
    : null;
  // Dates are formatted HERE, not in the client component: `toLocaleDateString`
  // in the browser renders against the visitor's locale and would not match
  // what the server rendered, and the rest of this screen already prints plain
  // ISO days (the Page Power header does the same).
  const history: PanelHistoryRow[] = improvements.rows
    .filter((r) => r.status !== "draft")
    .map((r) => ({
      id: r.id,
      status: r.status,
      createdAtLabel: day(r.createdAt),
      appliedAtLabel: r.appliedAt ? day(r.appliedAt) : null,
      appliedByLabel: r.appliedBy ? appliers.get(r.appliedBy) ?? r.appliedBy : null,
      metaTitle: (r.proposal as ImprovementProposal | null)?.metaTitle ?? "",
    }));

  const badge = verdict ? DIAGNOSIS_BADGE[verdict.diagnosis] : null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded shrink-0">{String(page.locale)}</span>
            <h1 className="text-2xl font-semibold break-words">
              <a href={`${SITE_URL}${page.path}`} target="_blank" rel="noreferrer" className="hover:text-[#1B4B43] hover:underline">{page.path}</a>
            </h1>
            {badge && <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${badge.className}`}>{badge.label}</span>}
          </div>
          <p className="text-sm text-[#6B7280] mt-1 max-w-prose">{verdict ? verdict.reason : "This page has no verdict in the current window."}</p>
          {verdict && (
            <p className="text-xs text-[#6B7280] mt-1 tabular-nums">
              {verdict.impressions.toLocaleString("en-GB")} impressions · CTR {verdict.ctr.toFixed(2)}% ·{" "}
              {/* Null exactly when the page drew no impressions — printing 0
                  there would read as "ranked first" (same call the table makes). */}
              {verdict.position == null ? "no position" : `position ${verdict.position.toFixed(1)}`} · {page.title}
            </p>
          )}
        </div>
        <Link href="/admin/analytics/seo/power" className="text-sm text-[#1B4B43] hover:underline shrink-0">← Back to Page Power</Link>
      </div>

      {improvements.tableMissing && (
        <Card className="mb-6 border-[#F3D9A5] bg-[#FEF9EF]">
          <h2 className="text-sm font-semibold text-[#8A5A0B]">Awaiting first deploy</h2>
          <p className="text-sm text-[#8A5A0B] mt-1 max-w-prose">
            The <code>page_improvements</code> table does not exist yet — the migration reaches a database only through the deploy path.
            Drafts cannot be stored or listed until then, so Generate is disabled and the history below is empty rather than absent.
          </p>
        </Card>
      )}

      {page.kind === "development" ? (
        <DevelopmentCard page={page} />
      ) : suppressed ? (
        <Card>
          <h2 className="text-sm font-semibold">In a re-measurement window</h2>
          <p className="text-sm text-[#6B7280] mt-1 max-w-prose">
            This page&apos;s title and description were changed inside the last {REMEASURE_WINDOW_DAYS} days — by the July title sweep or by
            an earlier Improve — and the window has not closed. Changing them again now destroys the measurement that would say whether the
            first change worked. Generation refuses this page for the same reason; come back when the window has passed.
          </p>
        </Card>
      ) : (
        <ImprovePanel
          pageKey={pageKey}
          currentSeo={currentSeo}
          draft={draft}
          history={history}
          applyEnabled={APPLY_ENABLED}
          // `fixed` pages are the hand-authored routes: the inventory carries no
          // `source` row for them, so there is nothing for Apply to write to.
          // The wording deliberately does NOT say "edit the code" flatly, which
          // would be wrong for most of them: checked 2026-08-24, only the
          // developers listing hardcodes its own copy, while the homepage and
          // the blog / projects / case-studies listings read their meta from
          // SiteDocument rows that the Homepage and Landing Pages editors own.
          // Apply stays out of all of them either way — a second writer for
          // fields another editor owns is how two generators drift apart.
          noApplyPath={
            seoTable
              ? null
              : "This page has no CMS row Apply can write to. Copy the proposed meta into whichever editor owns this page — the Landing Pages or Homepage editor for the listings, the route's own generateMetadata for the rest."
          }
          editorHref={seoTable && source ? `${EDITOR_BASE[seoTable]}/${source.id}` : null}
          generateDisabledReason={improvements.tableMissing ? "The page_improvements table is not deployed yet — a draft could not be stored." : null}
        />
      )}
    </div>
  );
}

/** Developments never reach the panel.
 *
 *  The server refuses them too (generateImprovementAction), and that check stays
 *  the real gate — but it fires only AFTER gather.ts has loaded the inventory,
 *  both verdict sets and the query pool and made a live HTTP GET of the page.
 *  Several seconds and an outbound request to say no. Offering the button at
 *  all would be the bug; this card is what belongs here instead. */
function DevelopmentCard({ page }: { page: InventoryPage }) {
  return (
    <Card>
      <h2 className="text-sm font-semibold">Developments have their own generator</h2>
      <p className="text-sm text-[#6B7280] mt-1 max-w-prose">
        A Development&apos;s title and description come from the development generator and its per-development overrides, in all four
        locales at once. The Page Improver deliberately does not write there — two generators for the same fields drift apart.
      </p>
      {page.source ? (
        <Link href={`/admin/developments/${page.source.id}`} className="inline-block text-sm text-[#1B4B43] hover:underline mt-3">
          Open {page.title} in the development editor →
        </Link>
      ) : (
        <p className="text-sm text-[#6B7280] mt-3">This development has no row in the inventory to link to.</p>
      )}
    </Card>
  );
}
