import Link from "next/link";
import { prisma } from "@/lib/prisma";
import MediaUpload from "./media-upload";
import MediaCard from "./media-card";
import { CreateFolderForm, DeleteFolderButton } from "./media-folder-controls";

export const dynamic = "force-dynamic";
const PER_PAGE = 60;
const UNFILED = "__unfiled__";

export default async function MediaLibrary({ searchParams }: { searchParams: { q?: string; page?: string; folder?: string } }) {
  const q = (searchParams.q ?? "").trim();
  const folder = searchParams.folder ?? "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1") || 1);

  const search = q
    ? { OR: [{ originalFilename: { contains: q, mode: "insensitive" as const } }, { filename: { contains: q, mode: "insensitive" as const } }] }
    : {};
  const folderWhere = folder === UNFILED ? { folder: null } : folder ? { folder } : {};
  const where = { AND: [search, folderWhere] };

  const [total, media, grouped, folderRows] = await Promise.all([
    prisma.media.count({ where }),
    prisma.media.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    prisma.media.groupBy({ by: ["folder"], _count: { _all: true } }),
    prisma.mediaFolder.findMany({ orderBy: { name: "asc" } }),
  ]);
  const pages = Math.ceil(total / PER_PAGE);
  // Union of registered folders (may be empty) and folders inferred from media.
  const countByName = new Map<string, number>();
  for (const g of grouped) if (g.folder) countByName.set(g.folder, g._count._all);
  const names = new Set<string>([...folderRows.map((f) => f.name), ...Array.from(countByName.keys())]);
  const folders = Array.from(names).sort((a, b) => a.localeCompare(b)).map((name) => ({ name, count: countByName.get(name) ?? 0 }));
  const unfiledCount = grouped.find((g) => !g.folder)?._count._all ?? 0;
  const allCount = grouped.reduce((s, g) => s + g._count._all, 0);
  const qs = (f: string) => `/admin/media?folder=${encodeURIComponent(f)}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const tab = (active: boolean) => `block rounded-md px-3 py-1.5 text-sm ${active ? "bg-[#1B4B43] text-white" : "hover:bg-[#1B4B43]/8 text-[#111827]"}`;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Media library <span className="text-base font-normal text-[#6B7280]">({total})</span></h1>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <MediaUpload folder={folder && folder !== UNFILED ? folder : undefined} />
        <form className="max-w-xs">
          {folder && <input type="hidden" name="folder" value={folder} />}
          <input name="q" defaultValue={q} placeholder="Search filename…" className="rounded-md border border-[#E5E7EB] px-3 py-1.5 text-sm" />
        </form>
      </div>

      <div className="flex gap-6">
        <aside className="w-56 shrink-0">
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-2">
            <CreateFolderForm />
            <div className="space-y-0.5">
              <Link href={`/admin/media${q ? `?q=${encodeURIComponent(q)}` : ""}`} className={tab(!folder)}>All <span className="text-[#9CA3AF]">({allCount})</span></Link>
              <Link href={qs(UNFILED)} className={tab(folder === UNFILED)}>Unfiled <span className="text-[#9CA3AF]">({unfiledCount})</span></Link>
              <div className="border-t border-[#E5E7EB] my-1" />
              {folders.length === 0 ? (
                <p className="px-3 py-1.5 text-xs text-[#9CA3AF]">No folders yet — add one above.</p>
              ) : folders.map((f) => (
                <div key={f.name} className="flex items-center">
                  <Link href={qs(f.name)} className={`flex-1 ${tab(folder === f.name)}`}>{f.name} <span className="text-[#9CA3AF]">({f.count})</span></Link>
                  <DeleteFolderButton name={f.name} />
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {media.map((m) => <MediaCard key={m.id} m={m} />)}
          </div>
          {media.length === 0 && <p className="text-sm text-[#6B7280]">No media here.</p>}
          {pages > 1 && (
            <div className="flex items-center gap-3 mt-6 text-sm">
              {page > 1 && <Link href={`/admin/media?page=${page - 1}&folder=${encodeURIComponent(folder)}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="text-[#1B4B43] hover:underline">← Prev</Link>}
              <span className="text-[#6B7280]">Page {page} of {pages}</span>
              {page < pages && <Link href={`/admin/media?page=${page + 1}&folder=${encodeURIComponent(folder)}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="text-[#1B4B43] hover:underline">Next →</Link>}
            </div>
          )}
        </div>
      </div>

      {/* Folder suggestions for the per-item "move to folder" inputs */}
      <datalist id="media-folders">
        {folders.map((f) => <option key={f.name} value={f.name} />)}
      </datalist>
    </div>
  );
}
