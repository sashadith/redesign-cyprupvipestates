import Link from "next/link";
import { createContent } from "../../../../actions";
import NewContentForm from "../../new-content-form";

export const dynamic = "force-dynamic";

export default function NewDeveloper() {
  return (
    <div>
      <Link href="/admin/content/developers" className="text-sm text-[#1B4B43] hover:underline">← Back to developers</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">New developer</h1>
      <NewContentForm action={createContent.bind(null, "developer")} kind="developer" />
    </div>
  );
}
