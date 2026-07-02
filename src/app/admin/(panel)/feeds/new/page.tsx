import Link from "next/link";
import NewDeveloperForm from "./new-developer-form";

export const dynamic = "force-dynamic";

export default function NewDeveloperPage() {
  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/feeds" className="text-sm text-[#6B7280] hover:underline">← Developers</Link>
        <h1 className="text-xl font-semibold text-[#111827] mt-1">New developer</h1>
      </div>
      <NewDeveloperForm />
    </div>
  );
}
