"use client";

import { FC, useId, useState } from "react";
import axios from "axios";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import Link from "next/link";

type Lang = "en" | "de" | "pl" | "ru";

interface Props {
  lang: string;
  projectSlug?: string;
  projectTitle?: string;
}

const T: Record<Lang, Record<string, string>> = {
  en: { heading: "Request a consultation", firstName: "First name", lastName: "Last name", email: "Email", phone: "Phone", nationality: "Nationality", budget: "Budget range", timeline: "Timeline", financing: "Financing", propertyType: "Property interest", message: "Message (optional)", consent: "I agree to the", privacy: "privacy policy", submit: "Send request", sending: "Sending…", success: "Thank you — we have received your request and will contact you shortly.", error: "Something went wrong. Please try again or contact us directly.", required: "Please complete the required fields.", choose: "Please choose…" },
  de: { heading: "Beratung anfragen", firstName: "Vorname", lastName: "Nachname", email: "E-Mail", phone: "Telefon", nationality: "Nationalität", budget: "Budget", timeline: "Zeitrahmen", financing: "Finanzierung", propertyType: "Interesse", message: "Nachricht (optional)", consent: "Ich stimme der", privacy: "Datenschutzrichtlinie zu", submit: "Anfrage senden", sending: "Senden…", success: "Vielen Dank — wir haben Ihre Anfrage erhalten und melden uns in Kürze.", error: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.", required: "Bitte füllen Sie die Pflichtfelder aus.", choose: "Bitte wählen…" },
  pl: { heading: "Zamów konsultację", firstName: "Imię", lastName: "Nazwisko", email: "E-mail", phone: "Telefon", nationality: "Narodowość", budget: "Budżet", timeline: "Termin", financing: "Finansowanie", propertyType: "Zainteresowanie", message: "Wiadomość (opcjonalnie)", consent: "Akceptuję", privacy: "politykę prywatności", submit: "Wyślij zapytanie", sending: "Wysyłanie…", success: "Dziękujemy — otrzymaliśmy Twoje zapytanie i wkrótce się skontaktujemy.", error: "Coś poszło nie tak. Spróbuj ponownie.", required: "Uzupełnij wymagane pola.", choose: "Wybierz…" },
  ru: { heading: "Запросить консультацию", firstName: "Имя", lastName: "Фамилия", email: "Email", phone: "Телефон", nationality: "Гражданство", budget: "Бюджет", timeline: "Сроки", financing: "Финансирование", propertyType: "Интерес", message: "Сообщение (необязательно)", consent: "Я согласен с", privacy: "политикой конфиденциальности", submit: "Отправить", sending: "Отправка…", success: "Спасибо — мы получили вашу заявку и свяжемся с вами в ближайшее время.", error: "Что-то пошло не так. Попробуйте ещё раз.", required: "Пожалуйста, заполните обязательные поля.", choose: "Выберите…" },
};

const NATIONALITIES = ["German", "British", "Polish", "Russian", "Ukrainian", "Other"];
const BUDGETS = [
  { v: "0-200000", l: "Under €200k" },
  { v: "200000-500000", l: "€200k – €500k" },
  { v: "500000-1000000", l: "€500k – €1M" },
  { v: "1000000-2000000", l: "€1M – €2M" },
  { v: "2000000-", l: "€2M+" },
];
const TIMELINES = [
  { v: "now", l: "Ready to buy now" },
  { v: "3m", l: "Within 3 months" },
  { v: "6m", l: "Within 6 months" },
  { v: "1y", l: "Within 1 year" },
  { v: "exploring", l: "Just exploring" },
];
const FINANCING = [
  { v: "cash", l: "Cash purchase" },
  { v: "mortgage", l: "Mortgage" },
  { v: "undecided", l: "Undecided" },
];
const PROP_TYPES = ["Apartment", "Villa", "Townhouse", "Penthouse"];

const field = "w-full rounded-none border border-[#C8C0B4] bg-white px-3 py-2.5 text-[15px] text-[#1A1A1A] outline-none focus:border-[#C29A5E] transition-colors";
const label = "block text-[13px] tracking-wide text-[#2C2C2C] mb-1.5";

const QualificationForm: FC<Props> = ({ lang, projectSlug, projectTitle }) => {
  const uid = useId();
  const t = T[(["en", "de", "pl", "ru"].includes(lang) ? lang : "en") as Lang];
  const [formStartTime] = useState(() => Date.now());
  const [phone, setPhone] = useState<string | undefined>();
  const [types, setTypes] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const toggleType = (tp: string) =>
    setTypes((p) => (p.includes(tp) ? p.filter((x) => x !== tp) : [...p, tp]));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    const firstName = get("name");
    const email = get("email");
    if (!firstName || !email || !phone || fd.get("agreedToPolicy") !== "on") {
      setStatus("err"); setErrMsg(t.required); return;
    }
    setStatus("sending"); setErrMsg(null);
    try {
      const parsed = parsePhoneNumberFromString(phone || "");
      const res = await axios.post("/api/leads", {
        name: firstName,
        surname: get("surname"),
        email,
        phone: parsed?.number || phone,
        nationality: get("nationality"),
        budget: get("budget"),
        timeline: get("timeline"),
        financing: get("financing"),
        propertyTypeInterest: types,
        message: get("message"),
        agreedToPolicy: true,
        company: get("company"), // honeypot
        formStartTime,
        currentPage: typeof window !== "undefined" ? window.location.href : "",
        projectSlug: projectSlug ?? "",
        lang,
      });
      if (res.status === 200 && res.data?.ok) {
        setStatus("ok");
        if (typeof window !== "undefined" && (window as any).fbq) (window as any).fbq("track", "Lead", { form_name: "qualification" });
      } else { setStatus("err"); setErrMsg(t.error); }
    } catch { setStatus("err"); setErrMsg(t.error); }
  }

  if (status === "ok") {
    return (
      <div className="bg-[#F5F1E8] border border-[#E0DAD0] p-8 text-center">
        <p className="text-[#1B4B43] text-lg" style={{ fontFamily: "var(--font-display, Georgia), serif" }}>{t.success}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="bg-white border border-[#E0DAD0] p-6 md:p-8 space-y-5">
      <h3 className="text-[#142E2D] text-2xl" style={{ fontFamily: "var(--font-display, Georgia), serif", fontWeight: 400 }}>
        {projectTitle ? `${t.heading} — ${projectTitle}` : t.heading}
      </h3>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor={`${uid}-n`}>{t.firstName} *</label>
          <input id={`${uid}-n`} name="name" required className={field} />
        </div>
        <div>
          <label className={label} htmlFor={`${uid}-s`}>{t.lastName}</label>
          <input id={`${uid}-s`} name="surname" className={field} />
        </div>
        <div>
          <label className={label} htmlFor={`${uid}-e`}>{t.email} *</label>
          <input id={`${uid}-e`} name="email" type="email" required className={field} />
        </div>
        <div>
          <label className={label}>{t.phone} *</label>
          <div className="border border-[#C8C0B4] bg-white px-3 py-2.5 focus-within:border-[#C29A5E]">
            <PhoneInput international defaultCountry="CY" value={phone} onChange={setPhone} className="cvp-phone" />
          </div>
        </div>
        <div>
          <label className={label} htmlFor={`${uid}-nat`}>{t.nationality}</label>
          <select id={`${uid}-nat`} name="nationality" defaultValue="" className={field}>
            <option value="">{t.choose}</option>
            {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor={`${uid}-b`}>{t.budget}</label>
          <select id={`${uid}-b`} name="budget" defaultValue="" className={field}>
            <option value="">{t.choose}</option>
            {BUDGETS.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor={`${uid}-tl`}>{t.timeline}</label>
          <select id={`${uid}-tl`} name="timeline" defaultValue="" className={field}>
            <option value="">{t.choose}</option>
            {TIMELINES.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>{t.financing}</label>
          <div className="flex gap-4 pt-2">
            {FINANCING.map((f) => (
              <label key={f.v} className="flex items-center gap-1.5 text-[14px] text-[#2C2C2C]">
                <input type="radio" name="financing" value={f.v} /> {f.l}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className={label}>{t.propertyType}</label>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {PROP_TYPES.map((tp) => (
            <label key={tp} className="flex items-center gap-1.5 text-[14px] text-[#2C2C2C]">
              <input type="checkbox" checked={types.includes(tp)} onChange={() => toggleType(tp)} /> {tp}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className={label} htmlFor={`${uid}-m`}>{t.message}</label>
        <textarea id={`${uid}-m`} name="message" rows={3} className={field} />
      </div>

      {/* honeypot */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <label className="flex items-start gap-2 text-[13px] text-[#6B6B6B]">
        <input type="checkbox" name="agreedToPolicy" required className="mt-0.5" />
        <span>{t.consent} <Link href={`/${lang}/datenschutzrichtlinie`} className="text-[#1B4B43] underline">{t.privacy}</Link> *</span>
      </label>

      {status === "err" && errMsg && <p className="text-[14px] text-[#C0392B]">{errMsg}</p>}

      <button type="submit" disabled={status === "sending"}
        className="bg-[#142E2D] text-white text-[13px] tracking-[0.12em] uppercase px-8 py-3.5 hover:bg-[#1B4B43] transition-colors disabled:opacity-60">
        {status === "sending" ? t.sending : t.submit}
      </button>
    </form>
  );
};

export default QualificationForm;
