"use client";

import React, { FC, useEffect, useId, useRef, useState } from "react";
import { Formik, Form as FormikForm, Field, ErrorMessage, FormikHelpers, FormikProps } from "formik";
import { emailInvalidText, isValidLeadEmail, phoneInvalidText } from "@/lib/leads/contactEmail";
import * as Yup from "yup";
import dynamic from "next/dynamic";
import { getAttribution } from "@/lib/attribution";
import { qualifierCopy, BUDGET_VALUES, PROPERTY_VALUES, TIMELINE_VALUES, anyTypeLabel, optionalTag, qualifierHeading, shortQualifierLabel } from "@/app/components/qualifierFields";
import { ContactPicker } from "@/app/components/leadForm/ContactPicker";
import { PropertyTypeSelect } from "@/app/components/leadForm/PropertyTypeSelect";
import { consentCopy } from "@/app/components/consentCopy";
import { formCopy } from "./Form.copy";
import "@/app/components/formFeedback.css";
import OptImg from "./OptImg";
import { newMetaEventId } from "@/lib/metaEventId";

/* Phone number input, axios and libphonenumber (~220 KB raw together, 2026-10-19 bundle analysis) used
   to ship with the first load of every page that carries this form — the homepage included — although
   the form sits at the bottom. They now load when the visitor gets near the form, focuses the phone
   field, or submits. Until then the field is a plain input in the same box (same height: no layout shift). */
const PhoneInput = dynamic(() => import("./PhoneInputLazy"), { ssr: false });

/* Contact form — redesign styling. Submission / validation / tracking logic is
   preserved verbatim from the live FormStatic (lead → /api/leads,
   fbq / lintrk / dataLayer, honeypot, attribution). Now multilingual
   (en/de/pl/ru/he) using FormStatic's exact strings, which live in the sibling
   Form.copy.ts; `lang` defaults to "en" so existing EN-only usages
   (preview-home, preview-insights) are unchanged. */

export type FormData = {
  name: string;
  surname: string;
  phone: string;
  email: string;
  preferredContact: string;
  agreedToPolicy: boolean;
  company: string;
  formStartTime: number;
  question: string;
  /* Optional qualifiers, only present when showQualifiers is set. The whole
     values object is spread into the POST body, so these reach /api/leads
     under exactly the names its lookup tables expect. */
  budget: string;
  timeline: string;
  propertyTypeInterest: string[];
};

const CONSULTANT_IMAGE = "/uploads/files/50b0d355d8507f9aadbe785a65e8a7233dd8f2e6.png";

// Every locale gets the animated gold-italic accent on its own natural phrase
// (2026-07-23: de/pl/ru previously rendered plain — only en had it).
const titleNode = (lang: string) => {
  if (lang === "de") return (<>Lassen Sie sich noch heute <span className="it">von uns beraten</span>!</>);
  if (lang === "pl") return (<>Zostaw zapytanie, a my <span className="it">skontaktujemy się z Tobą</span> wkrótce</>);
  if (lang === "ru") return (<>Оставьте заявку и <span className="it">мы свяжемся с вами</span> в ближайшее время</>);
  // REVIEW(he)
  if (lang === "he") return (<>השאירו פרטים <span className="it">ונחזור אליכם</span> בהקדם</>);
  /* Hard break after "and" (Sascha, 2026-10-04): the heading reads as two
     balanced halves instead of one long line that breaks wherever the column
     happens to end. English only — each locale's phrase has its own natural
     seam, and a break copied blindly into another language lands mid-clause. */
  return (<>Leave <span className="it">your details</span> and<br />we will contact you shortly</>);
};

