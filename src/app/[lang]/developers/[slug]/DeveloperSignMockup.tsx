// Bündel 3 Teil 2 (2026-08-02) — built once, reused for every developer: a
// signboard-on-posts mockup standing in for the blog hero's phone mockup
// (.ins__device, InsightsIndex.tsx — there it frames an article preview,
// here it frames the developer's own logo). Only the logo image varies
// between developers; everything else (board, posts, shadow) is shared CSS.
//
// Logos vary wildly in proportion (wide/flat vs. near-square) — the board's
// plate uses object-fit: contain with generous padding so any ratio sits
// centered without cropping or distortion, never stretched to fill.
//
// FIRST DRAFT for staging review (2026-08-02) — execution/proportions/palette
// all up for revision once seen live.
export default function DeveloperSignMockup({ logoUrl, alt }: { logoUrl?: string; alt: string }) {
  return (
    <div className="dev-sign" aria-hidden>
      <div className="dev-sign__board">
        <div className="dev-sign__plate">
          {logoUrl && <img className="dev-sign__logo" src={logoUrl} alt="" />}
        </div>
      </div>
      <div className="dev-sign__posts">
        <span className="dev-sign__post dev-sign__post--l" />
        <span className="dev-sign__post dev-sign__post--r" />
      </div>
    </div>
  );
}
