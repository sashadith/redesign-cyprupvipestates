import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { aiConfigured } from "@/lib/ai/anthropic";
import { slugOfArea } from "./slug";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-[#DCFCE7] text-[#166534]",
  draft: "bg-[#FEF3C7] text-[#92400E]",
  none: "bg-[#F3F4F6] text-[#6B7280]",
};

export default async function AreasPage() {
  const [devs, descs] = await Promise.all([
    prisma.development.findMany({ select: { area: true, district: true, override: { select: { area: true, district: true } } } }),
    prisma.areaDescription.findMany(),
  ]);

  // effective area (override wins) → unique by slug, with project counts
  const map = new Map<string, { slug: string; name: string; district: string; count: number }>();
  for (const d of devs) {
    const name = d.override?.area || d.area;
    if (!name) continue;
    const district = d.override?.district || d.district || "";
    const slug = slugOfArea(name);
    const e = map.get(slug) ?? { slug, name, district, count: 0 };
    e.count++;
    map.set(slug, e);
  }
  const bySlug = new Map(descs.map((x) => [x.areaSlug, x]));
  const areas = Array.from(map.values()).sort((a, b) => b.count - a.count);
  const approved = areas.filter((a) => bySlug.get(a.slug)?.status === "approved").length;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/developments" className="text-sm text-[#6B7280] hover:text-[#1B4B43]">← Developments</Link>
        <h1 className="text-xl font-semibold text-[#111827] mt-1">Area descriptions</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          One neighbourhood description per area, reused across every project there — generated in 4 languages and checked against neighbouring areas for uniqueness. {approved}/{areas.length} approved.
        </p>
      </div>

      {!aiConfigured() && (
        <div className="rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
          AI generation is off — add <code className="font-mono">ANTHROPIC_API_KEY</code> to the server <code className="font-mono">.env</code> to enable “Generate”. You can still write descriptions manually.
        </div>
      )}

      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280] text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Area</th>
              <th className="px-4 py-3 font-medium">District</th>
              <th className="px-4 py-3 font-medium text-right">Projects</th>
              <th className="px-4 py-3 font-medium">Languages</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {areas.map((a) => {
              const d = bySlug.get(a.slug);
              const langs = d ? [d.textEN, d.textDE, d.textPL, d.textRU].filter(Boolean).length : 0;
              const status = d?.status ?? "none";
              const href = `/admin/developments/areas/${a.slug}?name=${encodeURIComponent(a.name)}&district=${encodeURIComponent(a.district)}`;
              return (
                <tr key={a.slug} className="hover:bg-[#F8F9FA]">
                  <td className="px-4 py-3">
                    <Link href={href} className="font-medium text-[#111827] hover:text-[#1B4B43] hover:underline">{a.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-[#6B7280]">{a.district || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{a.count}</td>
                  <td className="px-4 py-3 text-[#6B7280] tabular-nums">{langs}/4</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[status]}`}>{status === "none" ? "not created" : status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
