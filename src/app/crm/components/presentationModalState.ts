// Pure state helpers for the presentation modal (no React, no Prisma), so the
// close guard and the item snapshots of both create and edit are testable.
import type { DevelopmentMatch } from "@/lib/crm/matching";
import type { PresentationItemInput } from "@/lib/crm/presentations/core";
import type { EditorItem, EditorUnit } from "@/lib/crm/presentations/editorItems";
import { normalizeRef } from "@/lib/unitRef";

/** What the operator would lose by closing. Auto-checked 100 % matches and the
 *  filters (auto-saved on the lead) are not picks, so they are not in here. */
export type ModalSnapshot = {
  picked: string[];       // ticked by hand
  unpicked: string[];     // auto-checked, then unticked by hand
  unitOverrides: Record<string, string[]>;
  comments: Record<string, string>;
  greetingName: string;
  personalNote: string;
  locale: string;
  advisorId: string;
};

const sorted = (xs: string[]) => xs.slice().sort();
const sameList = (a: string[], b: string[]) => {
  const x = sorted(a); const y = sorted(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};
function sameOverrides(a: Record<string, string[]>, b: Record<string, string[]>): boolean {
  const ka = Object.keys(a); const kb = Object.keys(b);
  return sameList(ka, kb) && ka.every((k) => sameList(a[k], b[k] ?? []));
}
const nonBlank = (c: Record<string, string>) =>
  Object.keys(c).filter((k) => c[k].trim()).reduce<Record<string, string>>((o, k) => { o[k] = c[k].trim(); return o; }, {});
function sameComments(a: Record<string, string>, b: Record<string, string>): boolean {
  const x = nonBlank(a); const y = nonBlank(b);
  return sameList(Object.keys(x), Object.keys(y)) && Object.keys(x).every((k) => x[k] === y[k]);
}

export function isDirty(state: ModalSnapshot, initial: ModalSnapshot): boolean {
  return !(
    sameList(state.picked, initial.picked) &&
    sameList(state.unpicked, initial.unpicked) &&
    sameOverrides(state.unitOverrides, initial.unitOverrides) &&
    sameComments(state.comments, initial.comments) &&
    state.greetingName === initial.greetingName &&
    state.personalNote === initial.personalNote &&
    state.locale === initial.locale &&
    state.advisorId === initial.advisorId
  );
}

export const DISCARD_MESSAGE = "Discard this selection? Your picks will be lost.";

/** True when closing is allowed. A clean modal closes without asking. */
export function confirmDiscard(dirty: boolean, confirmFn: (msg: string) => boolean): boolean {
  return dirty ? confirmFn(DISCARD_MESSAGE) : true;
}

type Overrides = ReadonlyMap<string, ReadonlySet<string>>;

// Same rules as the old panel's generate(): the presentation is a snapshot of
// what the operator sees. No override = the matched (exact) units. "No unit
// data" is judged on allAvailableUnits, not matchedUnits: a project with real
// units of which none match exactly is NOT a null/null whole-project item.
function resolve(selectedDevIds: string[], unitOverrides: Overrides, results: DevelopmentMatch[]) {
  return selectedDevIds.map((developmentId) => {
    const m = results.find((r) => r.development.id === developmentId);
    const hasUnitData = (m?.allAvailableUnits.length ?? 0) > 0;
    const defaultIds = m?.matchedUnits.map((u) => u.id) ?? [];
    const effective: ReadonlySet<string> = unitOverrides.get(developmentId) ?? new Set(defaultIds);
    return { developmentId, m, publicName: m?.development.publicName ?? developmentId, hasUnitData, effective };
  });
}

/** Names of selected projects with unit data but nothing picked: left out of the presentation. */
export function droppedSelections(selectedDevIds: string[], unitOverrides: Overrides, results: DevelopmentMatch[]): string[] {
  return resolve(selectedDevIds, unitOverrides, results).filter((r) => r.hasUnitData && r.effective.size === 0).map((r) => r.publicName);
}

export function buildItems(
  selectedDevIds: string[],
  unitOverrides: Overrides,
  comments: ReadonlyMap<string, string>,
  results: DevelopmentMatch[],
): PresentationItemInput[] {
  const kept = resolve(selectedDevIds, unitOverrides, results).filter((r) => !(r.hasUnitData && r.effective.size === 0));
  return kept.map(({ developmentId, m, hasUnitData, effective }, i) => {
    let unitRefs: string[] | null = null;
    let unitIds: string[] | null = null;
    if (hasUnitData && m) {
      // Stable normalized refs survive feed re-syncs; units with no ref at all
      // (manual units, never wiped by a sync) fall back to their id. A unit
      // added via "show all" lives only in allAvailableUnits.
      const refs: string[] = [];
      const ids: string[] = [];
      Array.from(effective).forEach((id) => {
        const u = m.matchedUnits.find((x) => x.id === id) ?? m.allAvailableUnits.find((x) => x.id === id);
        if (u?.ref && u.ref.trim()) refs.push(normalizeRef(u.ref, m.development.publicName || ""));
        else ids.push(id);
      });
      unitRefs = refs.length ? refs : null;
      unitIds = ids.length ? ids : null;
    }
    return { developmentId, unitRefs, unitIds, sortIndex: i, advisorComment: comments.get(developmentId) ?? "" };
  });
}

/** Map<string, Set<string>> → plain record for snapshots. */
export function overridesRecord(o: Overrides): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  o.forEach((set, k) => { out[k] = Array.from(set); });
  return out;
}
export function mapRecord(o: ReadonlyMap<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  o.forEach((v, k) => { out[k] = v; });
  return out;
}

