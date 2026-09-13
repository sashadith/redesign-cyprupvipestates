"use client";

import React, { FC, useId, useRef, useState } from "react";
import { Formik, Form as FormikForm, Field, ErrorMessage, FormikHelpers, FormikProps } from "formik";
import * as Yup from "yup";
import axios from "axios";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { getAttribution } from "@/lib/attribution";
import { qualifierCopy, BUDGET_VALUES, PROPERTY_VALUES, TIMELINE_VALUES } from "@/app/components/qualifierFields";
import { consentCopy } from "@/app/components/consentCopy";
import { formCopy } from "./Form.copy";
import "@/app/components/formFeedback.css";

/* Contact form — redesign styling. Submission / validation / tracking logic is
   preserved verbatim from the live FormStatic (lead → /api/monday → /api/leads,
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
  return (<>Leave <span className="it">your details</span> and we will contact you shortly</>);
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
const Form: FC<{ lang?: string; title?: React.ReactNode; subtitle?: React.ReactNode; showQuestionField?: boolean; showQualifiers?: boolean }> = ({
  lang = "en", title, subtitle, showQuestionField = false, showQualifiers = false,
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

  const initialValues: FormData = {
    name: "", surname: "", phone: "", email: "",
    preferredContact: "", agreedToPolicy: false, company: "", formStartTime, question: "",
    budget: "", timeline: "", propertyTypeInterest: [],
  };

  const validationSchema = Yup.object({
    name: Yup.string().required(t.vName),
    surname: Yup.string().required(t.vSurname),
    phone: Yup.string().required(t.vPhone),
    ...(showQuestionField ? { question: Yup.string().trim().required(questionRequired) } : {}),
    email: Yup.string().email(t.vEmailInvalid).required(t.vEmail),
    preferredContact: Yup.string().oneOf(["phone", "whatsapp", "email"]).required(t.vContact),
    agreedToPolicy: Yup.boolean().required(t.vConsentReq).oneOf([true], t.vConsentOne),
  });

  const onSubmit = async (values: FormData, { setSubmitting, resetForm }: FormikHelpers<FormData>) => {
    setSubmitting(true);
    try {
      const currentPage = window.location.href;
      const parsedPhone = parsePhoneNumberFromString(values.phone || "");
      const phoneFinal = parsedPhone?.number || values.phone || "";

      const response = await axios.post("/api/monday", {
        ...values,
        phone: phoneFinal,
        formStartTime,
        currentPage,
        lang,
        ...getAttribution(),
      });

      if (response.status === 200) {
        if (typeof window !== "undefined" && window.fbq) {
          window.fbq("track", "Lead", {
            form_name: "form_static",
            page_location: currentPage,
            preferred_contact: values.preferredContact,
          });
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
    <section className="section is-light formsec">
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

                    <div className="formsec__field">
                      <label className="formsec__label" htmlFor={`${uid}-phone`}>{t.labelPhone}</label>
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
                        onChange={(value) => setFieldValue("phone", value || "", false)}
                        onBlur={() => formikRef.current?.setFieldTouched("phone", true, true)}
                      />
                      <div className="formsec__errorSlot">
                        <ErrorMessage name="phone">
                          {(msg) => <div className="formsec__error">{msg}</div>}
                        </ErrorMessage>
                      </div>
                    </div>

                    <div className="formsec__field">
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

                    {showQualifiers && (
                      <>
                        {/* What, then how much, then when — the order a person
                            actually thinks in. Multi-select: Formik keeps
                            propertyTypeInterest as an array when the checkboxes
                            share one name and carry a value, which is the shape
                            /api/leads filters. */}
                        <div className="formsec__field formsec__field--full">
                          <span className="formsec__label">{q.propertyLabel}</span>
                          <div className="formsec__radio-options">
                            {PROPERTY_VALUES.map((v) => (
                              <label key={v} className="formsec__radio-option">
                                <Field type="checkbox" name="propertyTypeInterest" value={v} />
                                <span>{q.properties[v]}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="formsec__field">
                          <label className="formsec__label" htmlFor={`${uid}-budget`}>{q.budgetLabel}</label>
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
                          <label className="formsec__label" htmlFor={`${uid}-timeline`}>{q.timelineLabel}</label>
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
                      </>
                    )}

                    {showQuestionField && (
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
                  </div>

                  <fieldset className="formsec__radio">
                    <legend className="formsec__radio-legend">{t.legend}</legend>
                    <div className="formsec__radio-options">
                      <label className="formsec__radio-option">
                        <Field type="radio" name="preferredContact" value="phone" />
                        <span>{t.optPhone}</span>
                      </label>
                      <label className="formsec__radio-option">
                        <Field type="radio" name="preferredContact" value="whatsapp" />
                        <span>WhatsApp</span>
                      </label>
                      <label className="formsec__radio-option">
                        <Field type="radio" name="preferredContact" value="email" />
                        <span>{t.optEmail}</span>
                      </label>
                    </div>
                  </fieldset>
                  <div className="formsec__errorSlot">
                    <ErrorMessage name="preferredContact">
                      {(msg) => <div className="formsec__error">{msg}</div>}
                    </ErrorMessage>
                  </div>

                  {/* honeypot */}
                  <Field type="text" name="company" style={{ display: "none" }} tabIndex={-1} autoComplete="new-password" aria-hidden="true" />

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


                  {/* In flow, right above the button: the visitor is looking there when
                      they press Send. The old .formsec__popup was position:fixed and got
                      clipped by a transformed ancestor, landing half off-screen. */}
                  {message && <div className={`form-feedback formsec__feedback${messageIsError ? " form-feedback--error" : ""}`} role="alert" aria-live="assertive">{message}</div>}
                  <button type="submit" className="btn btn--primary formsec__submit" disabled={isSubmitting}>
                    {isSubmitting ? <span className="formsec__loader form-spinner" /> : t.send}
                  </button>
                </FormikForm>
              )}
            </Formik>
          </div>

          <aside className="formsec__aside">
            <div className="formsec__consultant-wrap">
              <img className="formsec__consultant" src={CONSULTANT_IMAGE} alt="Sascha Dith, CEO Cyprus VIP Estates" />
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
