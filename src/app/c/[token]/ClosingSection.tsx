"use client";

import { useLayoutEffect, useRef } from "react";
import type { PLocale } from "./copy";
import { COPY } from "./copy";
import AdvisorPhotoBlock from "./AdvisorPhotoBlock";
import { gsap, ScrollTrigger, safeReveal, focusRevealVars, deepFadeVars, isMobileViewport } from "./anim";

const COMPANY_SITE = "cyprusvipestates.com";

// Cyprus mobile numbers store as "+357XXXXXXXX" or with stray spacing from
// manual entry — always re-render as "+357 XX XXX XXX" for display.
function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("357") && digits.length === 11) {
    return `+357 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
  }
  return raw;
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1v3.6c0 .6-.4 1-1 1C10.6 21.1 2.9 13.4 2.9 3.7c0-.6.4-1 1-1H7.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8Z" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <path d="M3 6.5 12 13l9-6.5" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9s1.3-6.5 3.8-9Z" />
    </svg>
  );
}

export default function ClosingSection({
  advisor, locale,
}: {
  advisor: {
    name: string;
    avatar: string | null;
    photoPng: string | null;
    whatsappPhone: string | null; // company WhatsApp number — powers the existing contact buttons, unchanged
    personalPhone: string | null; // the advisor's OWN number — shown in the contact list below the buttons
    email: string | null;
  } | null;
  locale: PLocale;
}) {
  const c = COPY[locale];
  const waHref = advisor?.whatsappPhone ? `https://wa.me/${advisor.whatsappPhone.replace(/[^\d+]/g, "").replace(/^\+/, "")}?text=${encodeURIComponent(c.whatsappMessage)}` : null;
  const telHref = advisor?.whatsappPhone ? `tel:${advisor.whatsappPhone.replace(/[^\d+]/g, "")}` : null;
  const mailHref = advisor?.email ? `mailto:${advisor.email}` : null;
  const personalTelHref = advisor?.personalPhone ? `tel:${advisor.personalPhone.replace(/[^\d+]/g, "")}` : null;
  const rootRef = useRef<HTMLElement>(null);

  // Photo fades in first, then the text column's elements focus-reveal in
  // with a short stagger — both gated behind one scroll trigger for the
  // whole section.
  useLayoutEffect(() => {
    return safeReveal(rootRef.current, (root, track) => {
      const mobile = isMobileViewport();
      const photo = root.querySelector<HTMLElement>(".cp-closing__photocol");
      const textEls = root.querySelectorAll<HTMLElement>(
        ".cp-closing__eyebrow, .cp-closing__name, .cp-closing__title, .cp-closing__trust, .cp-closing__actions, .cp-closing__contactlist"
      );
      const tl = gsap.timeline({ paused: true });
      if (photo) {
        const { from, to } = deepFadeVars(mobile);
        gsap.set(track(photo), from);
        tl.to(photo, to, 0);
      }
      if (textEls.length) {
        const { from, to } = focusRevealVars(mobile);
        gsap.set(track(textEls), from);
        tl.to(textEls, { ...to, stagger: 0.1 }, 0.4);
      }
      ScrollTrigger.create({ trigger: root, start: "top 85%", once: true, onEnter: () => tl.play() });
    });
  }, []);

  return (
    <section className="cp-closing" ref={rootRef}>
      <div className="cp-closing__inner">
        <div className="cp-closing__grid">
          <AdvisorPhotoBlock
            src={advisor?.photoPng || advisor?.avatar || "/uploads/images/862e62ebddfc232ff9838efb63eb28685b515eb4-400x208.png"}
            isPhoto={!!advisor?.photoPng}
          />
          <div className="cp-closing__textcol">
            <p className="eyebrow cp-closing__eyebrow">{c.closingEyebrow}</p>
            <p className="cp-closing__name">{advisor?.name || "Cyprus VIP Estates"}</p>
            <p className="cp-closing__title">{c.advisorTitle}</p>
            <p className="cp-closing__trust">{c.closingTrust}</p>
            <div className="cp-closing__actions">
              {waHref && <a href={waHref} target="_blank" rel="noopener noreferrer" className="cp-closing__btn cp-closing__btn--whatsapp">{c.whatsapp}</a>}
              {telHref && <a href={telHref} className="cp-closing__btn">{c.call}</a>}
              {mailHref && <a href={mailHref} className="cp-closing__btn">{c.email}</a>}
            </div>
            <ul className="cp-closing__contactlist">
              {personalTelHref && advisor?.personalPhone && (
                <li>
                  <a href={personalTelHref} className="cp-closing__contactlink">
                    <PhoneIcon />
                    <span>{formatPhoneDisplay(advisor.personalPhone)}</span>
                  </a>
                </li>
              )}
              {mailHref && advisor?.email && (
                <li>
                  <a href={mailHref} className="cp-closing__contactlink">
                    <MailIcon />
                    <span>{advisor.email}</span>
                  </a>
                </li>
              )}
              <li>
                <a href={`https://${COMPANY_SITE}`} target="_blank" rel="noopener noreferrer" className="cp-closing__contactlink">
                  <GlobeIcon />
                  <span>{COMPANY_SITE}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
        <p className="cp-closing__legal">
          {c.legal} <a href="/privacy-policy">{c.privacyPolicy}</a>
        </p>
      </div>
    </section>
  );
}
