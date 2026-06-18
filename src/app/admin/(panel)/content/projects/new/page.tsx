import Link from "next/link";
import { createProject } from "../../../../actions";
import NewContentForm from "../../new-content-form";

export const dynamic = "force-dynamic";

export default function NewProject() {
  return (
    <div>
      <Link href="/admin/content/projects" className="text-sm text-[#1B4B43] hover:underline">← Back to projects</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">New project</h1>
      <NewContentForm action={createProject} kind="project" />
    </div>
  );
}
