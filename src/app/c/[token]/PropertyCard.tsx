"use client";

import type { PLocale } from "./copy";
import { COPY, formatUnitsCount } from "./copy";
import ScarcityBanner from "@/app/components/ScarcityBanner/ScarcityBanner";
import { soldOutFromCounts } from "@/lib/developmentAvailability";
import { bidiIsolate, ltrIsolate } from "@/lib/locale";
import { hePlaceOrIsolated } from "@/lib/hePlaces";

export type PresentationItemVM = {
  developmentId: string;
  publicName: string;
  town: string | null;
  district: string | null;
  area: string | null;
  vatApplies: boolean | null;
  priceFrom: number | null;
  currency: string;
  unitsAvailable: number;
  unitsTotal: number;
  deliveryQuarter: string | null;
  slug: string | null;
  publishStatus: string;
  mainImage: string | null;
  advisorComment: string | null;
  isFavorited: boolean;
  isNew: boolean;
};

const fmtPrice = (n: number | null, cur: string, prefix: string) =>
  n == null ? null : `${prefix} ${cur === "EUR" ? "€" : cur + " "}${n.toLocaleString("en-US")}`;

export default function PropertyCard({
  item, viewDetailsLabel, locale, priceFromLabel, newForYouLabel, onViewDetails, favorited, favoriteBusy, onToggleFavorite,
}: {
  item: PresentationItemVM;
  viewDetailsLabel: string;
  locale: PLocale;
  priceFromLabel: string;
  newForYouLabel: string;
  onViewDetails: () => void;
  // Favorite state lifted to PresentationBody (2026-08-13) — the same
  // development can be favorited from either the card or the overlay's own
  // heart button, and two independent useState copies would let one go
  // stale the moment the other one's toggled.
  favorited: boolean;
  favoriteBusy: boolean;
  onToggleFavorite: () => void;
}) {
  const soldOut = soldOutFromCounts(item.unitsAvailable, item.unitsTotal);
  const price = fmtPrice(item.priceFrom, item.currency, priceFromLabel);
  // "Paphos · Paphos" when the area override happens to equal the district —
  // show the value once instead of repeating it.
  const district = item.district?.trim() || "";
  const area = item.area?.trim() || "";
  const rawLocationParts = area && district && area.toLowerCase() === district.toLowerCase() ? [district] : [district, area].filter(Boolean);
  // Place names are data, not copy: glossary §1 fixes one Hebrew spelling per
  // place, and anything unknown stays Latin but bidi-isolated (Pass B M17).
  const locationParts = locale === "he" ? rawLocationParts.map(hePlaceOrIsolated) : rawLocationParts;

  return (
    <div
      id={`cp-card-${item.developmentId}`}
      className="cp-card cp-goldring cp-goldring--hover cp-card--clickable"
      data-fx="card"
      role="button"
      tabIndex={0}
      onClick={onViewDetails}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onViewDetails(); } }}
    >
      <div className="cp-card__media">
        {item.mainImage ? <img src={item.mainImage} alt={item.publicName} className="cp-card__img" data-fx="cardimg" loading="lazy" /> : <div className="cp-card__img cp-card__img--empty" />}
        <div className="cp-card__badges">
          {item.isNew && <span className="cp-card__newbadge">{newForYouLabel}</span>}
          {soldOut
            ? <span className="cp-card__soldbadge">{COPY[locale].soldOut}</span>
            : <ScarcityBanner available={item.unitsAvailable} total={item.unitsTotal} locale={locale} seedKey={item.developmentId} />}
        </div>
        <button
          type="button"
          className={`cp-card__heart${favorited ? " is-on" : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          disabled={favoriteBusy}
          aria-pressed={favorited}
          aria-label={COPY[locale].favorite}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill={favorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth={favorited ? "0" : "1.8"}>
            <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733C11.285 4.876 9.623 3.75 7.688 3.75 5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </button>
      </div>
      <div className="cp-card__body">
        <h3 className="cp-card__title">{item.publicName}</h3>
        <p className="cp-card__loc">{locationParts.join(" · ")}</p>
        {price && <p className="cp-card__price">{price}</p>}
        <p className="cp-card__meta">
          <span className="cp-card__vat">{COPY[locale].vatLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{soldOut ? COPY[locale].soldOut : formatUnitsCount(locale, item.unitsAvailable)}</span>
          {item.deliveryQuarter && (
            <>
              <span aria-hidden="true">·</span>
              <span>{COPY[locale].delivery}: {heQuarter(item.deliveryQuarter, locale)}</span>
            </>
          )}
        </p>
        {item.advisorComment && <p className="cp-card__note">{item.advisorComment}</p>}
        <button type="button" className="cp-card__cta" onClick={(e) => { e.stopPropagation(); onViewDetails(); }}>{viewDetailsLabel}</button>
      </div>
    </div>
  );
}

/** toDeliveryQuarter() always yields a Latin "Q3 2027". Styleguide §5 spells
 *  that out in Hebrew as "רבעון 3 2027"; anything that doesn't match the
 *  pattern is passed through bidi-isolated rather than guessed at
 *  (Pass B Should fix #18). No-op for every LTR locale. */
function heQuarter(raw: string, locale: PLocale): string {
  if (locale !== "he") return raw;
  const m = String(raw ?? "").trim().match(/^Q(\d)\s+(\d{4})$/);
  return m ? `רבעון ${ltrIsolate(`${m[1]} ${m[2]}`)}` : bidiIsolate(String(raw ?? ""));
}
