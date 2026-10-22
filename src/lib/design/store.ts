// Design settings store: pure resolution/validation (unit-tested) + thin Prisma functions.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/crm/audit";
import {
  CLASSIC, WEBSITE, DEFAULT_GLOBAL, normalizeSetValues, normalizeGlobal, emailTheme, CLASSIC_EMAIL_THEME,
  type SetValues, type GlobalSettings, type EmailTheme,
} from "./theme";

export type Side = "staff" | "partner";
export type ThemeRow = {
  id: string; key: string | null; name: string; values: SetValues;
  offeredToStaff: boolean; offeredToPartners: boolean; isDefault: boolean; sort: number;
};
export type SetMutation =
  | { kind: "delete"; id: string }
  | { kind: "update"; id: string; offeredToStaff: boolean; offeredToPartners: boolean }
  | { kind: "makeDefault"; id: string };

type Actor = { id: string; name: string; email: string };
type Db = Prisma.TransactionClient | typeof prisma;

// ---- pure ----

export function offeredOn(row: ThemeRow, side: Side): boolean {
  return side === "staff" ? row.offeredToStaff : row.offeredToPartners;
}

function syntheticClassic(): ThemeRow {
  return { id: "ds-classic", key: "classic", name: "Classic", values: { ...CLASSIC }, offeredToStaff: true, offeredToPartners: true, isDefault: true, sort: 1 };
}

export function resolveViewerSet(choiceId: string | null, rows: ThemeRow[], side: Side): ThemeRow {
  if (choiceId) {
    const hit = rows.find((r) => r.id === choiceId);
    if (hit && offeredOn(hit, side)) return hit;
  }
  return rows.find((r) => r.isDefault) ?? syntheticClassic();
}

export function canChooseSet(id: string, rows: ThemeRow[], side: Side): boolean {
  const hit = rows.find((r) => r.id === id);
  return !!hit && offeredOn(hit, side);
}

export function validateSetMutation(m: SetMutation, rows: ThemeRow[]): string | null {
  const row = rows.find((r) => r.id === m.id);
  if (!row) return "Unknown set";
  if (m.kind === "delete") {
    if (row.key !== null) return "Built-in sets cannot be deleted";
    if (row.isDefault) return "Make another set the default first";
  } else if (m.kind === "update") {
    if (row.isDefault && !(m.offeredToStaff && m.offeredToPartners)) return "The default set must be offered to staff and partners";
  } else if (m.kind === "makeDefault") {
    if (!(row.offeredToStaff && row.offeredToPartners)) return "The default set must be offered to staff and partners";
  }
  return null;
}

// ---- DB ----

function toRow(r: { id: string; key: string | null; name: string; values: unknown; offeredToStaff: boolean; offeredToPartners: boolean; isDefault: boolean; sort: number }): ThemeRow {
  return { id: r.id, key: r.key, name: r.name, values: normalizeSetValues(r.values), offeredToStaff: r.offeredToStaff, offeredToPartners: r.offeredToPartners, isDefault: r.isDefault, sort: r.sort };
}

async function inTx<T>(db: Db, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return "$transaction" in db ? db.$transaction(fn) : fn(db);
}

export async function listThemes(db: Db = prisma): Promise<ThemeRow[]> {
  const rows = await db.designTheme.findMany({ orderBy: [{ sort: "asc" }, { name: "asc" }] });
  return rows.map(toRow);
}

export async function loadGlobal(db: Db = prisma): Promise<GlobalSettings> {
  const r = await db.designSettingsVersion.findFirst({ orderBy: { createdAt: "desc" } });
  return r ? normalizeGlobal(r.values) : { ...DEFAULT_GLOBAL };
}

async function viewer(side: Side, choiceId: string | null, db: Db) {
  const [rows, global] = await Promise.all([listThemes(db), loadGlobal(db)]);
  return { set: resolveViewerSet(choiceId, rows, side), global, offered: rows.filter((r) => offeredOn(r, side)) };
}

export async function designForStaff(userId: string, db: Db = prisma) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { designThemeId: true } });
  return viewer("staff", u?.designThemeId ?? null, db);
}

export async function designForPartner(partnerId: string | null, db: Db = prisma) {
  const p = partnerId ? await db.partner.findUnique({ where: { id: partnerId }, select: { designThemeId: true } }) : null;
  return viewer("partner", p?.designThemeId ?? null, db);
}

export async function emailThemeForPartner(partnerId: string | null, db: Db = prisma): Promise<EmailTheme> {
  try {
    const d = await designForPartner(partnerId, db);
    return emailTheme(d.set.values, d.global);
  } catch (err) {
    console.error("[design email theme]", err);
    return CLASSIC_EMAIL_THEME;
  }
}

