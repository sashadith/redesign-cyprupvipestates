// The signed-in CRM user's reminder counts (overdue / due today) for the banner and the tab title,
// polled by the CRM shell every few minutes so a tab left open keeps nagging. Same rule as the reminders.
import { NextResponse } from "next/server";
import { getCrmUser } from "@/lib/crm/session";
import { nagCountsFor } from "@/lib/crm/leadNagSend";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCrmUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await nagCountsFor(user, new Date()), { headers: { "Cache-Control": "no-store" } });
}