/** Selected projects that the current results don't show (e.g. a hand pick the
 *  filters no longer match). They are still sent, so the modal lists them. */
export function hiddenSelections(
  selectedDevIds: string[], results: DevelopmentMatch[], knownNames: ReadonlyMap<string, string>,
): { id: string; name: string }[] {
  const shown = new Set(results.map((r) => r.development.id));
  return selectedDevIds.filter((id) => !shown.has(id)).map((id) => ({ id, name: knownNames.get(id) ?? "Unknown project" }));
}

// ---- Edit mode ----

/** A project ticked in the "Add projects" panel, as a selection item: every
 *  available unit listed, the exact matches (or the operator's override) checked. */
export function editorItemFromMatch(m: DevelopmentMatch, override: ReadonlySet<string> | undefined, comment: string): EditorItem {
  const d = m.development;
  const units: EditorUnit[] = [];
  const seen = new Set<string>();
  m.matchedUnits.concat(m.allAvailableUnits).forEach((u) => {
    if (seen.has(u.id)) return;
    seen.add(u.id);
    units.push({ id: u.id, ref: u.ref, label: u.label, type: u.type, beds: u.beds, areaBuilt: u.areaBuilt, price: u.price, currency: d.currency, status: u.status });
  });
  const checkedUnitIds = override ? Array.from(override) : m.matchedUnits.filter((u) => u.status === "available").map((u) => u.id);
  return {
    developmentId: d.id, publicName: d.publicName, mainImage: d.mainImage,
    district: d.district, area: d.area, town: d.town, priceFrom: d.priceFrom, currency: d.currency,
    aliasName: "", advisorComment: comment, sortIndex: 0, isNew: true, units, checkedUnitIds,
  };
}

const availableIdsOf = (it: EditorItem) => it.units.filter((u) => u.status === "available").map((u) => u.id);

/** Has available units but none checked: would collapse to "whole project", so it is left out (after a warning). */
export function emptyEditItems(items: EditorItem[]): EditorItem[] {
  return items.filter((it) => availableIdsOf(it).length > 0 && it.checkedUnitIds.length === 0);
}

// Same split as the old editor (PresentationEditor.tsx splitUnitSelection):
// always the explicit checked set, so a save never resets a filtered selection
// to "every available unit". Null only when there is nothing available.
function editUnitSelection(it: EditorItem): { unitRefs: string[] | null; unitIds: string[] | null } {
  if (availableIdsOf(it).length === 0) return { unitRefs: null, unitIds: null };
  const checked = new Set(it.checkedUnitIds);
  const refs: string[] = [];
  const ids: string[] = [];
  it.units.forEach((u) => {
    if (!checked.has(u.id)) return;
    if (u.ref && u.ref.trim()) refs.push(normalizeRef(u.ref, it.publicName));
    else ids.push(u.id);
  });
  return { unitRefs: refs.length ? refs : null, unitIds: ids.length ? ids : null };
}

/** Items for savePresentationEditAction, in display order. */
export function editPayloadItems(items: EditorItem[]): PresentationItemInput[] {
  return items.map((it, i) => ({
    developmentId: it.developmentId,
    aliasName: it.aliasName || null,
    advisorComment: it.advisorComment || null,
    ...editUnitSelection(it),
    sortIndex: i,
  }));
}

export type EditGeneral = { greetingName: string; personalNote: string; locale: string; advisorId: string; expiresAt: string };
export type EditSnapshot = EditGeneral & {
  items: { id: string; alias: string; comment: string; units: string[] }[]; // in display order
  pending: string[]; // ticked in "Add projects", not yet in the selection
  pendingOverrides: Record<string, string[]>;
  pendingComments: Record<string, string>;
};

export function editSnapshot(
  items: EditorItem[], general: EditGeneral, pending: string[],
  pendingOverrides: Overrides, pendingComments: ReadonlyMap<string, string>,
): EditSnapshot {
  return {
    ...general,
    items: items.map((it) => ({ id: it.developmentId, alias: it.aliasName.trim(), comment: it.advisorComment.trim(), units: sorted(it.checkedUnitIds) })),
    pending, pendingOverrides: overridesRecord(pendingOverrides), pendingComments: mapRecord(pendingComments),
  };
}

export function isEditDirty(state: EditSnapshot, initial: EditSnapshot): boolean {
  const sameItems = state.items.length === initial.items.length && state.items.every((a, i) => {
    const b = initial.items[i];
    return a.id === b.id && a.alias === b.alias && a.comment === b.comment && sameList(a.units, b.units);
  });
  return !(
    sameItems &&
    sameList(state.pending, initial.pending) &&
    sameOverrides(state.pendingOverrides, initial.pendingOverrides) &&
    sameComments(state.pendingComments, initial.pendingComments) &&
    state.greetingName === initial.greetingName &&
    state.personalNote === initial.personalNote &&
    state.locale === initial.locale &&
    state.advisorId === initial.advisorId &&
    state.expiresAt === initial.expiresAt
  );
}

/** True when the item may be removed. A project the client hearted asks first. */
export function removeItemConfirm(it: EditorItem, favoritedIds: ReadonlySet<string>, confirmFn: (msg: string) => boolean): boolean {
  if (!favoritedIds.has(it.developmentId)) return true;
  const name = it.aliasName.trim() || it.publicName;
  return confirmFn(`The client favorited ${name}. Remove it anyway?`);
}
