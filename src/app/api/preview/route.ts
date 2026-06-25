// Draft Preview — enable Next.js Draft Mode so detail pages render UNPUBLISHED content.
// Admin-session gated (the link is generated inside the authed admin; same-origin cookie).
// Usage: /api/preview?path=/de/projects/my-draft  → sets the preview cookie, redirects there.
import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const raw = new URL(req.url).searchParams.get("path") || "/";
  // Only allow internal, relative paths (no protocol-relative // or absolute URLs).
  const path = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  draftMode().enable();
  redirect(path);
}
