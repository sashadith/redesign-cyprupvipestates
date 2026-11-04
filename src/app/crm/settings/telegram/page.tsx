import { redirect } from "next/navigation";
import { getCrmUser } from "@/lib/crm/session";
import { prisma } from "@/lib/prisma";
import { NAG_HOURS } from "@/lib/crm/leadNag";
import { ConnectTelegram } from "./ConnectTelegram";
import { disconnectTelegramAction } from "./actions";

export const dynamic = "force-dynamic";

const hours = NAG_HOURS.map((h) => `${String(h).padStart(2, "0")}:00`).join(", ");

// Every CRM user: link their own Telegram so the lead reminders for their leads come to them.
export default async function TelegramSettingsPage() {
  const user = await getCrmUser();
  if (!user) redirect("/admin/login?callbackUrl=/crm/settings/telegram");
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { telegramChatId: true, telegramLinkedAt: true } });
  const linkedAt = me?.telegramChatId && me.telegramLinkedAt
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Nicosia" }).format(me.telegramLinkedAt)
    : null;
  return (
    <>
      <div className="crm-headrow">
        <div>
          <h1>Telegram reminders</h1>
          <p>
            At {hours} (Cyprus time) the office bot sends you every lead of yours that is overdue or due today — the same red and
            yellow marks as on the pipeline. A lead leaves the list only when you log a call, e-mail or WhatsApp, or set a new
            follow-up date (the buttons “tomorrow” and “+3 days” in the message do that for you).
          </p>
        </div>
      </div>
      <section className="crm-panel">
        {linkedAt ? (
          <>
            <p>Connected since {linkedAt}.</p>
            <form action={disconnectTelegramAction}><button type="submit" className="crm-btn">Disconnect</button></form>
          </>
        ) : (
          <>
            <p>
              Not connected.{" "}
              {user.isOwner
                ? "Until you connect, your reminders go to the office chat."
                : "Until you connect, your reminders go to the owner."}
            </p>
            <ConnectTelegram />
          </>
        )}
      </section>
    </>
  );
}
