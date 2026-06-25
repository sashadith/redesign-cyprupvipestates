import Link from "next/link";
import { createContent } from "../../../../actions";
import NewContentForm from "../../new-content-form";

export const dynamic = "force-dynamic";

export default function NewAuthor() {
  return (
    <div>
      <Link href="/admin/content/authors" className="text-sm text-[#1B4B43] hover:underline">← Back to authors</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">New author</h1>
      <NewContentForm action={createContent.bind(null, "author")} kind="author" titleLabel="Name" hasSlug={false} hasExcerpt={false} />
    </div>
  );
}
