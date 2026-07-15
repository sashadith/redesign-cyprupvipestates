"use client";

import { useState, useCallback, useLayoutEffect, useRef } from "react";
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
};

export default function PresentationBody({
  token, items, locale,
}: {
  token: string;
  items: PresentationDevelopmentVM[];
  locale: PLocale;
}) {
  const c = COPY[locale];
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items.find((i) => i.developmentId === openId) ?? null;
  const cardsWrapRef = useRef<HTMLDivElement>(null);
  const mapSectionRef = useRef<HTMLElement>(null);

  const markers = items.filter((i): i is PresentationDevelopmentVM & { lat: number; lng: number } => i.lat != null && i.lng != null).map((i) => ({
    id: i.developmentId, lat: i.lat, lng: i.lng, name: i.publicName,
    image: i.mainImage, price: i.priceFrom, currency: i.currency,
    location: [i.town, i.district].filter(Boolean).join(" · ") || null,
  }));

  const scrollTo = (id: string) => {
    document.getElementById(`cp-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const openDetails = useCallback((developmentId: string) => {
    setOpenId(developmentId);
    fetch(`/api/c/${token}/view`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ developmentId }) }).catch(() => {});
  }, [token]);

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
              token={token}
              item={item}
              viewDetailsLabel={c.viewDetails}
              locale={locale}
              priceFromLabel={c.priceFrom}
              newForYouLabel={c.newForYou}
              onViewDetails={() => openDetails(item.developmentId)}
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
        locale={locale}
      />
    </>
  );
}
