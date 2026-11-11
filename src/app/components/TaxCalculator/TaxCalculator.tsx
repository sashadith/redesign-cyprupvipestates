"use client";

import React, { useMemo, useState } from "react";
import { computeTax, emptyInput, type Exemption, type Status, type TaxInput } from "@/lib/cyprusTax2026";
import { taxCalcStrings } from "./taxCalculatorI18n";
import styles from "./TaxCalculator.module.css";

/* The Cyprus tax calculator block of the guides (block type "taxCalculatorBlock"). Everything is computed in the
   browser from src/lib/cyprusTax2026.ts; no value is sent anywhere. */

type Props = { lang: string; title?: string; guideHref?: string; guideLabel?: string };
type Period = "year" | "month";

const LOCALE: Record<string, string> = { en: "en-GB", de: "de-DE", pl: "pl-PL", ru: "ru-RU" };

// Amount fields held as the text the visitor typed, so "1 2" or "12," never jump around while typing.
type Raw = Record<
  | "employment" | "selfEmployed" | "foreignPension" | "rent" | "dividends" | "interest"
  | "spouseIncome" | "homeInterestOrRent" | "disasterInsurance" | "energyOrEv" | "otherDeductions",
  string
>;
const EMPTY_RAW: Raw = {
  employment: "", selfEmployed: "", foreignPension: "", rent: "", dividends: "", interest: "",
  spouseIncome: "", homeInterestOrRent: "", disasterInsurance: "", energyOrEv: "", otherDeductions: "",
};

