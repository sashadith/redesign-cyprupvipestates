import React from "react";
import type { BenefitsBlock } from "@/types/homepage";
import CountNumber from "@/app/components/CountNumber/CountNumber";

/* Benefits — dark "stats band": animated count-up numbers + label + note.
   Reuses the existing CountNumber counter and the original data. */

/* One word of the heading in the gold shimmer. `accent` names it; without one
   the old behaviour stands, which accents "Cyprus" wherever a CMS title says it.

   Matched token by token rather than by regex, deliberately. A regex needs word
   boundaries to avoid accenting a fragment inside a longer word, and `\b` does
   not do that for Cyrillic — the anti-slogan sweep lost months to exactly that
   (a `\b` rule that never once matched Russian). `\p{L}` lookarounds would fix
   it but lookbehind only reached Safari in 16.4, and a SyntaxError here takes
   the whole homepage band down. Splitting on whitespace has neither problem:
   the separators are kept, so the heading reassembles character for character. */
const renderTitle = (title: string, accent?: string) => {
  const word = (accent ?? "Cyprus").trim().toLowerCase();
  // Compare without surrounding punctuation, so a heading ending "…in Cyprus."
  // still accents — the old regex matched mid-token and this must not lose that.
  // A whitelist of punctuation, not a negated letter class: `\w` is ASCII-only
  // and `\p{L}` needs the u flag, which this tsconfig's target rejects outright.
  // Listing what to strip means no script can lose a letter to it, which a
  // negated class would do to Cyrillic and Polish the moment the flag slipped.
  const bare = (t: string) =>
    t.replace(/^[\s.,;:!?'"„“”«»()[\]–—-]+|[\s.,;:!?'"„“”«»()[\]–—-]+$/g, "").toLowerCase();
  let used = false;
  return title.split(/(\s+)/).map((token, i) => {
    if (!used && word && bare(token) === word) {
      used = true;
      return <span key={i} className="it">{token}</span>;
    }
    return <React.Fragment key={i}>{token}</React.Fragment>;
  });
};

export default function Benefits({ block, locale, accent }: { block: BenefitsBlock; locale?: string; accent?: string }) {
  if (!block || !block.benefits?.length) return null;
  const { title, benefits } = block;

  return (
    <section className="section benefits">
      <div className="wrap">
        {title && (
          <>
            <h2 className="benefits__title">{renderTitle(title, accent)}</h2>
            <hr className="shimmer benefits__stripe" />
          </>
        )}

        <div className="benefits__grid">
          {benefits.map((b) => (
            <div className="bstat" key={b._key}>
              <p className="bstat__num">
                <CountNumber locale={locale}>{b.counting?.conuntNumber ?? 0}</CountNumber>
                {b.counting?.sign && <span className="bstat__sign">{b.counting.sign}</span>}
              </p>
              {b.title && <p className="bstat__title">{b.title}</p>}
              {b.description && <p className="bstat__desc">{b.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
