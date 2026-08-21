"use client";

import { useMemo, useState } from "react";
import { languageLabel, sortLanguageKeys } from "./languages";


export type FinderMember = {
  name: string;
  position: string;
  photo: string | null;
  alt: string;
  /** Normalised language keys, plus the raw text for unrecognised ones. */
  languageKeys: string[];
  languageRaw: Record<string, string>;
};

/* The routing core of the Contacts page: pick a language, see exactly who
   speaks it. Everything is rendered server-side and merely FILTERED here —
   no data fetching, no loading state — so the full team is in the SSR'd HTML
   for crawlers and for anyone with JS disabled (in which case every member
   stays visible, which is the correct degradation for a contacts page).

   Filtering is CSS-class based rather than conditional rendering: hidden
   members keep their DOM node, so the browser never re-lays-out the images
   and the reveal animation isn't re-triggered on every filter change. */

/* Only the strings this component actually renders — deliberately NOT the
   whole ContactsStrings object. That object carries a pluralisation helper,
   and a function cannot cross the server/client boundary; passing a narrow,
   fully-serializable subset is both the fix and the better boundary. */
export type FinderLabels = {
  languageLabel: string;
  all: string;
  empty: string;
  countOne: string;
  countMany: string;
  speaks: string;
};

export default function ConsultantFinder({
  members,
  lang,
  labels,
}: {
  members: FinderMember[];
  lang: string;
  labels: FinderLabels;
}) {
  const [active, setActive] = useState<string | null>(null);

  const chips = useMemo(() => {
    const counts = new Map<string, number>();
    const raws = new Map<string, string>();
    for (const m of members) {
      for (const k of m.languageKeys) {
        counts.set(k, (counts.get(k) ?? 0) + 1);
        if (!raws.has(k)) raws.set(k, m.languageRaw[k] ?? k);
      }
    }
    return sortLanguageKeys(Array.from(counts.keys())).map((k) => ({
      key: k,
      label: languageLabel(k, lang, raws.get(k)),
      count: counts.get(k) ?? 0,
    }));
  }, [members, lang]);

  const visible = active ? members.filter((m) => m.languageKeys.includes(active)) : members;

  return (
    <div className="cnt__finder">
      <div className="cnt__chips" role="group" aria-label={labels.languageLabel}>
        <button
          type="button"
          className={`cnt__chip${active === null ? " is-active" : ""}`}
          onClick={() => setActive(null)}
          aria-pressed={active === null}
        >
          {labels.all}
          <span className="cnt__chip-n">{members.length}</span>
        </button>
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`cnt__chip${active === c.key ? " is-active" : ""}`}
            onClick={() => setActive(active === c.key ? null : c.key)}
            aria-pressed={active === c.key}
          >
            {c.label}
            <span className="cnt__chip-n">{c.count}</span>
          </button>
        ))}
      </div>

      <p className="cnt__finder-count" aria-live="polite">
        {visible.length === 1 ? labels.countOne : labels.countMany.replace("{n}", String(visible.length))}
      </p>

      {visible.length === 0 ? (
        <p className="cnt__finder-empty">{labels.empty}</p>
      ) : (
        <ul className="cnt__people">
          {members.map((m) => {
            const shown = !active || m.languageKeys.includes(active);
            return (
              <li className={`cnt__person${shown ? "" : " is-hidden"}`} key={m.name} aria-hidden={!shown}>
                <div className="cnt__person-photo">
                  {m.photo ? <img src={m.photo} alt={m.alt} loading="lazy" /> : <span className="cnt__person-ph" aria-hidden />}
                </div>
                <div className="cnt__person-body">
                  <h3 className="cnt__person-name">{m.name}</h3>
                  <p className="cnt__person-role">{m.position}</p>
                  <p className="cnt__person-langs">
                    <span className="cnt__person-langs-label">{labels.speaks}</span>
                    {m.languageKeys.map((k) => languageLabel(k, lang, m.languageRaw[k])).join(" · ")}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
