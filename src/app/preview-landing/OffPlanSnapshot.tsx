import React from "react";

/* The off-plan market snapshot — authored in the CMS long ago, never rendered:
   no component for `offPlanSnapshotBlock` existed anywhere in the tree, so the
   catch-all fell through to its default case and printed the literal string
   "Unsupported block type" to visitors on all three off-plan pages.

   Content shape as it actually is in the DB (verified 2026-09-02, all three
   pages identical in shape): heading, blurb, stats[{label, value}], ctaLabel,
   footnote. Every field is optional here — the block is hand-authored, and a
   missing footnote should thin the panel out rather than break it. */
export type OffPlanSnapshotBlock = {
  _key?: string;
  heading?: string;
  blurb?: string;
  stats?: { label?: string; value?: string }[];
  ctaLabel?: string;
  footnote?: string;
};

export default function OffPlanSnapshot({ block, ctaHref }: { block: OffPlanSnapshotBlock; ctaHref: string }) {
  const stats = (block.stats ?? []).filter((s) => s?.value || s?.label);
  if (!block.heading && !block.blurb && !stats.length) return null;

  return (
    <div className="pl-snap">
      {block.heading && <h2 className="pl-snap__h">{block.heading}</h2>}
      {block.blurb && <p className="pl-snap__blurb">{block.blurb}</p>}

      {stats.length > 0 && (
        <dl className="pl-snap__stats">
          {stats.map((s, i) => (
            <div className="pl-snap__stat" key={i}>
              <dt className="pl-snap__label">{s.label}</dt>
              <dd className="pl-snap__value">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {block.ctaLabel && (
        <a className="btn btn--glass pl-snap__cta" href={ctaHref}>
          {block.ctaLabel}
        </a>
      )}

      {/* The methodology note is the reason the figures can be believed —
          it says what is counted and what is not. Small, but never dropped. */}
      {block.footnote && <p className="pl-snap__foot">{block.footnote}</p>}
    </div>
  );
}
