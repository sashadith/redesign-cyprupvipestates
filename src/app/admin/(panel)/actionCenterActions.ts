"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { snoozeItem, dismissForeverItem } from "@/lib/actionCenter";

export async function snoozeActionItemAction(itemId: string, days: number) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  await snoozeItem(itemId, days, userId);
  revalidatePath("/admin");
}

// Only turns off this item's reminder — never touches the underlying
// Development/Lead/etc. (publishStatus, archival, etc. are untouched).
export async function dismissForeverActionItemAction(itemId: string) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  await dismissForeverItem(itemId, userId);
  revalidatePath("/admin");
}
