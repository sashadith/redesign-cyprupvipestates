import Link from "next/link";

// Any unmatched URL under /admin. Without this, Next falls through to the
// root not-found — which lives under src/app/[lang]/ and is built for the
// public site — and the admin renders "Application error: a client-side
// exception has occurred" on a black screen instead. That is what a stale
// Action Center deep link produced on 2026-09-01: the item pointed at
// /admin/developments/developers, a segment that holds only [id], compare and
// new, so there was no page to render and no admin-shaped way to say so.
//
// The link itself is fixed (actionCenter/rules/developers.ts), but a wrong
// admin URL should never again look like the application broke.
export default function AdminNotFound() {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white px-6 py-10 text-center">
      <h1 className="text-lg font-semibold text-[#111827]">This admin page does not exist</h1>
      <p className="mt-2 text-sm text-[#6B7280]">
        The address is wrong, or whatever it pointed at has been renamed or deleted.
      </p>
      <div className="mt-5 flex items-center justify-center gap-3 text-sm">
        <Link href="/admin" className="rounded-md bg-[#1B4B43] px-4 py-2 font-medium text-white hover:bg-[#142E2D]">
          Dashboard
        </Link>
        <Link href="/admin/developments" className="rounded-md border border-[#E5E7EB] px-4 py-2 text-[#374151] hover:bg-[#F8F9FA]">
          Developments
        </Link>
      </div>
    </div>
  );
}
