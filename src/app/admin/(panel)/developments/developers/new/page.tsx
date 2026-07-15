import Link from "next/link";
import NewDeveloperForm from "./new-developer-form";

export const dynamic = "force-dynamic";

export default function NewDeveloperPage({ searchParams }: { searchParams?: { feed?: string } }) {
  const withFeed = searchParams?.feed === "1";
  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/developments" className="text-sm text-[#6B7280] hover:underline">← Developments</Link>
        <h1 className="text-xl font-semibold text-[#111827] mt-1">New developer{withFeed ? " (with feed)" : ""}</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          {withFeed
            ? "Create the developer, then add its feed (XML/URL) on the next screen — it moves to “Developers with feed” automatically."
            : "Create a manual developer. Then add its developments and scan developer PDFs with Claude to auto-fill descriptions and units."}
        </p>
      </div>
      <NewDeveloperForm />
    </div>
  );
}
