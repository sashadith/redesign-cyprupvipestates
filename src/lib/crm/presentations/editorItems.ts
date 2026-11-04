import { getDbProjectsByIds } from "@/lib/developmentRender";
import { normalizeRef } from "@/lib/unitRef";

export type EditorUnit = {
  id: string; ref: string | null; label: string | null; type: string | null; beds: string | null;
  areaBuilt: string | null; price: number | null; currency: string; status: string;
};

export type EditorItem = {
  developmentId: string;
  publicName: string; // real development name — always shown, muted
  mainImage: string | null;
  district: string | null;
  area: string | null;
  town: string | null;
  priceFrom: number | null;
  currency: string;
  aliasName: string; // editable, "" = no alias
  advisorComment: string;
  sortIndex: number;
  isNew: boolean;
  units: EditorUnit[];
  checkedUnitIds: string[];
};

type StoredItem = {
  developmentId: string;
  unitRefs: unknown;
  unitIds: unknown;
  aliasName: string | null;
  advisorComment: string | null;
  sortIndex: number;
  isNew: boolean;
};

// Maps stored presentation items to the editor's shape. Shared by the old
// admin edit page and the new CRM's loadPresentationForEditAction.
export async function buildEditorItems(stored: StoredItem[]): Promise<EditorItem[]> {
  const devMap = await getDbProjectsByIds(stored.map((i) => i.developmentId), "en");
  return stored
    .map((it): EditorItem | null => {
      const vm = devMap[it.developmentId];
      if (!vm) return null;
      const unitRefs = Array.isArray(it.unitRefs) ? (it.unitRefs as string[]) : null;
      const unitIds = Array.isArray(it.unitIds) ? (it.unitIds as string[]) : null;
      const units = vm.units.map((u) => ({
        id: u.id ?? "", ref: u.ref, label: u.label, type: u.type, beds: u.beds,
        areaBuilt: u.areaBuilt, price: u.price, currency: u.currency, status: u.status,
      }));
      const availableIds = units.filter((u) => u.status === "available").map((u) => u.id);
      // Same resolution as the public page (src/app/c/[token]/page.tsx) — null
      // unitRefs/unitIds means "whole project", i.e. every available unit checked.
      let checkedUnitIds: string[];
      if (unitRefs && unitRefs.length) {
        const matched = units.filter((u) => (u.ref && u.ref.trim() ? unitRefs.includes(normalizeRef(u.ref, vm.publicName)) : !!unitIds?.includes(u.id)));
        checkedUnitIds = matched.length ? matched.map((u) => u.id) : availableIds;
      } else if (unitIds && unitIds.length) {
        checkedUnitIds = units.filter((u) => unitIds.includes(u.id)).map((u) => u.id);
      } else {
        checkedUnitIds = availableIds;
      }
      return {
        developmentId: it.developmentId,
        publicName: vm.publicName,
        mainImage: vm.gallery[0] ?? null,
        district: vm.district || null,
        area: vm.area || null,
        town: vm.town || null,
        priceFrom: vm.priceFrom ?? null,
        currency: vm.currency || "EUR",
        aliasName: it.aliasName ?? "",
        advisorComment: it.advisorComment ?? "",
        sortIndex: it.sortIndex,
        isNew: it.isNew,
        units,
        checkedUnitIds,
      };
    })
    .filter((x): x is EditorItem => x !== null);
}
