"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleBridgeDeveloper } from "./actions";

// Why a client component rather than a plain <form action={...}> submit: every
// click here publishes or unpublishes a developer's whole catalogue on a second
// public domain. A one-click submit gives a mis-click no second chance, and the
// nearest thing on this site that needs one — archiving a project — already uses
// confirm() (ArchiveButton, SyncControlPanel, TrashRowActions). This is a larger
// consequence than archiving, so it gets the same guard rather than less.
//
// The confirm text names the developer and the project count in both directions,
// because "are you sure?" tells an admin nothing they did not already doubt.
export default function BridgeSwitch({
  slug,
  name,
  enabled,
  publishedProjects,
  lockedOff,
  mayToggle,
}: {
  slug: string;
  name: string;
  enabled: boolean;
  publishedProjects: number;
  lockedOff: boolean;
  /** ADMIN only. The server action enforces this independently; this just
      stops a non-admin from clicking into an error they cannot act on. */
  mayToggle: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = () => {
    const question = enabled
      ? `Stop delivering ${name} to Xellex?\n\nIts ${publishedProjects} published project(s) will be reported as removed at Xellex's next sync and should come off that site. This does not change anything on cyprusvipestates.com.`
      : `Deliver ${name} to Xellex?\n\nIts ${publishedProjects} published project(s) — names, all five language descriptions, prices, units and photos — become available to Xellex, a second public website, at its next sync.`;
    if (!confirm(question)) return;
    start(async () => {
      await toggleBridgeDeveloper(slug, !enabled);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={!mayToggle || lockedOff || pending}
      aria-pressed={enabled}
      title={
        !mayToggle
          ? "Only administrators can change what is delivered to Xellex."
          : lockedOff
          ? "This developer has no published projects — turning it on would deliver nothing."
          : enabled
            ? `Stop delivering ${name} — its ${publishedProjects} projects come off Xellex at the next sync`
            : `Deliver ${name} — its ${publishedProjects} published projects go live on Xellex`
      }
      className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-medium transition-colors ${
        enabled
          ? "border-[#166534] bg-[#166534] text-white hover:bg-[#14532D]"
          : "border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F8F9FA]"
      } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white`}
    >
      <span
        aria-hidden="true"
        className={`block h-4 w-7 shrink-0 rounded-full p-0.5 ${enabled ? "bg-white/30" : "bg-[#E5E7EB]"}`}
      >
        <span
          className={`block h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-3.5" : ""}`}
        />
      </span>
      {pending ? "…" : enabled ? "Live on Xellex" : "Not delivered"}
    </button>
  );
}
