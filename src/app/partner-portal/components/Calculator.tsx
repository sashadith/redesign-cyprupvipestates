"use client";
/** Commission calculator (phase 3d): price × the partner's effective rates, per project, client-side. */
import { useMemo, useState } from "react";
import { calculatePayouts, parsePriceInput } from "@/lib/partner/calculator";
import type { PartnerDict, PartnerLocale } from "@/lib/partner/i18n";
import { fill } from "./forms";

/** Only what the page shows: effective rates, and our rate only for trust-mode partners (else null). */
export type CalcProject = {
  id: string;
  name: string;
  town: string | null;
  handoverRate: number | null;
  fixRate: number | null;
  ourRate: number | null;
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Props = { t: PartnerDict; locale: PartnerLocale; projects: CalcProject[]; trustMode: boolean };

export function Calculator({ t, locale, projects, trustMode }: Props) {
  const C = t.calculator;
  const [priceText, setPriceText] = useState("");
  const [q, setQ] = useState("");
  const price = parsePriceInput(priceText);
  const eur = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }), [locale]);
  const pct = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale]);
  const shown = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return projects;
    return projects.filter((p) => {
      const hay = norm(`${p.name} ${p.town ?? ""}`);
      return words.every((w) => hay.includes(w));
    });
  }, [q, projects]);
  const rows = useMemo(() => (price == null ? [] : calculatePayouts(price, shown, { trust: trustMode })), [price, shown, trustMode]);
  const money = (n: number | null) => (n == null ? C.onRequest : eur.format(n));
  const invalid = priceText.trim() !== "" && price == null;

  return (
    <>
      <section className="pp-panel">
        <div className="pp-form">
          <div className={invalid ? "pp-field pp-field-bad" : "pp-field"}>
            <label htmlFor="calc-price">{C.price}</label>
            <input
              id="calc-price" inputMode="numeric" autoComplete="off" maxLength={20} value={priceText} placeholder={C.pricePlaceholder}
              onChange={(e) => setPriceText(e.target.value)}
              aria-invalid={invalid || undefined} aria-describedby={invalid ? "calc-price-err" : "calc-price-hint"}
            />
            {invalid ? (
              <small id="calc-price-err" className="pp-err" role="alert">{C.invalid}</small>
            ) : (
              <small id="calc-price-hint" className="pp-hint">{C.hint}</small>
            )}
          </div>
          <div className="pp-field">
            <label htmlFor="calc-q">{C.project}</label>
            <input
              id="calc-q" className="pp-search" type="search" value={q} placeholder={C.search} maxLength={100}
              onChange={(e) => setQ(e.target.value)}
            />
            <small className="pp-hint" aria-live="polite">
              {q.trim() ? fill(C.shown, { count: String(shown.length) }) : `${C.allProjects} · ${fill(C.shown, { count: String(shown.length) })}`}
            </small>
          </div>
        </div>
      </section>

      <section className="pp-panel pp-panel-flush" aria-live="polite">
        {price == null ? (
          <p className="pp-muted pp-calc-empty">{C.enterPrice}</p>
        ) : rows.length === 0 ? (
          <p className="pp-muted pp-calc-empty">{projects.length ? C.none : t.submit.projectsNone}</p>
        ) : (
          <table className="pp-table">
            <thead>
              <tr>
                <th scope="col">{C.project}</th>
                <th scope="col">{C.town}</th>
                <th scope="col">{C.handover}</th>
                <th scope="col">{C.fix}</th>
                {trustMode && <th scope="col">{C.ourRate}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{r.name}</th>
                  <td data-label={C.town}>{r.town ?? ""}</td>
                  <td data-label={C.handover}><span className="pp-figure-sm">{money(r.handover)}</span></td>
                  <td data-label={C.fix}><span className="pp-figure-sm">{money(r.fix)}</span></td>
                  {trustMode && (
                    <td data-label={C.ourRate}>
                      <span className="pp-figure-sm">{r.ourRate == null ? C.onRequest : fill(t.projectsPage.pct, { rate: pct.format(r.ourRate) })}</span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="pp-small pp-muted">{C.disclaimer}</p>
    </>
  );
}
