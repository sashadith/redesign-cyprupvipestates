// Public, token-protected booking page (Phase 3) — the lead proposes 2-3
// candidate times here; Sascha confirms one from the admin (see
// src/app/admin/(panel)/crm/[id]/bookingActions.ts + BookingPanel.tsx).
// No locale prefix, same reasoning as /c/[token]: this route sits outside
// [lang], its own layout.tsx provides <html>/<body>. Always noindex.
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { generateAvailableSlots } from "@/lib/booking/slots";
import { formatInZone, CYPRUS_TZ } from "@/lib/booking/timezone";
import { asBLocale, COPY } from "./copy";
import SlotPicker, { type SlotGroup } from "./SlotPicker";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Book a time - Cyprus VIP Estates",
    description: "Schedule a personal appointment.",
    robots: { index: false, follow: false },
  };
}

function Gone({ title, body, contactUs }: { title: string; body: string; contactUs: string }) {
  return (
    <main className="bk-gone">
      <img src="/uploads/images/862e62ebddfc232ff9838efb63eb28685b515eb4-400x208.png" alt="Cyprus VIP Estates" className="bk-gone__logo" />
      <h1>{title}</h1>
      <p>{body}</p>
      <a href="https://cyprusvipestates.com" className="bk-gone__btn">{contactUs}</a>
    </main>
  );
}

function dayLabel(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: CYPRUS_TZ, weekday: "short", day: "2-digit", month: "short" }).format(date);
}

function timeLabel(date: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

export default async function BookingPage({ params }: { params: { token: string } }) {
  const booking = await prisma.bookingRequest.findUnique({
    where: { token: params.token },
    include: { lead: { select: { firstName: true, languagePreference: true } } },
  });

  const locale = asBLocale(booking?.lead.languagePreference);
  const c = COPY[locale];

  const isExpired = !!booking?.expiresAt && booking.expiresAt < new Date();
  if (!booking || isExpired || booking.status === "CANCELLED") {
    return <Gone title={c.goneTitle} body={c.goneBody} contactUs={c.contactUs} />;
  }

  const name = booking.lead.firstName;

  if (booking.status === "CONFIRMED" && booking.confirmedSlotUtc) {
    const dt = formatInZone(booking.confirmedSlotUtc, booking.leadTimezone || CYPRUS_TZ, localeToIntl(locale));
    return (
      <main className="bk-page">
        <img src="/uploads/images/862e62ebddfc232ff9838efb63eb28685b515eb4-400x208.png" alt="Cyprus VIP Estates" className="bk-logo" />
        <div className="bk-hero">
          <p className="bk-hero__eyebrow">{c.eyebrow}</p>
          <h1 className="bk-hero__title">{c.confirmedTitle}</h1>
          <p className="bk-hero__intro">{c.confirmedBody(dt)}</p>
          <p className="bk-hero__intro" style={{ marginTop: "1rem" }}>
            {booking.meetingType === "ZOOM" ? c.confirmedZoomNote : c.confirmedPhoneNote}
          </p>
        </div>
      </main>
    );
  }

  if (booking.status === "PROPOSED") {
    return (
      <main className="bk-page">
        <img src="/uploads/images/862e62ebddfc232ff9838efb63eb28685b515eb4-400x208.png" alt="Cyprus VIP Estates" className="bk-logo" />
        <div className="bk-hero">
          <p className="bk-hero__eyebrow">{c.eyebrow}</p>
          <h1 className="bk-hero__title">{c.alreadyProposedTitle}</h1>
          <p className="bk-hero__intro">{c.alreadyProposedBody}</p>
        </div>
      </main>
    );
  }

  // status === "PENDING" — show the picker.
  const slots = generateAvailableSlots(new Date());
  const groups = new Map<string, SlotGroup>();
  for (const slot of slots) {
    const date = new Date(slot.utc);
    const key = dayLabel(date, localeToIntl(locale));
    if (!groups.has(key)) groups.set(key, { dayLabel: key, slots: [] });
    groups.get(key)!.slots.push({ utc: slot.utc, cyprusLabel: timeLabel(date, CYPRUS_TZ, localeToIntl(locale)) });
  }

  return (
    <main className="bk-page">
      <img src="/uploads/images/862e62ebddfc232ff9838efb63eb28685b515eb4-400x208.png" alt="Cyprus VIP Estates" className="bk-logo" />
      <div className="bk-hero">
        <p className="bk-hero__eyebrow">{c.eyebrow}</p>
        <h1 className="bk-hero__title">{c.title(name)}</h1>
        <p className="bk-hero__intro">{c.intro}</p>
      </div>
      <SlotPicker token={params.token} groups={Array.from(groups.values())} locale={locale} />
    </main>
  );
}

function localeToIntl(locale: ReturnType<typeof asBLocale>): string {
  return { en: "en-GB", de: "de-DE", pl: "pl-PL", ru: "ru-RU" }[locale];
}
