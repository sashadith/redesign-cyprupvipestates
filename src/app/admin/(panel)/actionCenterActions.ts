"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { snoozeItem } from "@/lib/actionCenter";

export async function snoozeActionItemAction(itemId: string, days: number) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  await snoozeItem(itemId, days, userId);
  revalidatePath("/admin");
}
