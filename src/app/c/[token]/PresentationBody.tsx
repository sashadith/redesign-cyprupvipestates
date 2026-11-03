"use client";

import { useState, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import dynamic from "next/dynamic";
import PropertyCard, { type PresentationItemVM } from "./PropertyCard";
import PropertyOverlay, { type OverlayUnit } from "./PropertyOverlay";
import type { PLocale } from "./copy";
import { COPY } from "./copy";
import { gsap, ScrollTrigger, safeReveal, deepFadeVars, isMobileViewport } from "./anim";

// Leaflet touches window at import time — client-only, no SSR.
const PresentationMap = dynamic(() => import("./PresentationMap"), { ssr: false });

export type PresentationDevelopmentVM = PresentationItemVM & {
  lat: number | null;
  lng: number | null;
  description: string;
  amenities: string[];
  gallery: string[];
  units: OverlayUnit[];
  distances: Record<string, number> | null;
};

export default function PresentationBody({
  token, items, locale, partnerMode = false, trackViews = true,
}: {
  token: string;
  items: PresentationDevelopmentVM[];
  locale: PLocale;
  /** Partner-branded presentation (phase 3e): no links to the Cyprus VIP Estates site. Omitted for staff presentations. */
  partnerMode?: boolean;
  /** false = partner preview (?preview=1): opening a property is not recorded as a client view, and hearts are
   *  local-only (never POSTed to /favorite). Omitted (true) for staff presentations. */
  trackViews?: boolean;
}) {
  const c = COPY[locale];
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items.find((i) => i.developmentId === openId) ?? null;
  const cardsWrapRef = useRef<HTMLDivElement>(null);
  const mapSectionRef = useRef<HTMLElement>(null);

  // Lifted here (not per-card local state) so the card's heart button and
  // the overlay's own heart button — same development, two different DOM
  // locations — always agree, whichever one a visitor toggles.
  const [favorites, setFavorites] = useState<Record<string, boolean>>(
    () => Object.fromEntries(items.map((i) => [i.developmentId, i.isFavorited]))
  );
  const [favoriteBusy, setFavoriteBusy] = useState<Record<string, boolean>>({});

  const toggleFavorite = useCallback((developmentId: string) => {
    if (!trackViews) {
      // Partner preview: the heart flips on screen only; nothing is saved to the client's presentation.
      setFavorites((prev) => ({ ...prev, [developmentId]: !prev[developmentId] }));
      return;
    }
    setFavorites((prev) => {
      const next = !prev[developmentId];
      setFavoriteBusy((b) => ({ ...b, [developmentId]: true }));
      fetch(`/api/c/${token}/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ developmentId, favorited: next }),
      })
        .then((res) => { if (!res.ok) setFavorites((f) => ({ ...f, [developmentId]: !next })); })
        .catch(() => setFavorites((f) => ({ ...f, [developmentId]: !next })))
        .finally(() => setFavoriteBusy((b) => ({ ...b, [developmentId]: false })));
      return { ...prev, [developmentId]: next };
    });
  }, [token, trackViews]);

  const markers = items.filter((i): i is PresentationDevelopmentVM & { lat: number; lng: number } => i.lat != null && i.lng != null).map((i) => ({
    id: i.developmentId, lat: i.lat, lng: i.lng, name: i.publicName,
    image: i.mainImage, price: i.priceFrom, currency: i.currency,
    location: [i.town, i.district].filter(Boolean).join(" · ") || null,
  }));

  const scrollTo = (id: string) => {
    document.getElementById(`cp-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // The open overlay's view row: its time on screen is sent back like ViewTracker does for the page,
  // so the CRM's per-project "views · m:ss" (and the hot card's 60-second test) has a real duration.
  // Before 2026-11-03 nothing ever sent it, and every project read 0:00.
  const projectView = useRef<{ start: number; viewId: string | null; pending: Promise<string | null> } | null>(null);

  const sendProjectDuration = useCallback((closing: boolean) => {
    const v = projectView.current;
    if (!v) return;
    if (closing) projectView.current = null;
    const durationSec = Math.round((Date.now() - v.start) / 1000);
    const send = (viewId: string | null) => {
      if (!viewId) return;
      const payload = JSON.stringify({ viewId, durationSec });
      navigator.sendBeacon?.(`/api/c/${token}/view`, new Blob([payload], { type: "application/json" }));
    };
    if (v.viewId) send(v.viewId);
    else v.pending.then(send);
  }, [token]);

  const openDetails = useCallback((developmentId: string) => {
    setOpenId(developmentId);
    if (!trackViews) return;
    sendProjectDuration(true);
    const entry: { start: number; viewId: string | null; pending: Promise<string | null> } = { start: Date.now(), viewId: null, pending: Promise.resolve(null) };
    entry.pending = fetch(`/api/c/${token}/view`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ developmentId }) })
      .then((r) => r.json())
      .then((d) => { entry.viewId = typeof d?.id === "string" ? d.id : null; return entry.viewId; })
      .catch(() => null);
    projectView.current = entry;
  }, [token, trackViews, sendProjectDuration]);

  // Closing the overlay ends the project view; hiding the tab or leaving the page reports the time so far
  // (a later report for the same row overwrites it with the longer figure).
  useEffect(() => { if (openId == null) sendProjectDuration(true); }, [openId, sendProjectDuration]);
  useEffect(() => {
    const onHide = () => sendProjectDuration(false);
    const onVisibility = () => { if (document.visibilityState === "hidden") onHide(); };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sendProjectDuration]);

  // Cards reveal in batches as they scroll into view (ScrollTrigger.batch groups
  // elements that enter around the same time — naturally one grid row at a
  // time), each card's image brightening alongside its own card's fade.
  useLayoutEffect(() => {
    return safeReveal(cardsWrapRef.current, (root, track) => {
      const mobile = isMobileViewport();
      const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-fx="card"]'));
      if (!cards.length) return;
      const { from: cardFrom, to: cardTo } = deepFadeVars(mobile);
      gsap.set(track(cards), cardFrom);
      const imgFrom = { filter: "brightness(0.6)" };
      cards.forEach((card) => {
        const img = card.querySelector<HTMLElement>('[data-fx="cardimg"]');
        if (img) gsap.set(track(img), imgFrom);
      });
      ScrollTrigger.batch(cards, {
        start: "top 88%",
        once: true,
        onEnter: (batch) => {
          gsap.to(batch, { ...cardTo, stagger: 0.12 });
          const imgs = batch.map((el) => el.querySelector<HTMLElement>('[data-fx="cardimg"]')).filter((el): el is HTMLElement => !!el);
          if (imgs.length) gsap.to(imgs, { filter: "brightness(1)", duration: cardTo.duration, ease: cardTo.ease, stagger: 0.12 });
        },
      });
    });
  }, [items.length]);

  useLayoutEffect(() => {
    return safeReveal(mapSectionRef.current, (root, track) => {
      const mobile = isMobileViewport();
      const { from, to } = deepFadeVars(mobile);
      gsap.set(track(root), from);
      ScrollTrigger.create({ trigger: root, start: "top 85%", once: true, onEnter: () => gsap.to(root, to) });
    });
  }, [markers.length]);

  return (
    <>
      <div className="cp-cardswrap" ref={cardsWrapRef}>
        <section className="cp-cards">
          {items.map((item) => (
            <PropertyCard
              key={item.developmentId}
              item={item}
              viewDetailsLabel={c.viewDetails}
              locale={locale}
              priceFromLabel={c.priceFrom}
              newForYouLabel={c.newForYou}
              onViewDetails={() => openDetails(item.developmentId)}
              favorited={favorites[item.developmentId] ?? item.isFavorited}
              favoriteBusy={!!favoriteBusy[item.developmentId]}
              onToggleFavorite={() => toggleFavorite(item.developmentId)}
            />
          ))}
        </section>
      </div>

      {markers.length > 0 && (
        <section className="cp-mapsection" ref={mapSectionRef}>
          <PresentationMap markers={markers} locale={locale} onSelect={scrollTo} />
        </section>
      )}

      <PropertyOverlay
        open={!!open}
        onClose={() => setOpenId(null)}
        publicName={open?.publicName ?? ""}
        gallery={open?.gallery ?? []}
        description={open?.description ?? ""}
        amenities={open?.amenities ?? []}
        units={open?.units ?? []}
        distances={open?.distances ?? null}
        slug={open?.slug ?? null}
        publishStatus={open?.publishStatus ?? null}
        favorited={open ? (favorites[open.developmentId] ?? open.isFavorited) : false}
        favoriteBusy={open ? !!favoriteBusy[open.developmentId] : false}
        onToggleFavorite={() => open && toggleFavorite(open.developmentId)}
        locale={locale}
        partnerMode={partnerMode}
      />
    </>
  );
}
