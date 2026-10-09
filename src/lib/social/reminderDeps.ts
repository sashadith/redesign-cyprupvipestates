// Real dependencies for runSocialReminders (socialReminders.ts): a FRESH
// Typefully read (never the 2-minute memo — a draft confirmed a minute ago must
// not get a T-30), the social_reminders_sent ledger, and the owner's Telegram
// chat as plain text.
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { typefully } from "./typefully";
import { sentKey, type ClaimRow, type ReminderDeps } from "./socialReminders";

export function realReminderDeps(): ReminderDeps {
  return {
    listPlanned: () => typefully.listDrafts("planned", { fresh: true }),
    async sentKeys(draftIds) {
      const rows = await prisma.socialReminderSent.findMany({ where: { draftId: { in: draftIds } }, select: { draftId: true, kind: true } });
      return new Set(rows.map((r) => sentKey(r.draftId, r.kind)));
    },
    async claim(rows) {
      // One row at a time with ON CONFLICT DO NOTHING (skipDuplicates): count 1
      // = this call inserted it, 0 = already sent or claimed by an overlapping
      // run. No exception, so an expected duplicate never reaches the error log.
      const claimed: ClaimRow[] = [];
      for (const row of rows) {
        const { count } = await prisma.socialReminderSent.createMany({ data: [{ draftId: row.draftId, kind: row.kind }], skipDuplicates: true });
        if (count === 1) claimed.push(row);
      }
      return claimed;
    },
    async release(rows) {
      if (!rows.length) return;
      await prisma.socialReminderSent.deleteMany({ where: { OR: rows.map((r) => ({ draftId: r.draftId, kind: r.kind })) } });
    },
    async send(text) {
      try {
        const r = await sendTelegramMessage(text, { plain: true });
        return r === null ? "skipped" : "sent";
      } catch (e) {
        console.error("social-reminders: Telegram send failed:", e instanceof Error ? e.message : e);
        return "failed";
      }
    },
    now: () => new Date(),
  };
}
