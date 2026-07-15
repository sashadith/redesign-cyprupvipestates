"use client";

import { useLayoutEffect, useRef, useState } from "react";

/* Generic "show N, then expand" list wrapper — used by the activity timeline
   and the per-presentation Engagement panel on /admin/crm/[id]. All items stay
   mounted; a measured max-height (not a giant/none value, which would snap
   instead of animate) transitions between the collapsed and full heights, so
   both expand and collapse are genuinely smooth with no layout jump. Pass the
   list items directly as children (each a direct child element, e.g. a <div>
   per row) — this component only renders the wrapping <div>. */
export default function CollapsibleList({
  children, itemCount, previewCount = 5,
}: {
  children: React.ReactNode;
  itemCount: number;
  previewCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [collapsedH, setCollapsedH] = useState<number | null>(null);
  const [fullH, setFullH] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    if (!kids.length) return;
    setFullH(el.scrollHeight);
    if (kids.length > previewCount) {
      const boundary = kids[previewCount - 1];
      setCollapsedH(boundary.offsetTop + boundary.offsetHeight - kids[0].offsetTop);
    } else {
      setCollapsedH(el.scrollHeight);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCount, previewCount]);

  const needsToggle = itemCount > previewCount;
  const maxHeight = !needsToggle ? undefined : expanded ? (fullH ?? undefined) : (collapsedH ?? undefined);

  return (
    <div>
      <div ref={wrapRef} style={{ maxHeight, overflow: needsToggle ? "hidden" : undefined, transition: "max-height 0.35s ease" }}>
        {children}
      </div>
      {needsToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs text-[#1B4B43] hover:underline"
        >
          {expanded ? "Show less" : `Show all (${itemCount})`}
        </button>
      )}
    </div>
  );
}
