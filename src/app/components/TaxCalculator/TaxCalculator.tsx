"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { computeInvestorTax, emptyInvestorInput, type Exemption, type InvestorInput, type Status } from "@/lib/cyprusTax2026";
import { taxCalcStrings, type SourceKey } from "./taxCalculatorI18n";
import styles from "./TaxCalculator.module.css";

/* The Cyprus tax calculator block of the guides (block type "taxCalculatorBlock"). Everything is computed in the
   browser from src/lib/cyprusTax2026.ts; no value is sent anywhere. Built for owners of companies and investors:
   the sources of income come first, salary last. */

type Props = { lang: string; title?: string; guideHref?: string; guideLabel?: string };

const LOCALE: Record<string, string> = { en: "en-GB", de: "de-DE", pl: "pl-PL", ru: "ru-RU" };
const ORDER: SourceKey[] = ["company", "dividends", "interest", "property", "crypto", "pension", "selfEmployed", "employment"];

type Vals = {
  companyProfit: string; companySalary: string; companyDividend: string;
  dividends: string; interest: string; propertyGain: string; cryptoGain: string;
  pension: string; selfEmployed: string; employment: string;
  spouseIncome: string; homeInterestOrRent: string; disasterInsurance: string; energyOrEv: string; otherDeductions: string;
};
const EMPTY_VALS: Vals = {
  companyProfit: "", companySalary: "", companyDividend: "", dividends: "", interest: "", propertyGain: "", cryptoGain: "",
  pension: "", selfEmployed: "", employment: "", spouseIncome: "", homeInterestOrRent: "", disasterInsurance: "", energyOrEv: "", otherDeductions: "",
};
const NO_SOURCES: Record<SourceKey, boolean> = {
  company: false, dividends: false, interest: false, property: false, crypto: false, pension: false, selfEmployed: false, employment: false,
};

type PresetKey = "owner" | "investor" | "pension" | "freelancer" | "employee";
/* The chips at the top are toggles that can be combined. `main` are the sources a chip switches on (with example amounts
   where the field is empty), `all` also covers the optional ones that are switched off together with it. */
const PRESETS: Record<PresetKey, { main: SourceKey[]; all: SourceKey[]; vals: Partial<Vals> }> = {
  owner: { main: ["company"], all: ["company"], vals: { companyProfit: "250000", companySalary: "30000", companyDividend: "120000" } },
  investor: { main: ["dividends", "interest", "property"], all: ["dividends", "interest", "property", "crypto"], vals: { dividends: "80000", interest: "20000", propertyGain: "150000" } },
  pension: { main: ["pension"], all: ["pension"], vals: { pension: "36000" } },
  freelancer: { main: ["selfEmployed"], all: ["selfEmployed"], vals: { selfEmployed: "70000" } },
  employee: { main: ["employment"], all: ["employment"], vals: { employment: "60000" } },
};
const PRESET_KEYS = Object.keys(PRESETS) as PresetKey[];