const parse = (s: string): number => {
  const n = Number(s.replace(/[\s  ,€]/g, "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export default function TaxCalculator({ lang, title, guideHref, guideLabel }: Props) {
  const t = taxCalcStrings(lang);
  const nf = useMemo(() => new Intl.NumberFormat(LOCALE[lang] ?? "en-GB", { maximumFractionDigits: 0 }), [lang]);
  const eur = (n: number) => `€${nf.format(Math.round(n))}`;
  const pct = (n: number) => `${(Math.round(n * 1000) / 10).toLocaleString(LOCALE[lang] ?? "en-GB")}%`;

  const [period, setPeriod] = useState<Period>("year");
  const [raw, setRaw] = useState<Raw>(EMPTY_RAW);
  const [domiciled, setDomiciled] = useState(false);
  const [pensionS1, setPensionS1] = useState(false);
  const [exemption, setExemption] = useState<Exemption>("none");
  const [status, setStatus] = useState<Status>("single");
  const [children, setChildren] = useState(0);

  const mult = period === "month" ? 12 : 1;
  const input: TaxInput = useMemo(
    () => ({
      ...emptyInput(),
      employment: parse(raw.employment) * mult,
      selfEmployed: parse(raw.selfEmployed) * mult,
      foreignPension: parse(raw.foreignPension) * mult,
      rent: parse(raw.rent) * mult,
      dividends: parse(raw.dividends) * mult,
      interest: parse(raw.interest) * mult,
      spouseIncome: parse(raw.spouseIncome) * mult,
      // Deductions are yearly amounts whatever the income period is.
      homeInterestOrRent: parse(raw.homeInterestOrRent),
      disasterInsurance: parse(raw.disasterInsurance),
      energyOrEv: parse(raw.energyOrEv),
      otherDeductions: parse(raw.otherDeductions),
      domiciled,
      pensionHasS1: pensionS1,
      exemption,
      status,
      children,
    }),
    [raw, mult, domiciled, pensionS1, exemption, status, children],
  );
  const res = useMemo(() => computeTax(input), [input]);
  const has = res.grossIncome > 0;

  const set = (k: keyof Raw) => (e: React.ChangeEvent<HTMLInputElement>) => setRaw((r) => ({ ...r, [k]: e.target.value }));
  const field = (k: keyof Raw, label: string, hint?: string) => (
    <label className={styles.field} key={k}>
      <span className={styles.label}>{label}</span>
      <span className={styles.inputWrap}>
        <span className={styles.cur} aria-hidden>€</span>
        <input
          className={styles.input}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={raw[k]}
          onChange={set(k)}
          placeholder="0"
          aria-label={label}
        />
      </span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );

  const reset = () => {
    setRaw(EMPTY_RAW);
    setDomiciled(false);
    setPensionS1(false);
    setExemption("none");
    setStatus("single");
    setChildren(0);
  };

  const burdenShare = has ? res.totalBurden / res.grossIncome : 0;
  const taxShare = has ? res.incomeTax / res.grossIncome : 0;
  const contribShare = has ? (res.socialInsurance + res.hrda + res.ghs + res.sdc) / res.grossIncome : 0;
  const netShare = has ? Math.max(0, res.net / res.grossIncome) : 0;
  const showHrda = res.hrda > 0;
  const showSdc = res.sdc > 0;

  return (
    <section className={styles.calc} aria-label={title || t.title}>
      <h2 className={styles.title}>{title || t.title}</h2>
      <p className={styles.lead}>{t.lead}</p>

      <div className={styles.grid}>
        <form className={styles.form} onSubmit={(e) => e.preventDefault()} noValidate>
          <div className={styles.period} role="group" aria-label={t.amountsIn}>
            <span className={styles.periodLabel}>{t.amountsIn}</span>
            {(["year", "month"] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`${styles.seg} ${period === p ? styles.segOn : ""}`}
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
              >
                {p === "year" ? t.perYear : t.perMonth}
              </button>
            ))}
          </div>

          <fieldset className={styles.set}>
            <legend className={styles.legend}>{t.incomeHeading}</legend>
            {field("employment", t.employment)}
            {field("selfEmployed", t.selfEmployed)}
            {field("foreignPension", t.foreignPension)}
            {field("rent", t.rent)}
          </fieldset>

          <details className={styles.more}>
            <summary>{t.moreIncome}</summary>
            <div className={styles.moreBody}>
              {field("dividends", t.dividends)}
              {field("interest", t.interest)}
              <label className={styles.check}>
                <input type="checkbox" checked={domiciled} onChange={(e) => setDomiciled(e.target.checked)} />
                <span>{t.domiciled}</span>
              </label>
              <p className={styles.hint}>{t.domiciledHint}</p>
              <label className={styles.check}>
                <input type="checkbox" checked={pensionS1} onChange={(e) => setPensionS1(e.target.checked)} />
                <span>{t.pensionS1}</span>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>{t.exemptionHeading}</span>
                <select className={styles.select} value={exemption} onChange={(e) => setExemption(e.target.value as Exemption)}>
                  {(["none", "half", "fifth", "quarter"] as Exemption[]).map((k) => (
                    <option key={k} value={k}>{t.exemption[k]}</option>
                  ))}
                </select>
                <span className={styles.hint}>{t.exemptionHint}</span>
              </label>
            </div>
          </details>

          <details className={styles.more}>
            <summary>{t.familyHeading}</summary>
            <div className={styles.moreBody}>
              <label className={styles.field}>
                <span className={styles.label}>{t.statusLabel}</span>
                <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                  {(["single", "singleParent", "married"] as Status[]).map((k) => (
                    <option key={k} value={k}>{t.status[k]}</option>
                  ))}
                </select>
              </label>
              {status === "married" && field("spouseIncome", t.spouseIncome)}
              <label className={styles.field}>
                <span className={styles.label}>{t.children}</span>
                <select className={styles.select} value={children} onChange={(e) => setChildren(Number(e.target.value))}>
                  {Array.from({ length: 9 }, (_, n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              {field("homeInterestOrRent", t.homeInterest)}
              {field("disasterInsurance", t.disasterInsurance)}
              {field("energyOrEv", t.energyEv)}
              {field("otherDeductions", t.otherDeductions)}
              <p className={styles.hint}>{t.familyHint}</p>
            </div>
          </details>

          <button type="button" className={styles.reset} onClick={reset}>{t.reset}</button>
        </form>

        <div className={styles.result} aria-live="polite">
          <h3 className={styles.resultTitle}>{t.resultHeading}</h3>
          {!has ? (
            <p className={styles.empty}>{t.empty}</p>
          ) : (
            <>
              <div className={styles.keep}>
                <div className={styles.keepBig}>{eur(res.net)}</div>
                <div className={styles.keepLabel}>{t.netYear}</div>
                <div className={styles.keepMonth}>{eur(res.net / 12)} {t.netMonth}</div>
              </div>

              <div className={styles.bar} role="img" aria-label={`${t.barNet} ${pct(netShare)}, ${t.barTax} ${pct(taxShare)}, ${t.barContrib} ${pct(contribShare)}`}>
                <span className={styles.barNet} style={{ width: `${netShare * 100}%` }} />
                <span className={styles.barTax} style={{ width: `${taxShare * 100}%` }} />
                <span className={styles.barContrib} style={{ width: `${contribShare * 100}%` }} />
              </div>
              <ul className={styles.legend2}>
                <li><i className={styles.dotNet} />{t.barNet} {pct(netShare)}</li>
                <li><i className={styles.dotTax} />{t.barTax} {pct(taxShare)}</li>
                <li><i className={styles.dotContrib} />{t.barContrib} {pct(contribShare)}</li>
              </ul>

              <table className={styles.table}>
                <tbody>
                  <tr><th scope="row">{t.grossTotal}</th><td>{eur(res.grossIncome)}</td></tr>
                  {res.exemptAmount > 0 && <tr><th scope="row">{t.lines.exempt}</th><td>{eur(res.exemptAmount)}</td></tr>}
                  <tr><th scope="row">{t.lines.deductions}</th><td>{eur(res.deductions.socialAndGhs + res.deductions.other + res.deductions.family)}</td></tr>
                  <tr><th scope="row">{t.lines.chargeable}</th><td>{eur(res.chargeable)}</td></tr>
                  <tr className={styles.sep}><th scope="row">{t.lines.incomeTax}</th><td>{eur(res.incomeTax)}</td></tr>
                  <tr><th scope="row">{t.lines.social}</th><td>{eur(res.socialInsurance)}</td></tr>
                  {showHrda && <tr><th scope="row">{t.lines.hrda}</th><td>{eur(res.hrda)}</td></tr>}
                  <tr><th scope="row">{t.lines.ghs}</th><td>{eur(res.ghs)}</td></tr>
                  {showSdc && <tr><th scope="row">{t.lines.sdc}</th><td>{eur(res.sdc)}</td></tr>}
                  <tr className={styles.total}><th scope="row">{t.burden}</th><td>{eur(res.totalBurden)} <span className={styles.muted}>· {pct(burdenShare)} {t.effective}</span></td></tr>
                </tbody>
              </table>

              {res.bands.some((b) => b.amount > 0) && (
                <>
                  <h4 className={styles.subTitle}>{t.bandsHeading}</h4>
                  <table className={styles.table}>
                    <thead>
                      <tr><th>{t.bandCols.band}</th><th>{t.bandCols.rate}</th><th>{t.bandCols.income}</th><th>{t.bandCols.tax}</th></tr>
                    </thead>
                    <tbody>
                      {res.bands.filter((b) => b.amount > 0).map((b) => (
                        <tr key={b.from}>
                          <th scope="row">{Number.isFinite(b.upTo) ? `${eur(b.from)} – ${eur(b.upTo)}` : `${t.above} ${eur(b.from)}`}</th>
                          <td>{pct(b.rate)}</td>
                          <td>{eur(b.amount)}</td>
                          <td>{eur(b.tax)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              <ul className={styles.flags}>
                {input.foreignPension > 0 && (
                  <li>{res.pension.elected ? t.pensionElected : t.pensionNormal}</li>
                )}
                {!res.familyDeductionsApplied && res.familyIncome > res.familyCeiling && <li>{t.familyOff}</li>}
                {res.deductions.otherDisallowed > 0 && <li>{t.otherCapped}</li>}
              </ul>
            </>
          )}
        </div>
      </div>

      <details className={styles.notes}>
        <summary>{t.notesHeading}</summary>
        <ul>
          {t.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      </details>
      <p className={styles.disclaimer}>
        {t.disclaimer}
        {guideHref && (
          <> {t.guideLead} <a href={guideHref}>{guideLabel || guideHref}</a></>
        )}
      </p>
    </section>
  );
}
