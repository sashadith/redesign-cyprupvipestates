"use server";
import { revalidatePath } from "next/cache";
import { getCrmUser } from "@/lib/crm/session";
import { createTelegramLinkCode, unlinkTelegram } from "@/lib/crm/leadNagSend";
import { officeBotUsername } from "@/lib/crm/officeBot";

export type LinkResult = { ok: true; url: string } | { ok: false; error: string };

// Every CRM user links their own chat only (the session's user, never an id from the client).
export async function createTelegramLinkAction(): Promise<LinkResult> {
  const user = await getCrmUser();
  if (!user) return { ok: false, error: "Please log in again." };
  const username = await officeBotUsername();
  if (!username) return { ok: false, error: "The Telegram bot is not reachable right now. Try again in a minute." };
  const code = await createTelegramLinkCode(user.id, new Date());
  return { ok: true, url: `https://t.me/${username}?start=${code}` };
}

export async function disconnectTelegramAction(): Promise<void> {
  const user = await getCrmUser();
  if (!user) return;
  await unlinkTelegram({ userId: user.id });
  revalidatePath("/crm/settings/telegram");
}
