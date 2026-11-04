import type { Prisma } from "@prisma/client";

// New Meta leads get an owner straight away (2026-11-04), so the SLA nag never reports them as
// "unassigned" while one person works every lead. META_LEAD_DEFAULT_OWNER picks who:
//   unset / "owner" — the account owner (User.isOwner), if exactly one is active;
//   "off"            — leave new Meta leads unassigned, as before;
//   anything else    — an active employee by user id or full name.
// An owner that cannot be resolved leaves the lead unassigned; it never blocks the import.

export type OwnerSetting = { mode: "off" } | { mode: "owner" } | { mode: "named"; value: string };

export function metaOwnerSetting(raw: string | undefined): OwnerSetting {
  const v = (raw ?? "").trim();
  if (!v || v.toLowerCase() === "owner") return { mode: "owner" };
  if (v.toLowerCase() === "off") return { mode: "off" };
  return { mode: "named", value: v };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function metaDefaultOwner(tx: Prisma.TransactionClient, setting = metaOwnerSetting(process.env.META_LEAD_DEFAULT_OWNER)): Promise<{ id: string; name: string } | null> {
  if (setting.mode === "off") return null;
  const where: Prisma.UserWhereInput =
    setting.mode === "owner" ? { isOwner: true }
    : UUID.test(setting.value) ? { id: setting.value }
    : { name: { equals: setting.value, mode: "insensitive" } };
  const rows = await tx.user.findMany({ where: { ...where, isActive: true }, select: { id: true, name: true }, take: 2 });
  return rows.length === 1 ? rows[0] : null;
}
