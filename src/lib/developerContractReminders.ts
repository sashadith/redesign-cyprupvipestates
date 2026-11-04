// Contract-renewal reminders (2026-10-29), run once a day from the
// action-digest cron. For each developer's CURRENT contract (signed last) that
// does not renew itself: one Telegram message and one email 14 days before the
// end, and again 1 day before. Each is its own message rather than a digest
// line, so it is not lost among the day's other items; the Action Center rule
// (actionCenter/rules/contracts.ts) keeps the condition visible until the
// contract is renewed, and the digest leaves those items out so nothing is
// said twice.
//
// A stage is claimed (stamped) before sending and released again if neither
// Telegram nor email got through, so tomorrow's run tries again.
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendEmail } from "@/lib/sendEmail";
import {
  currentContract, dateToIso, daysBetween, dueReminder, firstTermEnd, fmtDay, nicosiaToday, whenText,
} from "@/lib/developerContract";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type ContractReminderResult = { due: number; sent: number; failed: string[] };

export async function sendDueContractReminders(now: Date = new Date()): Promise<ContractReminderResult> {
  const today = nicosiaToday(now);
  const accounts = await prisma.developerAccount.findMany({
    where: { contracts: { some: {} } },
    select: { id: true, name: true, contracts: true },
  });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://cyprusvipestates.com";
  const result: ContractReminderResult = { due: 0, sent: 0, failed: [] };

  for (const a of accounts) {
    const c = currentContract(a.contracts);
    if (!c) continue;
    const dates = { signedAt: dateToIso(c.signedAt), termMonths: c.termMonths, autoRenew: c.autoRenew };
    const stage = dueReminder({ ...dates, reminder14SentAt: c.reminder14SentAt, reminder1SentAt: c.reminder1SentAt }, today);
    if (!stage) continue;
    result.due++;
    const end = firstTermEnd(dates.signedAt, dates.termMonths);
    const when = whenText(daysBetween(today, end));
    const link = `${siteUrl}/admin/developments/developers/${a.id}`;
    const headline = `Contract with ${a.name} ${when} (${fmtDay(end)})`;
    const body = `It does not renew automatically — renew it, or upload the new contract on the developer page.`;

    // Claim the stage BEFORE sending, on the exact dates this run read: a second
    // run started at the same time finds the stamp taken, and an admin who
    // changes the dates meanwhile (which clears the stamps) is not overwritten.
    // The 1-day stage also closes the 14-day one, so a late entry never gets
    // "in 14 days" after "tomorrow". Released again if nothing went out.
    const field = stage === 1 ? "reminder1SentAt" : "reminder14SentAt";
    const stamp: Record<string, Date> = stage === 1
      ? { reminder1SentAt: now, ...(c.reminder14SentAt ? {} : { reminder14SentAt: now }) }
      : { reminder14SentAt: now };
    const unclaim: Record<string, null> = Object.fromEntries(Object.keys(stamp).map((k) => [k, null]));
    try {
      const claimed = await prisma.developerContract.updateMany({
        where: { id: c.id, [field]: null, signedAt: c.signedAt, termMonths: c.termMonths, autoRenew: c.autoRenew },
        data: stamp,
      });
      if (claimed.count !== 1) continue;
    } catch (e) {
      console.error("contract reminder: claim failed", a.name, e);
      result.failed.push(a.name);
      continue;
    }

    let delivered = false;
    try {
      const r = await sendTelegramMessage(`<b>📄 ${esc(headline)}</b>\n${esc(body)}\n<a href="${link}">Open ${esc(a.name)}</a>`);
      if (r) delivered = true;
    } catch (e) {
      console.error("contract reminder: telegram failed", a.name, e);
    }
    try {
      await sendEmail({
        subject: headline,
        text: [headline, "", body, "", `Signed ${fmtDay(dates.signedAt)}, ${dates.termMonths} months, file: ${c.fileName}`, "", link].join("\n"),
      });
      delivered = true;
    } catch (e) {
      console.error("contract reminder: email failed", a.name, e);
    }
    if (!delivered) {
      result.failed.push(a.name);
      await prisma.developerContract.updateMany({ where: { id: c.id, [field]: now }, data: unclaim })
        .catch((e) => console.error("contract reminder: unclaim failed", a.name, e));
      continue;
    }
    result.sent++;
  }
  return result;
}
