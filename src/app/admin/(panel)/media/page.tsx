import Link from "next/link";
import { prisma } from "@/lib/prisma";
import MediaUpload from "./media-upload";

export const dynamic = "force-dynamic";
const PER_PAGE = 60;

export default async function MediaLibrary({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.page ?? "1") || 1);
  const where = q
    ? { OR: [{ originalFilename: { contains: q, mode: "insensitive" as const } }, { filename: { contains: q, mode: "insensitive" as const } }] }
    : {};
  const [total, media] = await Promise.all([
    prisma.media.count({ where }),
    prisma.media.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
  ]);
  const pages = Math.ceil(total / PER_PAGE);
  const kb = (n: number | null) => (n ? `${Math.round(n / 1024)} KB` : "—");

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Media library <span className="text-base font-normal text-[#6B7280]">({total})</span></h1>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <MediaUpload />
        <form className="max-w-xs">
          <input name="q" defaultValue={q} placeholder="Search filename…" className="rounded-md border border-[#E5E7EB] px-3 py-1.5 text-sm" />
        </form>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {media.map((m) => (
          <div key={m.id} className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
            <div className="aspect-square bg-[#F8F9FA] flex items-center justify-center overflow-hidden">
              {m.mimeType?.startsWith("image/")
                ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt={m.altText ?? m.originalFilename ?? ""} loading="lazy" className="w-full h-full object-cover" />
                : <span className="text-xs text-[#6B7280] p-2 break-all">{m.mimeType}</span>}
            </div>
            <div className="p-2">
              <div className="text-[11px] text-[#111827] truncate" title={m.originalFilename ?? m.filename}>{m.originalFilename ?? m.filename}</div>
              <div className="text-[11px] text-[#9CA3AF]">{m.width && m.height ? `${m.width}×${m.height} · ` : ""}{kb(m.fileSize)}</div>
            </div>
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-3 mt-6 text-sm">
          {page > 1 && <Link href={`/admin/media?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="text-[#1B4B43] hover:underline">← Prev</Link>}
          <span className="text-[#6B7280]">Page {page} of {pages}</span>
          {page < pages && <Link href={`/admin/media?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="text-[#1B4B43] hover:underline">Next →</Link>}
        </div>
      )}
    </div>
  );
}
