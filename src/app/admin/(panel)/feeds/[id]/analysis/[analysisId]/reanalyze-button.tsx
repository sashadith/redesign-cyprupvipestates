"use client";
import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { reanalyzeFeed } from "@/app/admin/actions";

function Btn() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-md border border-[#E5E7EB] text-sm px-4 py-2 hover:bg-[#F8F9FA] disabled:opacity-60"
      title="Re-run analysis on the stored feed with the current parser"
    >
      {pending ? "Re-analyzing…" : "↻ Re-analyze feed"}
    </button>
  );
}

// Re-runs analysis on the stored feed. On success refreshes the route so the
// (remounted) mapping table shows the updated fields.
export default function ReanalyzeButton({ analysisId }: { analysisId: string }) {
  const [state, action] = useFormState<{ ok?: boolean; error?: string } | null>(
    reanalyzeFeed.bind(null, analysisId) as any,
    null,
  );
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="flex items-center gap-3">
      <Btn />
      {state?.ok && <span className="text-sm text-[#1B4B43]">Re-analyzed ✓</span>}
      {state?.error && <span className="text-sm text-[#C0392B]">{state.error}</span>}
    </form>
  );
}
