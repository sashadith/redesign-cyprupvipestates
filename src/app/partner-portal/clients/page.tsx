import Link from "next/link";
import { cookies } from "next/headers";
import {
  CLIENT_FILTERS, CLIENTS_FILTER_COOKIE, COMMISSION_STAGES, DEFAULT_CLIENT_FILTER, cleanQuery, parseClientFilter, type ClientFilter,
} from "@/lib/partner/clientDto";
import { fmt } from "@/lib/partner/i18n";
import { listMyClients } from "@/lib/partner/scope";
import { requirePartner } from "@/lib/partner/session";
import { setClientsFilterAction } from "../clientsActions";
import { Chip, chipTone, dateFmt, eurFmt, tr } from "../components/portalBits";
import { portalContext } from "../portalContext";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PartnerClients({ searchParams }: { searchParams: SP }) {
  const me = await requirePartner({ active: true });
  const { t, locale } = await portalContext();
  const C = t.clients;
  const filter: ClientFilter =
    parseClientFilter(one(searchParams.filter)) ?? parseClientFilter(cookies().get(CLIENTS_FILTER_COOKIE)?.value) ?? DEFAULT_CLIENT_FILTER;
  const q = cleanQuery(one(searchParams.q));
  const pageNo = Number.parseInt(one(searchParams.page) ?? "1", 10);
  const data = await listMyClients(me.partner.id, { filter, q, page: Number.isFinite(pageNo) ? pageNo : 1 });
  const date = dateFmt(locale);
  const eur = eurFmt(locale);
  const label: Record<ClientFilter, string> = { active: C.filterActive, closed: C.filterClosed, lost: C.filterLost, all: C.filterAll };
  const pageHref = (p: number) => {
    const params = new URLSearchParams({ filter, page: String(p) });
    if (q) params.set("q", q);
    return `/clients?${params.toString()}`;
  };
  const nothingYet = data.total === 0 && filter === "all" && !q;

  return (
    <div className="pp-stack pp-stack-wide">
      <section className="pp-card pp-card-wide pp-card-full">
        <h1>{C.title}</h1>
        <div className="pp-toolbar">
          <form action={setClientsFilterAction} className="pp-segment" aria-label={C.filterLabel}>
            {q && <input type="hidden" name="q" value={q} />}
            {CLIENT_FILTERS.map((f) => (
              <button key={f} type="submit" name="filter" value={f} aria-pressed={f === filter} className="pp-segment-btn">
                {label[f]}
              </button>
            ))}
          </form>
          <form method="get" action="/clients" className="pp-searchform" role="search">
            <input type="hidden" name="filter" value={filter} />
            <label className="pp-sr" htmlFor="clients-q">{C.search}</label>
            <input id="clients-q" className="pp-search" type="search" name="q" defaultValue={q} placeholder={C.search} maxLength={100} />
            <button type="submit" className="pp-btn pp-btn-ghost">{C.searchButton}</button>
          </form>
        </div>
      </section>

      {nothingYet ? (
        <section className="pp-panel">
          <p className="pp-muted">{C.empty}</p>
          <p><Link href="/submit" className="pp-btn">{t.nav.submit}</Link></p>
        </section>
      ) : data.items.length === 0 ? (
        <section className="pp-panel"><p className="pp-muted">{C.noMatch}</p></section>
      ) : (
        <section className="pp-panel pp-panel-flush">
          <table className="pp-table">
            <thead>
              <tr>
                <th scope="col">{C.colName}</th>
                <th scope="col">{C.colStage}</th>
                <th scope="col">{C.colContact}</th>
                <th scope="col">{C.colLastUpdate}</th>
                <th scope="col">{C.colCommission}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    <Link href={`/clients/${encodeURIComponent(c.id)}`}>{c.name || "—"}</Link>
                    <span className="pp-cell-sub">{fmt(C.submittedOn, { date: date.format(c.submittedAt) })}</span>
                  </th>
                  <td data-label={C.colStage}><Chip label={tr(locale, c.chipKey)} tone={chipTone(c.chipKey)} /></td>
                  <td data-label={C.colContact}>{c.contactName ?? (c.state === "ACTIVE" ? <span className="pp-muted">—</span> : null)}</td>
                  <td data-label={C.colLastUpdate}>{c.lastUpdateAt ? date.format(c.lastUpdateAt) : null}</td>
                  <td data-label={C.colCommission}>
                    {c.commission &&
                      COMMISSION_STAGES.filter((s) => c.commission![s] > 0).map((s) => (
                        <span key={s} className="pp-cell-money">
                          <span className="pp-figure-sm">{eur.format(c.commission![s])}</span> <span className="pp-cell-sub">{t.commission[s]}</span>
                        </span>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {data.pages > 1 && (
        <nav className="pp-pager" aria-label={fmt(C.page, { page: data.page, pages: data.pages })}>
          {data.page > 1 ? <Link href={pageHref(data.page - 1)} rel="prev">{C.prev}</Link> : <span />}
          <span className="pp-muted">{fmt(C.page, { page: data.page, pages: data.pages })}</span>
          {data.page < data.pages ? <Link href={pageHref(data.page + 1)} rel="next">{C.next}</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
