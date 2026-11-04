"use server";
import { redirect } from "next/navigation";
import { revokeCurrentSession } from "@/lib/partner/session";

export async function logoutAction(): Promise<void> {
  await revokeCurrentSession();
  redirect("/login");
}
