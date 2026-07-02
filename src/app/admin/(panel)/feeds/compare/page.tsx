import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CATALOG_BY_KEY, locationLabel } from "@/lib/devFeeds/catalog";
import { RecBadge } from "../badges";

export const dynamic = "force-dynamic";

type Field = {
  path: string;
  originalName: string;
  inferredType: string;
  exampleValues: string[];
  suggestedInternalField: string | null;
  include?: boolean;
};

export default async function ComparePage() {
  // Use each developer's LATEST analysis as their current field set.
  const developers = await prisma.developerAccount.findMany({
    orderBy: { name: "asc" },
    include: { analyses: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const withData = developers.filter((d) => d.analyses.length > 0);
  const totalDevs = withData.length;

  // unifiedKey → aggregation
  type Agg = {
    devs: Set<string>;
    originalNames: Set<string>;
    examples: string[];
  };
  const unified = new Map<string, Agg>();
  const unmapped: { dev: string; originalName: string; type: string; examples: string[] }[] = [];

  for (const d of withData) {
    const fields = (Array.isArray(d.analyses[0].fields) ? d.analyses[0].fields : []) as Field[];
    for (const f of fields) {
      if (f.include === false) continue;
      if (f.suggestedInternalField) {
        const agg = unified.get(f.suggestedInternalField) ?? { devs: new Set(), originalNames: new Set(), examples: [] };
        agg.devs.add(d.name);
        agg.originalNames.add(f.originalName);
        if (agg.examples.length < 3 && f.exampleValues?.[0]) agg.examples.push(f.exampleValues[0]);
        unified.set(f.suggestedInternalField, agg);
      } else {
        unmapped.push({ dev: d.name, originalName: f.originalName, type: f.inferredType, examples: f.exampleValues ?? [] });
      }
    }
  }

  const rows = Array.from(unified.entries())
    .map(([key, agg]) => {
      const entry = CATALOG_BY_KEY[key];
      const exists = !!entry && entry.location.kind !== "none";
      return {
        key,
        label: entry?.label ?? key,
        location: entry ? locationLabel(entry.location) : "—",
        rec: exists ? "existing" : "new",
        devCount: agg.devs.size,
        coverage: totalDevs ? Math.round((agg.devs.size / totalDevs) * 100) : 0,
        originalNames: Array.from(agg.originalNames),
        examples: agg.examples,
      };
    })
    .sort((a, b) => b.coverage - a.coverage || a.label.localeCompare(b.label));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/feeds" className="text-sm text-[#6B7280] hover:underline">← Developers</Link>
        <h1 className="text-xl font-semibold text-[#111827] mt-1">Field comparison across developers</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          Based on the latest analysis of each developer ({totalDevs} {totalDevs === 1 ? "developer" : "developers"} with data).
          Shows which unified fields the feeds provide and how they name them.
        </p>
      </div>

      {totalDevs === 0 ? (
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-8 text-center text-[#6B7280]">
          No analyzed developers yet. Analyze at least one feed to build the comparison.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8F9FA] text-[#6B7280]">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Unified field</th>
                  <th className="text-left font-medium px-4 py-2.5">In our model?</th>
                  <th className="text-left font-medium px-4 py-2.5">Coverage</th>
                  <th className="text-left font-medium px-4 py-2.5">Developer field names</th>
                  <th className="text-left font-medium px-4 py-2.5">Examples</th>
                  <th className="text-left font-medium px-4 py-2.5">Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {rows.map((r) => (
                  <tr key={r.key} className="hover:bg-[#F8F9FA]">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-[#111827]">{r.label}</div>
                      <code className="text-[11px] text-[#9CA3AF]">{r.key}</code>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {r.rec === "existing" ? <span className="text-[#1B4B43]">✓ {r.location}</span> : <span className="text-[#9CA3AF]">not stored</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[#111827]">{r.coverage}%</span>
                      <span className="text-[#9CA3AF] text-xs"> ({r.devCount}/{totalDevs})</span>
                    </td>
                    <td className="px-4 py-2.5 text-[#6B7280] text-xs">{r.originalNames.join(", ")}</td>
                    <td className="px-4 py-2.5 text-[#6B7280] text-xs max-w-[200px]"><div className="truncate">{r.examples.join(" · ")}</div></td>
                    <td className="px-4 py-2.5"><RecBadge rec={r.rec} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {unmapped.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[#111827] mb-2">Unmapped feed fields ({unmapped.length})</h2>
              <p className="text-xs text-[#6B7280] mb-2">Fields with no suggested internal mapping yet — review per developer to map or ignore.</p>
              <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F8F9FA] text-[#6B7280]">
                    <tr>
                      <th className="text-left font-medium px-4 py-2.5">Developer</th>
                      <th className="text-left font-medium px-4 py-2.5">Field</th>
                      <th className="text-left font-medium px-4 py-2.5">Type</th>
                      <th className="text-left font-medium px-4 py-2.5">Examples</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {unmapped.map((u, i) => (
                      <tr key={i} className="hover:bg-[#F8F9FA]">
                        <td className="px-4 py-2.5 text-[#6B7280]">{u.dev}</td>
                        <td className="px-4 py-2.5 text-[#111827]">{u.originalName}</td>
                        <td className="px-4 py-2.5 text-[#6B7280] text-xs">{u.type}</td>
                        <td className="px-4 py-2.5 text-[#6B7280] text-xs max-w-[240px]"><div className="truncate">{u.examples.join(" · ")}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
