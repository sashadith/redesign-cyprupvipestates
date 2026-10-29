import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { backfillSentMail, syncLeadWhatsApp } from "@/lib/crm/commSync";
import { loadLeadPhoneMatcher } from "@/lib/openwa/matchLead";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const PAUSE_MS = 3000;

// One-off backfill after the @lid outage (2026-10-29): WhatsApp messages since ~early October never
// reached the timeline, and mail sent from the mailbox never did. History only — no Telegram, no
// cadence (crm/commSync.ts). Not a crontab entry. Run on the VPS against 127.0.0.1, in pages; the
// secret travels in a header, not the query (one-off route, no reason to put it in any log):
//   curl -s -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:3000/api/cron/comm-backfill?dryRun=1&offset=0&limit=10"
// dryRun=1 counts without writing. mail=1 (with offset=0) also files the Sent folder.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : "";
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  if (!expected || given.length !== Buffer.byteLength(expected) || !timingSafeEqual(given, Buffer.from(expected))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = p.get("dryRun") === "1";
  const offset = Math.max(0, Number(p.get("offset")) || 0);
  const limit = Math.min(100, Math.max(1, Number(p.get("limit")) || 10));
  const days = Math.min(120, Math.max(1, Number(p.get("days")) || 60));

  const leads = await prisma.lead.findMany({
    where: { deletedAt: null, phone: { not: null } },
    select: { id: true, phone: true },
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
  });

  const matcher = await loadLeadPhoneMatcher();
  let logged = 0, linked = 0;
  const failed: { leadId: string; error: string }[] = [];
  for (const l of leads) {
    // The gateway's rate limit is shared with live traffic (webhook lookups, sends, the cockpit's
    // Sync); a backfill running flat out locked the operator's Sync out with 429 on 2026-10-29.
    if (l !== leads[0]) await new Promise((r) => setTimeout(r, PAUSE_MS));
    const r = await syncLeadWhatsApp(l.phone, { dryRun, matcher });
    if (r.ok) { logged += r.logged; linked += r.linked; }
    else if (r.error !== "No usable phone number.") failed.push({ leadId: l.id, error: r.error });
  }

  let mail: { scanned: number; filed: number } | { error: string } | null = null;
  if (p.get("mail") === "1" && offset === 0 && !dryRun) {
    mail = await backfillSentMail(days).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  }

  return NextResponse.json({ ok: true, dryRun, offset, leads: leads.length, nextOffset: leads.length === limit ? offset + limit : null, whatsapp: { logged, linked, failed }, mail });
}
