"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setStatus } from "./actions";

// Archiving hides a project from every default list/search (it's meant for things
// like sold-out projects) — a confirm step guards against an accidental click,
// since it's easy to lose track of a project once it's off the main list.
export default function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = () => {
    if (!archived && !confirm("Archive this project? It will disappear from the main Developments list and all searches — you can unarchive it later from the Archived filter.")) return;
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("status", archived ? "draft" : "archived");
      await setStatus(fd);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className={archived
        ? "rounded-md border border-[#E5E7EB] text-sm px-4 py-2 hover:bg-[#F8F9FA] disabled:opacity-60"
        : "rounded-md border border-[#FCA5A5] text-[#991B1B] text-sm px-4 py-2 hover:bg-[#FEF2F2] disabled:opacity-60"}
    >
      {pending ? "…" : archived ? "Unarchive" : "Archive"}
    </button>
  );
}
