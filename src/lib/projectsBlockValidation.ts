// Shared with sanity.utils.ts's resolveBlocks (the render path) so the
// publish-time gate below can never drift from what actually renders empty
// at request time — see findEmptyProjectsBlock's own comment for the exact
// failure mode this exists to catch.
export function isNewStyleProjectsBlock(b: any): boolean {
  return (
    b?._type === "projectsSectionBlock" &&
    (Array.isArray(b.pinnedRefs) || Array.isArray(b.excludeRefs) || b.priceMin != null || b.priceMax != null || b.pageSize != null)
  );
}

export function projectsBlockHasCriteria(b: any): boolean {
  return !!(b?.filterCity || b?.filterPropertyType || b?.priceMin != null || b?.priceMax != null);
}

export function projectsBlockHasPins(b: any): boolean {
  return Array.isArray(b?.pinnedRefs) && b.pinnedRefs.length > 0;
}

export type EmptyProjectsBlockInfo = { index: number; title: string };

// A new-style projectsSectionBlock with neither a live criteria query nor any
// pinned projects resolves to filteredProjects: [] at render time and the
// block returns null — invisible on a published page, with no error anywhere
// (discovered twice on prod: 2026-07-22's hand-picked-pins false alarm, and
// 2026-08-07's cyprus-property-management-from-abroad, published with no
// filter set at all). Returns the first such block found, or null if every
// projectsSectionBlock in `blocks` is safe to publish.
export function findEmptyProjectsBlock(blocks: any[] | null | undefined): EmptyProjectsBlockInfo | null {
  if (!Array.isArray(blocks)) return null;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (isNewStyleProjectsBlock(b) && !projectsBlockHasCriteria(b) && !projectsBlockHasPins(b)) {
      return { index: i, title: typeof b.title === "string" && b.title.trim() ? b.title.trim() : `block #${i + 1}` };
    }
  }
  return null;
}
