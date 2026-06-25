// Exit Draft Preview — clears the Next.js Draft Mode cookie and returns to the page.
import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  draftMode().disable();
  const raw = new URL(req.url).searchParams.get("path") || "/";
  const path = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  redirect(path);
}
