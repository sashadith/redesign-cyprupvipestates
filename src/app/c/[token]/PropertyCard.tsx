"use client";

import { useState } from "react";
import type { PLocale } from "./copy";
import { COPY, formatUnitsCount } from "./copy";
import ScarcityBanner from "@/app/components/ScarcityBanner/ScarcityBanner";
import { soldOutFromCounts } from "@/lib/developmentAvailability";

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
  mainImage: string | null;
  advisorComment: string | null;
  isFavorited: boolean;
  isNew: boolean;
};

const fmtPrice = (n: number | null, cur: string, prefix: string) =>
  n == null ? null : `${prefix} ${cur === "EUR" ? "€" : cur + " "}${n.toLocaleString("en-US")}`;

export default function PropertyCard({
  token, item, viewDetailsLabel, locale, priceFromLabel, newForYouLabel, onViewDetails,
}: {
  token: string;
  item: PresentationItemVM;
  viewDetailsLabel: string;
  locale: PLocale;
  priceFromLabel: string;
  newForYouLabel: string;
  onViewDetails: () => void;
}) {
  const [favorited, setFavorited] = useState(item.isFavorited);
  const [busy, setBusy] = useState(false);

  async function toggleFavorite() {
    const next = !favorited;
    setFavorited(next); // optimistic
    setBusy(true);
    try {
      const res = await fetch(`/api/c/${token}/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ developmentId: item.developmentId, favorited: next }),
      });
      if (!res.ok) setFavorited(!next); // revert on failure
    } catch {
      setFavorited(!next);
    } finally {
      setBusy(false);
    }
  }

  const soldOut = soldOutFromCounts(item.unitsAvailable, item.unitsTotal);
  const price = fmtPrice(item.priceFrom, item.currency, priceFromLabel);
  // "Paphos · Paphos" when the area override happens to equal the district —
  // show the value once instead of repeating it.
  const district = item.district?.trim() || "";
  const area = item.area?.trim() || "";
  const locationParts = area && district && area.toLowerCase() === district.toLowerCase() ? [district] : [district, area].filter(Boolean);

  return (
    <div id={`cp-card-${item.developmentId}`} className="cp-card cp-goldring cp-goldring--hover" data-fx="card">
      <div className="cp-card__media">
        {item.mainImage ? <img src={item.mainImage} alt={item.publicName} className="cp-card__img" data-fx="cardimg" loading="lazy" /> : <div className="cp-card__img cp-card__img--empty" />}
        <div className="cp-card__badges">
          {item.isNew && <span className="cp-card__newbadge">{newForYouLabel}</span>}
          {soldOut
            ? <span className="cp-card__soldbadge">{COPY[locale].soldOut}</span>
            : <ScarcityBanner available={item.unitsAvailable} total={item.unitsTotal} locale={locale} seedKey={item.developmentId} />}
        </div>
        <button type="button" className={`cp-card__heart${favorited ? " is-on" : ""}`} onClick={toggleFavorite} disabled={busy} aria-pressed={favorited} aria-label="Favorite">
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
        </p>
        {item.advisorComment && <p className="cp-card__note">{item.advisorComment}</p>}
        <button type="button" className="cp-card__cta" onClick={onViewDetails}>{viewDetailsLabel}</button>
      </div>
    </div>
  );
}
