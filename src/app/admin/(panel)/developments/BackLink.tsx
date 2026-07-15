"use client";

import { useRouter } from "next/navigation";

/* Back control that returns to the ACTUAL previous page (browser history) instead
   of a hard-coded target, with a sensible fallback for direct visits. */
export default function BackLink({ label = "← Back", fallback = "/admin/developments" }: { label?: string; fallback?: string }) {
  const router = useRouter();
  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(fallback);
  };
  return (
    <button type="button" onClick={back} className="text-sm text-[#6B7280] hover:text-[#1B4B43]">
      {label}
    </button>
  );
}
