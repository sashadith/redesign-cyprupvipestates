import Link from "next/link";
import { createContent } from "../../../../actions";
import NewContentForm from "../../new-content-form";

export const dynamic = "force-dynamic";

export default function NewCategory() {
  return (
    <div>
      <Link href="/admin/content/categories" className="text-sm text-[#1B4B43] hover:underline">← Back to categories</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">New category</h1>
      <NewContentForm action={createContent.bind(null, "category")} kind="category" hasExcerpt={false} />
    </div>
  );
}