export async function saveTheme(
  actor: Actor,
  input: { id?: string; name: string; values: SetValues; offeredToStaff: boolean; offeredToPartners: boolean },
  db: Db = prisma,
): Promise<string> {
  return inTx(db, async (tx) => {
    const rows = await listThemes(tx);
    const before = input.id ? rows.find((r) => r.id === input.id) : undefined;
    if (input.id && !before) throw new Error("Unknown set");
    if (before) {
      const err = validateSetMutation({ kind: "update", id: before.id, offeredToStaff: input.offeredToStaff, offeredToPartners: input.offeredToPartners }, rows);
      if (err) throw new Error(err);
    }
    const data = { name: input.name, values: input.values as Prisma.InputJsonValue, offeredToStaff: input.offeredToStaff, offeredToPartners: input.offeredToPartners, updatedById: actor.id };
    let id: string;
    if (before) {
      await tx.designTheme.update({ where: { id: before.id }, data });
      id = before.id;
    } else {
      const sort = rows.reduce((m, r) => Math.max(m, r.sort), 0) + 1;
      id = (await tx.designTheme.create({ data: { ...data, sort }, select: { id: true } })).id;
    }
    await tx.designThemeVersion.create({ data: { themeId: id, values: input.values as Prisma.InputJsonValue, name: input.name, createdById: actor.id } });
    await writeAudit(actor, "design_theme_save", "design_theme", id, {
      before: before ? { name: before.name, values: before.values, offeredToStaff: before.offeredToStaff, offeredToPartners: before.offeredToPartners } : null,
      after: { name: input.name, values: input.values, offeredToStaff: input.offeredToStaff, offeredToPartners: input.offeredToPartners },
    }, tx);
    return id;
  });
}

export async function deleteTheme(actor: Actor, id: string, db: Db = prisma): Promise<void> {
  await inTx(db, async (tx) => {
    const rows = await listThemes(tx);
    const err = validateSetMutation({ kind: "delete", id }, rows);
    if (err) throw new Error(err);
    const row = rows.find((r) => r.id === id)!;
    await tx.designTheme.delete({ where: { id } }); // users/partners: SetNull; versions: Cascade
    await writeAudit(actor, "design_theme_delete", "design_theme", id, { name: row.name, values: row.values }, tx);
  });
}

export async function makeDefaultTheme(actor: Actor, id: string, db: Db = prisma): Promise<void> {
  await inTx(db, async (tx) => {
    const rows = await listThemes(tx);
    const err = validateSetMutation({ kind: "makeDefault", id }, rows);
    if (err) throw new Error(err);
    const old = rows.find((r) => r.isDefault);
    await tx.designTheme.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    await tx.designTheme.update({ where: { id }, data: { isDefault: true, updatedById: actor.id } });
    await writeAudit(actor, "design_theme_default", "design_theme", id, { from: old?.id ?? null, to: id }, tx);
  });
}

export async function restoreThemeVersion(actor: Actor, versionId: string, db: Db = prisma): Promise<void> {
  await inTx(db, async (tx) => {
    const v = await tx.designThemeVersion.findUnique({ where: { id: versionId } });
    if (!v) throw new Error("Unknown version");
    const values = normalizeSetValues(v.values);
    await tx.designTheme.update({ where: { id: v.themeId }, data: { name: v.name, values: values as Prisma.InputJsonValue, updatedById: actor.id } });
    await tx.designThemeVersion.create({ data: { themeId: v.themeId, values: values as Prisma.InputJsonValue, name: v.name, createdById: actor.id } });
    await writeAudit(actor, "design_theme_save", "design_theme", v.themeId, { note: "restore", versionId, after: { name: v.name, values } }, tx);
  });
}

export async function restoreBuiltIn(actor: Actor, id: string, db: Db = prisma): Promise<void> {
  await inTx(db, async (tx) => {
    const t = await tx.designTheme.findUnique({ where: { id }, select: { id: true, key: true, name: true } });
    if (!t) throw new Error("Unknown set");
    const values = t.key === "classic" ? CLASSIC : t.key === "website" ? WEBSITE : null;
    if (!values) throw new Error("Only built-in sets can be restored");
    await tx.designTheme.update({ where: { id }, data: { values: values as Prisma.InputJsonValue, updatedById: actor.id } });
    await tx.designThemeVersion.create({ data: { themeId: id, values: values as Prisma.InputJsonValue, name: t.name, createdById: actor.id } });
    await writeAudit(actor, "design_theme_save", "design_theme", id, { note: "restore built-in", after: { name: t.name, values } }, tx);
  });
}

export async function saveGlobal(actor: Actor, value: GlobalSettings, note: string | null, db: Db = prisma): Promise<void> {
  await inTx(db, async (tx) => {
    await tx.designSettingsVersion.create({ data: { values: value as unknown as Prisma.InputJsonValue, note, createdById: actor.id } });
    await writeAudit(actor, "design_settings_save", "design_settings", "global", { value, note }, tx);
  });
}

export async function themeHistory(id: string, db: Db = prisma) {
  const rows = await db.designThemeVersion.findMany({ where: { themeId: id }, orderBy: { createdAt: "desc" }, take: 20 });
  return rows.map((r) => ({ id: r.id, name: r.name, values: normalizeSetValues(r.values), createdAt: r.createdAt, createdById: r.createdById }));
}

export async function globalHistory(db: Db = prisma) {
  const rows = await db.designSettingsVersion.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  return rows.map((r) => ({ id: r.id, values: normalizeGlobal(r.values), note: r.note, createdAt: r.createdAt }));
}

export async function setStaffChoice(userId: string, themeId: string | null, db: Db = prisma): Promise<boolean> {
  if (themeId !== null && !canChooseSet(themeId, await listThemes(db), "staff")) return false;
  await db.user.update({ where: { id: userId }, data: { designThemeId: themeId } });
  return true;
}

export async function setPartnerChoice(partnerId: string, themeId: string | null, db: Db = prisma): Promise<boolean> {
  if (themeId !== null && !canChooseSet(themeId, await listThemes(db), "partner")) return false;
  await db.partner.update({ where: { id: partnerId }, data: { designThemeId: themeId } });
  return true;
}