// title/subtitle: optional per-page override of the default heading/copy above
// the fields (e.g. the FAQ page's own "Still have a question?" framing) —
// omit both to get the standard titleNode() heading, unchanged for every
// existing caller.
// showQuestionField: opt-in "Your question" textarea (FAQ page only today) —
// defaults to false, so the field is absent from both the DOM and validation
// for every other existing usage of this shared component.
// showQualifiers: opt-in budget + property-interest fields, both optional.
// Off by default, so the homepage and every other existing usage is untouched;
// switched on where the visitor's intent is concrete enough to answer them
// (project pages today). Filling them is what lets /api/leads run its
// development matching — left empty the lead is stored exactly as before.
// className: extra class on the section, for a page that tunes the layout (the FAQ's larger portrait).
const Form: FC<{ lang?: string; title?: React.ReactNode; subtitle?: React.ReactNode; showQuestionField?: boolean; showQualifiers?: boolean; className?: string }> = ({
  lang = "en", title, subtitle, showQuestionField = false, showQualifiers = false, className,
}) => {
  const t = formCopy(lang);
  const q = qualifierCopy(lang);
  const questionLabel = t.labelQuestion ?? "Your question";
  const questionPlaceholder = t.placeholderQuestion ?? "What would you like to know?";
  const questionRequired = t.vQuestion ?? "Please enter your question";
  const uid = useId();
  const [message, setMessage] = useState<string | null>(null);
  /* The banner shows both outcomes, so it has to know which one — the tick
     it draws is wrong on a failure. */
  const [messageIsError, setMessageIsError] = useState(false);
  const [formStartTime] = useState(() => Date.now());
  const formikRef = useRef<FormikProps<FormData> | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const [phoneArmed, setPhoneArmed] = useState(false);
  const [focusPhone, setFocusPhone] = useState(false);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || phoneArmed) return;
    if (typeof IntersectionObserver === "undefined") { setPhoneArmed(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setPhoneArmed(true); io.disconnect(); }
    }, { rootMargin: "900px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [phoneArmed]);
  /* Per-unit "Enquire about this unit" buttons (project page, UnitsView)
     dispatch a `cve:enquire` event with a ready-made message; the form
     reveals its question field pre-filled and the anchor jump (#enquiry)
     brings it into view. The field is shown, not required (2026-10-03). */
  const [prefilledQuestion, setPrefilledQuestion] = useState(false);
  const [qualsOpen, setQualsOpen] = useState(false);
  useEffect(() => {
    const onEnquire = (e: Event) => {
      const message = (e as CustomEvent<{ message?: string }>).detail?.message;
      if (!message) return;
      setPrefilledQuestion(true);
      formikRef.current?.setFieldValue("question", message);
    };
    window.addEventListener("cve:enquire", onEnquire);
    return () => window.removeEventListener("cve:enquire", onEnquire);
  }, []);

  const initialValues: FormData = {
    name: "", surname: "", phone: "", email: "",
    preferredContact: "", agreedToPolicy: false, company: "", formStartTime, question: "",
    budget: "", timeline: "", propertyTypeInterest: [],
  };

  const validationSchema = Yup.object({
    name: Yup.string().required(t.vName),
    surname: Yup.string().required(t.vSurname),
    // Country code required (2026-11-01). The phone check loads with libphonenumber, late, like the input.
    phone: Yup.string().required(t.vPhone)
      .test("phone-intl", phoneInvalidText(lang) ?? t.vPhone, async (v) => !v || (await import("@/lib/leads/contactPhone")).isValidLeadPhone(v)),
    ...(showQuestionField ? { question: Yup.string().trim().required(questionRequired) } : {}),
    email: Yup.string().email(t.vEmailInvalid).required(t.vEmail)
      .test("email-valid", emailInvalidText(lang) ?? t.vEmailInvalid, (v) => !v || isValidLeadEmail(v)),
    preferredContact: Yup.string().oneOf(["phone", "whatsapp", "email"]).required(t.vContact),
    agreedToPolicy: Yup.boolean().required(t.vConsentReq).oneOf([true], t.vConsentOne),
  });

  const onSubmit = async (values: FormData, { setSubmitting, resetForm }: FormikHelpers<FormData>) => {
    setSubmitting(true);
    try {
      const currentPage = window.location.href;
      const [{ default: axios }, { parsePhoneNumberFromString }] = await Promise.all([import("axios"), import("libphonenumber-js")]);
      const parsedPhone = parsePhoneNumberFromString(values.phone || "");
      const phoneFinal = parsedPhone?.number || values.phone || "";

      // One id for the browser Lead and its server copy — see src/lib/metaCapi.ts.

      const metaEventId = newMetaEventId("lead");

      const response = await axios.post("/api/leads", {
        ...values,
        phone: phoneFinal,
        formStartTime,
        currentPage,
        lang,
        ...getAttribution(),
        metaEventId,
      });

      // A refused lead also answers 200, with ok: false: never show "thank you" for it.
      if (response.status === 200 && response.data?.ok === true) {
        if (typeof window !== "undefined" && window.fbq) {
          window.fbq("track", "Lead", {
            form_name: "form_static",
            page_location: currentPage,
            preferred_contact: values.preferredContact,
          }, { eventID: metaEventId });
        }
        if (typeof window !== "undefined" && typeof (window as any).lintrk === "function") {
          (window as any).lintrk("track", { conversion_id: 27871505 });
        }
        resetForm({});
        if (typeof window !== "undefined" && window.dataLayer) {
          window.dataLayer.push({
            event: "form_submission_success",
            form_name: "form_static",
            page_url: window.location.href,
          });
        }
        setMessageIsError(false);
        setMessage(t.success);
        setTimeout(() => setMessage(null), 10000);
      } else {
        throw new Error("Failed to send lead");
      }
    } catch (error) {
      console.error("Error:", error);
      setMessageIsError(true);
      setMessage(t.error);
      setTimeout(() => setMessage(null), 12000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={`section is-light formsec${className ? ` ${className}` : ""}`} ref={sectionRef}>
      <div className="wrap">
        <div className="formsec__grid">
          <div className="formsec__main">
            <div className="formsec__head">
              <h2 className="formsec__title">{title ?? titleNode(lang)}</h2>
              {subtitle && <p className="formsec__subtitle">{subtitle}</p>}
              <hr className="shimmer formsec__stripe" />
            </div>

            <Formik
              innerRef={(inst) => { formikRef.current = inst; }}
              initialValues={initialValues}
              validationSchema={validationSchema}
              onSubmit={onSubmit}
            >
              {({ isSubmitting, setFieldValue, values }) => (
                <FormikForm className="formsec__form" noValidate>
                  <div className="formsec__fields">
                    <div className="formsec__field">
                      <label className="formsec__label" htmlFor={`${uid}-name`}>{t.labelName}</label>
                      <Field name="name">
                        {({ field }: any) => (
                          <input {...field} id={`${uid}-name`} type="text" autoComplete="given-name" className="formsec__input" />
                        )}
                      </Field>
                      <div className="formsec__errorSlot">
                        <ErrorMessage name="name">
                          {(msg) => <div className="formsec__error">{msg}</div>}
                        </ErrorMessage>
                      </div>
                    </div>

                    <div className="formsec__field">
                      <label className="formsec__label" htmlFor={`${uid}-surname`}>{t.labelSurname}</label>
                      <Field name="surname">
                        {({ field }: any) => (
                          <input {...field} id={`${uid}-surname`} type="text" autoComplete="family-name" className="formsec__input" />
                        )}
                      </Field>
                      <div className="formsec__errorSlot">
                        <ErrorMessage name="surname">
                          {(msg) => <div className="formsec__error">{msg}</div>}
                        </ErrorMessage>
                      </div>
                    </div>

                    <div className="formsec__field formsec__field--wide">
                      <label className="formsec__label" htmlFor={`${uid}-phone`}>{t.labelPhone}</label>
                      {phoneArmed ? (
                        <PhoneInput
                          id={`${uid}-phone`}
                          name="phone"
                          aria-label={t.labelPhone}
                          className="formsec__phone"
                          value={values.phone}
                          defaultCountry="CY"
                          international
                          withCountryCallingCode
                          smartCaret={false}
                          autoComplete="tel"
                          inputMode="tel"
                          type="tel"
                          autoFocus={focusPhone}
                          onChange={(value) => setFieldValue("phone", value || "", false)}
                          onBlur={() => formikRef.current?.setFieldTouched("phone", true, true)}
                        />
                      ) : (
                        <div className="PhoneInput formsec__phone">
                          <input
                            id={`${uid}-phone`}
                            name="phone"
                            aria-label={t.labelPhone}
                            className="PhoneInputInput"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="+357"
                            value={values.phone}
                            readOnly
                            onFocus={() => { setFocusPhone(true); setPhoneArmed(true); }}
                          />
                        </div>
                      )}
                      <div className="formsec__errorSlot">
                        <ErrorMessage name="phone">
                          {(msg) => <div className="formsec__error">{msg}</div>}
                        </ErrorMessage>
                      </div>
                    </div>

                    <div className="formsec__field formsec__field--wide">
                      <label className="formsec__label" htmlFor={`${uid}-email`}>{t.labelEmail}</label>
                      <Field name="email">
                        {({ field }: any) => (
                          <input {...field} id={`${uid}-email`} type="email" autoComplete="email" className="formsec__input" />
                        )}
                      </Field>
                      <div className="formsec__errorSlot">
                        <ErrorMessage name="email">
                          {(msg) => <div className="formsec__error">{msg}</div>}
                        </ErrorMessage>
                      </div>
                    </div>

                    {(showQuestionField || prefilledQuestion) && (
                      <div className="formsec__field formsec__field--full">
                        <label className="formsec__label" htmlFor={`${uid}-question`}>{questionLabel}</label>
                        <Field name="question">
                          {({ field }: any) => (
                            <textarea
                              {...field}
                              id={`${uid}-question`}
                              rows={4}
                              placeholder={questionPlaceholder}
                              className="formsec__input formsec__textarea"
                            />
                          )}
                        </Field>
                        <div className="formsec__errorSlot">
                          <ErrorMessage name="question">
                            {(msg) => <div className="formsec__error">{msg}</div>}
                          </ErrorMessage>
                        </div>
                      </div>
                    )}

                    {/* Contact channel, then the optional qualifiers (compact layout, operator 2026-11-01). */}
                    <div className="formsec__field formsec__field--full">
                      <ContactPicker
                        name="preferredContact" value={values.preferredContact} legend={t.legend}
                        labels={{ phone: t.optPhone, whatsapp: "WhatsApp", email: t.optEmail }}
                        onChange={(v) => setFieldValue("preferredContact", v)}
                        onBlur={() => formikRef.current?.setFieldTouched("preferredContact", true, true)}
                      />
                      <div className="formsec__errorSlot">
                        <ErrorMessage name="preferredContact">
                          {(msg) => <div className="formsec__error">{msg}</div>}
                        </ErrorMessage>
                      </div>
                    </div>

                    {showQualifiers && (() => {
                      /* One heading carries "(optional)" for all three; each label drops it.
                         Without a heading in this language (Hebrew) the full labels stay. */
                      const heading = qualifierHeading(lang);
                      const lab = (l: string) => (heading ? shortQualifierLabel(l) : l);
                      /* Phones: the heading folds the three fields away (closed at first, operator
                         2026-11-01); from 560px they are always shown and the toggle is inert. */
                      return (
                        <div className={`formsec__quals${qualsOpen ? " is-open" : ""}`}>
                          {heading && (
                            <button type="button" className="formsec__quals-head" aria-expanded={qualsOpen} aria-controls={`${uid}-quals`} onClick={() => setQualsOpen((o) => !o)}>
                              {heading} <span>{optionalTag(q.budgetLabel)}</span>
                              <svg className="formsec__quals-chev" viewBox="0 0 12 8" width="12" height="8" aria-hidden="true"><path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </button>
                          )}
                          <div className="formsec__quals-row" id={`${uid}-quals`}>
                            {/* What, then how much, then when: the order a person actually thinks in.
                                Several types may be picked; /api/leads gets them as an array. */}
                            <div className="formsec__field">
                              <span className="formsec__label" id={`${uid}-types-l`}>{lab(q.propertyLabel)}</span>
                              <PropertyTypeSelect
                                id={`${uid}-types`} name="propertyTypeInterest" labelledBy={`${uid}-types-l`}
                                options={PROPERTY_VALUES.map((v) => ({ value: v, label: q.properties[v] }))}
                                values={values.propertyTypeInterest}
                                onChange={(next) => setFieldValue("propertyTypeInterest", next)}
                                placeholder={anyTypeLabel(lang) ?? q.choose}
                              />
                            </div>
                            <div className="formsec__field">
                              <label className="formsec__label" htmlFor={`${uid}-budget`}>{lab(q.budgetLabel)}</label>
                              <Field name="budget">
                                {({ field }: any) => (
                                  <select {...field} id={`${uid}-budget`} className="formsec__input formsec__select">
                                    <option value="">{q.choose}</option>
                                    {BUDGET_VALUES.map((v) => (
                                      <option key={v} value={v}>{q.budgets[v]}</option>
                                    ))}
                                  </select>
                                )}
                              </Field>
                            </div>
                            <div className="formsec__field">
                              <label className="formsec__label" htmlFor={`${uid}-timeline`}>{lab(q.timelineLabel)}</label>
                              <Field name="timeline">
                                {({ field }: any) => (
                                  <select {...field} id={`${uid}-timeline`} className="formsec__input formsec__select">
                                    <option value="">{q.choose}</option>
                                    {TIMELINE_VALUES.map((v) => (
                                      <option key={v} value={v}>{q.timelines[v]}</option>
                                    ))}
                                  </select>
                                )}
                              </Field>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* honeypot */}
                  <Field type="text" name="company" style={{ display: "none" }} tabIndex={-1} autoComplete="new-password" aria-hidden="true" />

                  {/* In flow, right above the consent + Send row: the visitor is looking there when
                      they press Send. The old .formsec__popup was position:fixed and got
                      clipped by a transformed ancestor, landing half off-screen. */}
                  {message && <div className={`form-feedback formsec__feedback${messageIsError ? " form-feedback--error" : ""}`} role="alert" aria-live="assertive">{message}</div>}
                  {/* Consent and Send share one row (compact layout, operator 2026-11-01). */}
                  <div className="formsec__footer">
                    <div className="formsec__consent">
                      <Field
                        type="checkbox"
                        name="agreedToPolicy"
                        id={`${uid}-agreedToPolicy`}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldValue("agreedToPolicy", e.target.checked)}
                      />
                      <label htmlFor={`${uid}-agreedToPolicy`}>
                        {consentCopy(lang).lead}
                        <a className="formsec__policy" href={consentCopy(lang).termsHref} target="_blank" rel="noopener noreferrer">{consentCopy(lang).termsLabel}</a>
                        {consentCopy(lang).mid}
                        <a className="formsec__policy" href={consentCopy(lang).privacyHref} target="_blank" rel="noopener noreferrer">{consentCopy(lang).privacyLabel}</a>
                        {consentCopy(lang).tail}
                      </label>
                      <div className="formsec__errorSlot">
                        <ErrorMessage name="agreedToPolicy">
                          {(msg) => <div className="formsec__error">{msg}</div>}
                        </ErrorMessage>
                      </div>
                    </div>

                    <button type="submit" className="btn btn--primary formsec__submit" disabled={isSubmitting}>
                      {isSubmitting ? <span className="formsec__loader form-spinner" /> : t.send}
                    </button>
                  </div>
                </FormikForm>
              )}
            </Formik>
          </div>

          <aside className="formsec__aside">
            <div className="formsec__consultant-wrap">
              <OptImg className="formsec__consultant" src={CONSULTANT_IMAGE} alt="Sascha Dith, CEO Cyprus VIP Estates" sizes="(max-width: 768px) 80vw, 420px" maxWidth={828} />
            </div>
            <div className="formsec__caption">
              <strong>Sascha Dith</strong>
              <span>CEO Cyprus VIP Estates</span>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default Form;
