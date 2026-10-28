// Pure state helpers for the "New presentation" modal (no React, no Prisma),
// so the close guard and the item snapshot are testable on their own.
import type { DevelopmentMatch } from "@/lib/crm/matching";
import type { PresentationItemInput } from "@/lib/crm/presentations/core";
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
