// Should the CRM's AutoRefresh skip this tick because the operator is in the
// middle of an edit? Pure so it can be unit-tested with plain objects.
//
// 2026-09-09: the old rule was "any focused field" — and the lead list's
// search box keeps focus after a search, so the list silently stopped
// refreshing for as long as the cursor sat there (a lead trashed from the
// MCP connector only vanished after a manual reload). The refresh only
// hurts when a server-rendered defaultValue would land under a half-typed
// value, i.e. an UNCONTROLLED field that is dirty — controlled inputs
// (React state) survive router.refresh() untouched and keep their value
// attribute in sync, so they never read as dirty here. Selects can't hold a
// half-done edit; contentEditable can, and has no default to compare with.
export type FocusedElementLike = {
  tagName: string;
  isContentEditable?: boolean;
  value?: string;
  defaultValue?: string;
};

export function hasUnsavedEdit(el: FocusedElementLike | null | undefined): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA") return (el.value ?? "") !== (el.defaultValue ?? "");
  return false;
}