const num = (s: string): number => {
  const n = Number(String(s).replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Animated open/close: the row height transitions with the grid-template-rows trick, no measuring. */
function Collapse({ open, id, children }: { open: boolean; id?: string; children: React.ReactNode }) {
  return (
    <div id={id} className={`${styles.collapse} ${open ? styles.collapseOpen : ""}`} aria-hidden={!open}>
      <div className={styles.collapseInner}>{children}</div>
    </div>
  );
}

function Chevron() {
  return (
    <svg className={styles.chev} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A titled section that opens and closes with an animation. */
function Section({ title, badge, defaultOpen = false, children }: { title: string; badge?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useRef(`sec-${Math.random().toString(36).slice(2, 9)}`).current;
  return (
    <div className={styles.section}>
      <button type="button" className={styles.sectionHead} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span className={styles.sectionTitle}>{badge && <i>{badge}</i>}{title}</span>
        <Chevron />
      </button>
      <Collapse open={open} id={id}>
        <div className={styles.sectionBody}>{children}</div>
      </Collapse>
    </div>
  );
}

export default function TaxCalculator({ lang, title, guideHref, guideLabel }: Props) {
  const t = taxCalcStrings(lang);
  const loc = LOCALE[lang] ?? "en-GB";
  const nf = useMemo(() => new Intl.NumberFormat(loc, { maximumFractionDigits: 0 }), [loc]);
  const eur = (n: number) => `€${nf.format(Math.round(n))}`;
  const pct = (n: number) => `${(Math.round(n * 1000) / 10).toLocaleString(loc)}%`;

  const [domiciled, setDomiciled] = useState(false);
  const [on, setOn] = useState<Record<SourceKey, boolean>>(NO_SOURCES);
  const [vals, setVals] = useState<Vals>(EMPTY_VALS);
  const [mainHome, setMainHome] = useState(false);
  const [pensionS1, setPensionS1] = useState(false);
  const [exemption, setExemption] = useState<Exemption>("none");
  const [status, setStatus] = useState<Status>("single");
  const [children, setChildren] = useState(0);

  const setVal = (k: keyof Vals) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setVals((v) => ({ ...v, [k]: e.target.value.replace(/[^0-9]/g, "") }));
  };
  const toggle = (k: SourceKey) => {
    setOn((o) => ({ ...o, [k]: !o[k] }));
  };
  const presetOn = (k: PresetKey) => PRESETS[k].main.every((x) => on[x]);
  // A chip switches its sources on with example amounts (kept if you already typed something), or off together with their amounts.
  const togglePreset = (k: PresetKey) => {
    const g = PRESETS[k];
    if (presetOn(k)) {
      setOn((o) => ({ ...o, ...Object.fromEntries(g.all.map((x) => [x, false])) }));
      return;
    }
    setOn((o) => ({ ...o, ...Object.fromEntries(g.main.map((x) => [x, true])) }));
    setVals((v) => {
      const next = { ...v };
      for (const [key, example] of Object.entries(g.vals)) if (!next[key as keyof Vals]) next[key as keyof Vals] = example as string;
      return next;
    });
  };
  const clearAll = () => {
    setOn(NO_SOURCES);
    setVals(EMPTY_VALS);
    setMainHome(false);
    setPensionS1(false);
    setExemption("none");
    setStatus("single");
    setChildren(0);
  };

  const input: InvestorInput = useMemo(
    () => ({
      ...emptyInvestorInput(),
      domiciled,
      companyProfit: on.company ? num(vals.companyProfit) : 0,
      companySalary: on.company ? num(vals.companySalary) : 0,
      companyDividend: on.company ? num(vals.companyDividend) : 0,
      dividends: on.dividends ? num(vals.dividends) : 0,
      interest: on.interest ? num(vals.interest) : 0,
      propertyGain: on.property ? num(vals.propertyGain) : 0,
      propertyMainHome: on.property && mainHome,
      cryptoGain: on.crypto ? num(vals.cryptoGain) : 0,
      foreignPension: on.pension ? num(vals.pension) : 0,
      pensionHasS1: on.pension && pensionS1,
      selfEmployed: on.selfEmployed ? num(vals.selfEmployed) : 0,
      employment: on.employment ? num(vals.employment) : 0,
      exemption: on.employment ? exemption : "none",
      status,
      spouseIncome: num(vals.spouseIncome),
      children,
      homeInterestOrRent: num(vals.homeInterestOrRent),
      disasterInsurance: num(vals.disasterInsurance),
      energyOrEv: num(vals.energyOrEv),
      otherDeductions: num(vals.otherDeductions),
    }),
    [domiciled, on, vals, mainHome, pensionS1, exemption, status, children],
  );
  const res = useMemo(() => computeInvestorTax(input), [input]);
  const has = res.pool > 0;
  const p = res.personal;

  // The mobile summary bar shows while the result is out of view.
  const resultRef = useRef<HTMLDivElement>(null);
  const [resultVisible, setResultVisible] = useState(true);
  useEffect(() => {
    const el = resultRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setResultVisible(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const money = (k: keyof Vals, label: string, hint?: string) => (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.inputWrap}>
        <span className={styles.cur} aria-hidden>€</span>
        <input
          className={styles.input}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={vals[k] ? nf.format(num(vals[k])) : ""}
          onChange={setVal(k)}
          placeholder="0"
        />
      </span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );

  const srcFields = (k: SourceKey): React.ReactNode => {
    switch (k) {
      case "company":
        return (
          <>
            {money("companyProfit", t.fields.companyProfit, t.fields.companyProfitHint)}
            {money("companySalary", t.fields.companySalary, t.fields.companySalaryHint)}
            {money("companyDividend", t.fields.companyDividend, t.fields.companyDividendHint)}
          </>
        );
      case "dividends": return money("dividends", t.fields.dividends);
      case "interest": return money("interest", t.fields.interest);
      case "property":
        return (
          <>
            {money("propertyGain", t.fields.propertyGain, t.fields.propertyGainHint)}
            <label className={styles.check}>
              <input type="checkbox" checked={mainHome} onChange={(e) => setMainHome(e.target.checked)} />
              <span>{t.fields.propertyMainHome}</span>
            </label>
          </>
        );
      case "crypto": return money("cryptoGain", t.fields.cryptoGain, t.fields.cryptoGainHint);
      case "pension":
        return (
          <>
            {money("pension", t.fields.pension)}
            <label className={styles.check}>
              <input type="checkbox" checked={pensionS1} onChange={(e) => setPensionS1(e.target.checked)} />
              <span>{t.fields.pensionS1}</span>
            </label>
          </>
        );
      case "selfEmployed": return money("selfEmployed", t.fields.selfEmployed);
      case "employment":
        return (
          <>
            {money("employment", t.fields.employment)}
            <label className={styles.field}>
              <span className={styles.label}>{t.fields.exemption}</span>
              <select className={styles.select} value={exemption} onChange={(e) => setExemption(e.target.value as Exemption)}>
                {(["none", "half", "fifth", "quarter"] as Exemption[]).map((x) => (
                  <option key={x} value={x}>{t.exemption[x]}</option>
                ))}
              </select>
              <span className={styles.hint}>{t.fields.exemptionHint}</span>
            </label>
          </>
        );
    }
  };

  // Result lines that are not zero, in the order a reader follows the money.
  const lines: { label: string; value: number }[] = [
    { label: t.lines.corporate, value: res.company.corporateTax },
    { label: t.lines.employerCharges, value: res.company.employerCharges },
    { label: t.lines.incomeTax, value: p.incomeTax },
    { label: t.lines.social, value: p.socialInsurance },
    { label: t.lines.hrda, value: p.hrda },
    { label: t.lines.ghs, value: p.ghs },
    { label: t.lines.sdc, value: p.sdc },
    { label: t.lines.property, value: res.propertyTax },
    { label: t.lines.crypto, value: res.cryptoTax },
  ].filter((l) => l.value > 0.5);

  const insights: string[] = [];
  if (res.domicileDelta > 0.5) insights.push((domiciled ? t.insights.dom : t.insights.nonDom).replace("{x}", nf.format(Math.round(res.domicileDelta))));
  if (input.foreignPension > 0) insights.push(p.pension.elected ? t.insights.pensionElected : t.insights.pensionNormal);
  if (res.company.dividendCapped) insights.push(t.insights.dividendCapped.replace("{x}", nf.format(Math.round(res.company.dividendPaid))));
  if (input.propertyGain > 0 && res.propertyTax < 0.5) insights.push(t.insights.propertyExempt);
  const askedFamily = children > 0 || input.homeInterestOrRent > 0 || input.disasterInsurance > 0 || input.energyOrEv > 0;
  if (askedFamily && !p.familyDeductionsApplied && p.familyIncome > p.familyCeiling) insights.push(t.insights.familyOff);
  if (p.deductions.otherDisallowed > 0.5) insights.push(t.insights.otherCapped);

  const keptShare = has ? Math.max(0, res.keptPersonally) / res.pool : 0;
  const retainedShare = has ? Math.max(0, res.retained) / res.pool : 0;
  const burdenShare = has ? Math.max(0, res.totalBurden) / res.pool : 0;
  const showCompany = res.company.on;
  const activeCount = ORDER.filter((k) => on[k]).length;

  return (
    <section className={styles.calc} aria-label={title || t.title}>
      <header className={styles.head}>
        <h2 className={styles.title}>{title || t.title}</h2>
        <p className={styles.lead}>{t.lead}</p>
      </header>

      <div className={styles.presets} role="group" aria-label={t.startFrom}>
        <span className={styles.presetsLabel}>{t.startFrom}</span>
        <div className={styles.chips}>
          {PRESET_KEYS.map((k) => (
            <button key={k} type="button" className={`${styles.chip} ${presetOn(k) ? styles.chipOn : ""}`} aria-pressed={presetOn(k)} onClick={() => togglePreset(k)}>
              {t.presets[k]}
            </button>
          ))}
        </div>
        <div className={styles.presetsFoot}>
          <span className={styles.count}>{activeCount > 0 ? t.sourcesOn.replace("{n}", String(activeCount)) : ""}</span>
          <button type="button" className={styles.linkBtn} onClick={clearAll}>{t.clear}</button>
        </div>
      </div>

      <div className={styles.grid}>
        <form className={styles.form} onSubmit={(e) => e.preventDefault()} noValidate>
          <div className={styles.block}>
            <h3 className={styles.blockTitle}><i>1</i>{t.statusHeading}</h3>
            <div className={styles.statusGrid} role="radiogroup" aria-label={t.statusHeading}>
              {([false, true] as boolean[]).map((d) => {
                const o = d ? t.statusOptions.dom : t.statusOptions.nonDom;
                return (
                  <button key={String(d)} type="button" role="radio" aria-checked={domiciled === d} className={`${styles.statusCard} ${domiciled === d ? styles.statusOn : ""}`} onClick={() => setDomiciled(d)}>
                    <span className={styles.statusTitle}>{o.title}</span>
                    <span className={styles.statusText}>{o.text}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.block}>
            <h3 className={styles.blockTitle}><i>2</i>{t.incomeHeading}</h3>
            <p className={styles.blockHint}>{t.incomeHint}</p>
            <div className={styles.sources}>
              {ORDER.map((k) => {
                const open = on[k];
                const id = `src-${k}`;
                return (
                  <div key={k} className={`${styles.source} ${open ? styles.sourceOn : ""}`}>
                    <button type="button" className={styles.sourceHead} role="switch" aria-checked={open} aria-controls={id} onClick={() => toggle(k)}>
                      <span className={styles.sourceText}>
                        <span className={styles.sourceTitle}>{t.sources[k].title}</span>
                        <span className={styles.sourceHint}>{t.sources[k].hint}</span>
                      </span>
                      <span className={styles.switch} aria-hidden><span className={styles.knob} /></span>
                    </button>
                    <Collapse open={open} id={id}>
                      <div className={styles.sourceBody}>{srcFields(k)}</div>
                    </Collapse>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.block}>
            <Section title={t.familyHeading} badge="3">
              <p className={styles.hint}>{t.familyHint}</p>
              <label className={styles.field}>
                <span className={styles.label}>{t.statusLabel}</span>
                <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                  {(["single", "singleParent", "married"] as Status[]).map((x) => (
                    <option key={x} value={x}>{t.status[x]}</option>
                  ))}
                </select>
              </label>
              <Collapse open={status === "married"}>
                <div className={styles.inner}>{money("spouseIncome", t.spouseIncome)}</div>
              </Collapse>
              <label className={styles.field}>
                <span className={styles.label}>{t.children}</span>
                <select className={styles.select} value={children} onChange={(e) => setChildren(Number(e.target.value))}>
                  {Array.from({ length: 9 }, (_, n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              {money("homeInterestOrRent", t.homeInterest)}
              {money("disasterInsurance", t.disasterInsurance)}
              {money("energyOrEv", t.energyEv)}
              {money("otherDeductions", t.otherDeductions)}
            </Section>
          </div>
        </form>

        <div className={styles.result} ref={resultRef} aria-live="polite">
          <h3 className={styles.resultTitle}>{t.resultHeading}</h3>
          {!has ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>{t.empty}</p>
              <p className={styles.emptyHint}>{t.emptyHint}</p>
            </div>
          ) : (
            <>
              <div className={styles.keep}>
                <div className={styles.keepLabel}>{t.keepYear}</div>
                <div className={styles.keepBig}>{eur(res.keptPersonally)}</div>
                <div className={styles.keepMonth}>{eur(res.keptPersonally / 12)} {t.keepMonth}</div>
              </div>

              <div className={styles.tiles}>
                {showCompany && (
                  <div className={styles.tile}>
                    <div className={styles.tileLabel}>{t.retainedTitle}</div>
                    <div className={styles.tileValue}>{eur(res.retained)}</div>
                  </div>
                )}
                <div className={styles.tile}>
                  <div className={styles.tileLabel}>{t.burdenTitle}</div>
                  <div className={styles.tileValue}>{eur(res.totalBurden)}</div>
                  <div className={styles.tileSub}>{pct(res.effectiveRate)} {t.ofPool}</div>
                </div>
              </div>

              <div className={styles.bar} role="img" aria-label={`${t.barKept} ${pct(keptShare)}, ${t.barRetained} ${pct(retainedShare)}, ${t.barBurden} ${pct(burdenShare)}`}>
                <span className={styles.barKept} style={{ width: `${keptShare * 100}%` }} />
                {showCompany && <span className={styles.barRetained} style={{ width: `${retainedShare * 100}%` }} />}
                <span className={styles.barBurden} style={{ width: `${burdenShare * 100}%` }} />
              </div>
              <ul className={styles.legend}>
                <li><i className={styles.dotKept} />{t.barKept} {pct(keptShare)}</li>
                {showCompany && <li><i className={styles.dotRetained} />{t.barRetained} {pct(retainedShare)}</li>}
                <li><i className={styles.dotBurden} />{t.barBurden} {pct(burdenShare)}</li>
              </ul>

              {insights.length > 0 && (
                <ul className={styles.insights}>
                  {insights.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              )}

              {lines.length > 0 && (
                <>
                  <h4 className={styles.subTitle}>{t.breakdownHeading}</h4>
                  <table className={styles.table}>
                    <tbody>
                      {lines.map((l) => (
                        <tr key={l.label}><th scope="row">{l.label}</th><td>{eur(l.value)}</td></tr>
                      ))}
                      <tr className={styles.total}><th scope="row">{t.burdenTitle}</th><td>{eur(res.totalBurden)}</td></tr>
                    </tbody>
                  </table>
                </>
              )}

              {showCompany && (
                <div className={styles.dark}>
                  <Section title={t.companyHeading}>
                    <table className={styles.table}>
                      <tbody>
                        <tr><th scope="row">{t.companyLines.profit}</th><td>{eur(res.company.profit)}</td></tr>
                        <tr><th scope="row">{t.companyLines.salary}</th><td>{eur(res.company.salary)}</td></tr>
                        <tr><th scope="row">{t.companyLines.charges}</th><td>{eur(res.company.employerCharges)}</td></tr>
                        <tr><th scope="row">{t.companyLines.corporateTax}</th><td>{eur(res.company.corporateTax)}</td></tr>
                        <tr><th scope="row">{t.companyLines.afterTax}</th><td>{eur(res.company.afterTax)}</td></tr>
                        <tr><th scope="row">{t.companyLines.dividend}</th><td>{eur(res.company.dividendPaid)}</td></tr>
                        <tr className={styles.total}><th scope="row">{t.companyLines.retained}</th><td>{eur(res.company.retained)}</td></tr>
                      </tbody>
                    </table>
                  </Section>
                </div>
              )}

              {p.bands.some((b) => b.amount > 0) && (
                <div className={styles.dark}>
                  <Section title={t.bandsHeading}>
                    <table className={styles.table}>
                      <thead>
                        <tr><th>{t.bandCols.band}</th><th>{t.bandCols.rate}</th><th>{t.bandCols.income}</th><th>{t.bandCols.tax}</th></tr>
                      </thead>
                      <tbody>
                        {p.bands.filter((b) => b.amount > 0).map((b) => (
                          <tr key={b.from}>
                            <th scope="row">{Number.isFinite(b.upTo) ? `${eur(b.from)} – ${eur(b.upTo)}` : `${t.above} ${eur(b.from)}`}</th>
                            <td>{pct(b.rate)}</td>
                            <td>{eur(b.amount)}</td>
                            <td>{eur(b.tax)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Section>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className={styles.notes}>
        <Section title={t.notesHeading}>
          <ul className={styles.noteList}>
            {t.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </Section>
      </div>
      <p className={styles.disclaimer}>
        {t.disclaimer}
        {guideHref && (<> {t.guideLead} <a href={guideHref}>{guideLabel || guideHref}</a></>)}
      </p>

      {has && (
        <button
          type="button"
          className={`${styles.sticky} ${!resultVisible ? styles.stickyOn : ""}`}
          aria-hidden={resultVisible}
          tabIndex={resultVisible ? -1 : 0}
          onClick={() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <span className={styles.stickyLabel}>{t.keepYear}</span>
          <span className={styles.stickyValue}>{eur(res.keptPersonally)}</span>
          <span className={styles.stickyGo}>{t.seeResult}</span>
        </button>
      )}
    </section>
  );
}
