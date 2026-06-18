import Link from "next/link";
import { createBlogPost } from "../../../../actions";
import NewContentForm from "../../new-content-form";

export const dynamic = "force-dynamic";

export default function NewBlogPost() {
  return (
    <div>
      <Link href="/admin/content/blog" className="text-sm text-[#1B4B43] hover:underline">← Back to blog</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">New blog post</h1>
      <NewContentForm action={createBlogPost} kind="post" />
    </div>
  );
}
