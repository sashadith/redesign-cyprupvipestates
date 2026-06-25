import Link from "next/link";
import { createContent } from "../../../../actions";
import NewContentForm from "../../new-content-form";

export const dynamic = "force-dynamic";

export default function NewCaseStudy() {
  return (
    <div>
      <Link href="/admin/content/case-studies" className="text-sm text-[#1B4B43] hover:underline">← Back to case studies</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">New case study</h1>
      <NewContentForm action={createContent.bind(null, "caseStudy")} kind="case study" />
    </div>
  );
}
