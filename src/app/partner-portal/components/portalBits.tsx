// Server-rendered building blocks shared by the portal's Overview, My clients and client pages.
import { PARTNER_STEPS } from "@/lib/partner/milestones";
import { fmt, lookup, type PartnerDict, type PartnerLocale } from "@/lib/partner/i18n";
import { COMMISSION_STAGES, type CommissionStage } from "@/lib/partner/clientDto";

/** Dotted dictionary key → text in the locale, placeholders filled; never shows a raw key. */
export function tr(locale: PartnerLocale, key: string, vars?: Record<string, string | number>): string {
  return fmt(lookup(locale, key) ?? lookup("en", key) ?? "", vars);
}

export const dateFmt = (locale: PartnerLocale) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Europe/Nicosia" });
export const eurFmt = (locale: PartnerLocale) =>
  new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const telHref = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;

export type Contact = { name: string | null; email: string | null; phone: string | null };

export function ContactCard({ title, c }: { title: string; c: Contact }) {
  return (
    <section className="pp-panel pp-contact" aria-label={title}>
      <h2 className="pp-h3">{title}</h2>
      {c.name && <p className="pp-contact-name">{c.name}</p>}
      {c.phone && <p><a href={telHref(c.phone)}>{c.phone}</a></p>}
      {c.email && <p><a href={`mailto:${c.email}`}>{c.email}</a></p>}
    </section>
  );
}

/** Stage or claim-state chip. `tone` picks the colour family. */
export function Chip({ label, tone = "stage" }: { label: string; tone?: "stage" | "review" | "closed" | "lost" | "sold" }) {
  return <span className={`pp-state pp-state-${tone}`}>{label}</span>;
}

export function chipTone(chipKey: string): "stage" | "review" | "closed" | "lost" | "sold" {
  if (chipKey === "clients.chipReview") return "review";
  if (chipKey === "clients.chipRejected" || chipKey === "clients.chipExpired" || chipKey === "clients.chipNotProceeding" || chipKey === "stages.lost") return "lost";
  if (chipKey === "stages.sold") return "sold";
  if (chipKey === "stages.onHold") return "closed";
  return "stage";
}

/** The 7-step partner stage bar; `step` null (on hold / lost) shows no current step. */
export function StageBar({ locale, step, label }: { locale: PartnerLocale; step: number | null; label: string }) {
  return (
    <ol className="pp-stagebar" aria-label={label}>
      {PARTNER_STEPS.map((key, i) => {
        const n = i + 1;
        const state = step == null ? "todo" : n < step ? "done" : n === step ? "current" : "todo";
        return (
          <li key={key} className={`pp-stagebar-${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="pp-stagebar-dot" aria-hidden="true" />
            <span className="pp-stagebar-label">{tr(locale, key)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Commission per stage (stages at 0 are listed too) — figures in Fraunces bronze. */
export function CommissionFigures({ t, locale, totals }: { t: PartnerDict; locale: PartnerLocale; totals: Record<CommissionStage, number> }) {
  const eur = eurFmt(locale);
  return (
    <dl className="pp-figures">
      {COMMISSION_STAGES.map((s) => (
        <div key={s}>
          <dt>{t.commission[s]}</dt>
          <dd className="pp-figure">{eur.format(totals[s])}</dd>
        </div>
      ))}
    </dl>
  );
}
