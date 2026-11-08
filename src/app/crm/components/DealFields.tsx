"use client";
import { useEffect, useState } from "react";
import { parseEuroPrice } from "@/lib/crm/parseEuroPrice";
import { normalizeDealInput, parseRateText, type DealInput } from "@/lib/crm/dealInput";
import { searchDevelopersAction, searchDevelopmentsAction, typedDealNamesAction, type DealOption } from "../actions";

// Deal fields (2026-11-08), used by "New deal" and by the move to Reserved/Closed.
// Developer and project: pick one of ours, or keep the typed text — no extra
// switch. A project of ours fills in its developer. Names typed on earlier
// deals are offered too, so one developer is not spelled two ways.

type Picked = { id: string; name: string } | null;

function useOptions(load: () => Promise<DealOption[]>, deps: unknown[], skip: boolean) {
  const [options, setOptions] = useState<DealOption[]>([]);
  useEffect(() => {
    if (skip) return;
    let live = true;
    const t = setTimeout(() => { load().then((r) => { if (live) setOptions(r); }).catch(() => { if (live) setOptions([]); }); }, 250);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return options;
}

const typedOptions = async (kind: "developer" | "project", q: string): Promise<DealOption[]> =>
  (await typedDealNamesAction(kind, q)).map((n) => ({ id: "", value: n, label: n, hint: "typed before" }));

function Combo({ id, label, placeholder, q, setQ, picked, onPick, options, autoFocus }: {
  id: string; label: string; placeholder: string; q: string; setQ: (v: string) => void;
  picked: Picked; onPick: (o: DealOption) => void; options: DealOption[]; autoFocus?: boolean;
}) {
  const ours = picked != null && q === picked.name;
  const t = q.trim();
  const exact = options.some((o) => o.value.toLowerCase() === t.toLowerCase());
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} autoComplete="off" autoFocus={autoFocus} maxLength={120} />
      <div className="crm-options" role="listbox" aria-label={label}>
        {ours
          ? <button type="button" role="option" aria-selected="true" className="on">✓ {picked.name}</button>
          : <>
            {options.slice(0, 12).map((o, i) => (
              <button type="button" key={`${o.id}-${i}`} role="option" aria-selected="false" onClick={() => onPick(o)}>
                {o.label}{o.hint && <span className="crm-muted"> · {o.hint}</span>}
              </button>
            ))}
            {t && !exact && <p className="crm-deal-typed">“{t}” is not in our list. It is saved as typed.</p>}
          </>}
      </div>
    </>
  );
}

export function DealFields({ onChange, autoFocus }: { onChange: (deal: DealInput | null, problem: string | null) => void; autoFocus?: boolean }) {
  const [devQ, setDevQ] = useState("");
  const [dev, setDev] = useState<Picked>(null);
  const [projQ, setProjQ] = useState("");
  const [proj, setProj] = useState<Picked>(null);
  const [projRate, setProjRate] = useState<string | null>(null);
  const [devRate, setDevRate] = useState<string | null>(null);
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [rate, setRate] = useState("");

  const devOurs = dev != null && devQ === dev.name;
  const projOurs = proj != null && projQ === proj.name;

  const devOptions = useOptions(async () => {
    const [a, b] = await Promise.all([searchDevelopersAction(devQ), typedOptions("developer", devQ)]);
    return [...a, ...b];
  }, [devQ, devOurs], devOurs);
  const projOptions = useOptions(async () => {
    // A typed developer has no projects of ours: offer earlier typed names only.
    const typedDev = devQ.trim() !== "" && !devOurs;
    const [a, b] = await Promise.all([typedDev ? Promise.resolve([]) : searchDevelopmentsAction(projQ, devOurs ? dev!.id : null), typedOptions("project", projQ)]);
    return [...a, ...b];
  }, [projQ, devOurs, devQ.trim() === ""], projOurs);

  const priceNum = parseEuroPrice(price);
  const rateNum = parseRateText(rate);
  const rateBad = rateNum != null && Number.isNaN(rateNum);
  const onFile = projOurs ? projRate : devOurs ? devRate : null;

  useEffect(() => {
    if (rateBad) { onChange(null, "Rate: a percentage such as 5 or 4.5."); return; }
    const raw = {
      developmentId: projOurs ? proj!.id : null,
      projectName: projOurs ? null : projQ,
      developerAccountId: devOurs ? dev!.id : null,
      developerName: devOurs ? null : devQ,
      unitLabel: unit,
      price: priceNum ?? NaN,
      ratePercent: rateNum,
    };
    const r = normalizeDealInput(raw);
    onChange("ok" in r ? r.ok : null, "ok" in r ? null : r.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devQ, devOurs, projQ, projOurs, unit, priceNum, rateNum, rateBad]);

  return (
    <>
      <Combo id="crm-deal-dev" label="Developer" placeholder="Search our developers or type a name" q={devQ} autoFocus={autoFocus}
        setQ={(v) => { setDevQ(v); }} picked={dev} options={devOptions}
        onPick={(o) => {
          if (o.id) { setDev({ id: o.id, name: o.value }); setDevRate(o.hint ?? null); } else setDev(null);
          setDevQ(o.value);
          // A project of another developer no longer fits.
          if (proj && o.id !== dev?.id) { setProj(null); setProjQ(""); }
        }} />
      <Combo id="crm-deal-proj" label="Project" placeholder={devOurs ? `Search ${dev!.name}'s projects or type a name` : "Search our projects or type a name"}
        q={projQ} setQ={setProjQ} picked={proj} options={projOptions}
        onPick={(o) => {
          if (o.id) {
            setProj({ id: o.id, name: o.value });
            setProjRate(o.hint?.split(" · ").pop() ?? null);
            if (o.developer) { setDev(o.developer); setDevQ(o.developer.name); }
          } else setProj(null);
          setProjQ(o.value);
        }} />
      <label htmlFor="crm-unit">Unit (optional)</label>
      <input id="crm-unit" value={unit} maxLength={40} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. A203" autoComplete="off" />
      <label htmlFor="crm-price">Sale price (EUR)</label>
      <input id="crm-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="412 000" autoComplete="off"
        aria-invalid={price.trim() !== "" && priceNum == null} />
      {price.trim() !== "" && priceNum == null && <p className="crm-dialog-error">Whole euros, e.g. 412 000.</p>}
      <label htmlFor="crm-rate">Our rate % (optional)</label>
      <input id="crm-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} autoComplete="off" aria-invalid={rateBad}
        placeholder={onFile && onFile !== "no rate" ? `On file: ${onFile}` : "No rate on file"} />
      <p className="crm-muted crm-deal-note">
        {rate.trim() ? "The typed rate is used for this deal." : onFile && onFile !== "no rate" ? `Empty uses the rate on file (${onFile}).` : "Empty saves the deal with “rate missing”."}
      </p>
    </>
  );
}
