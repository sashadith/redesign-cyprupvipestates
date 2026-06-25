import Link from "next/link";
import { createContent } from "../../../../actions";
import NewContentForm from "../../new-content-form";

export const dynamic = "force-dynamic";

export default function NewPage() {
  return (
    <div>
      <Link href="/admin/content/pages" className="text-sm text-[#1B4B43] hover:underline">← Back to pages</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">New page</h1>
      <NewContentForm action={createContent.bind(null, "singlepage")} kind="page" />
    </div>
  );
}
