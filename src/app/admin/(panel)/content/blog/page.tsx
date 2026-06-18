import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const LOCALES = ["en", "de", "pl", "ru"];

export default async function BlogAdmin({ searchParams }: { searchParams: { lang?: string } }) {
  const lang = LOCALES.includes(searchParams.lang ?? "") ? searchParams.lang! : "en";
  const posts = await prisma.blog.findMany({
    where: { language: lang as any },
    orderBy: { publishedAt: "desc" },
    include: { category: true },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Blog</h1>
        <Link href="/admin/content/blog/new" className="rounded-md bg-[#1B4B43] text-white text-sm px-4 py-2 hover:bg-[#142E2D]">+ New post</Link>
      </div>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1">
          {LOCALES.map((l) => (
            <Link key={l} href={`/admin/content/blog?lang=${l}`}
              className={`rounded-md px-3 py-1.5 text-sm ${l === lang ? "bg-[#1B4B43] text-white" : "bg-white border border-[#E5E7EB]"}`}>
              {l.toUpperCase()}
            </Link>
          ))}
        </div>
        <span className="text-sm text-[#6B7280]">{posts.length} posts</span>
      </div>
      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Title</th>
              <th className="text-left font-medium px-4 py-2.5">Category</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
              <th className="text-left font-medium px-4 py-2.5">Published</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {posts.map((b) => (
              <tr key={b.id} className="hover:bg-[#F8F9FA]">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/content/blog/${b.id}`} className="text-[#1B4B43] font-medium hover:underline">{b.title}</Link>
                  <div className="text-xs text-[#6B7280]">/{b.slug}</div>
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">{b.category?.title ?? "—"}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{b.status}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{b.publishedAt ? new Date(b.publishedAt).toLocaleDateString("en-GB") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
