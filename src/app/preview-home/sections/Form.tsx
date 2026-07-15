"use client";

import React, { FC, useId, useRef, useState } from "react";
import { Formik, Form as FormikForm, Field, ErrorMessage, FormikHelpers, FormikProps } from "formik";
import * as Yup from "yup";
import axios from "axios";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { getAttribution } from "@/lib/attribution";

/* Contact form — redesign styling. Submission / validation / tracking logic is
   preserved verbatim from the live FormStatic (lead → /api/monday → /api/leads,
   fbq / lintrk / dataLayer, honeypot, attribution). Now multilingual (en/de/pl/ru)
   using FormStatic's exact strings; `lang` defaults to "en" so existing EN-only
   usages (preview-home, preview-insights) are unchanged. */

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
};

const CONSULTANT_IMAGE = "/uploads/files/50b0d355d8507f9aadbe785a65e8a7233dd8f2e6.png";

type Strings = {
  labelName: string; labelSurname: string; labelPhone: string; labelEmail: string;
  legend: string; optPhone: string; optEmail: string; send: string;
  consentPre: string; consentLink: string; consentPost: string; policyHref: string;
  vName: string; vSurname: string; vPhone: string; vEmailInvalid: string; vEmail: string;
  vContact: string; vConsentReq: string; vConsentOne: string;
  success: string; error: string;
  // Optional — only populated for "en" today. showQuestionField is only ever
  // passed true on the (English-only) FAQ page, so de/pl/ru fall back to the
  // English copy below rather than risk an unreviewed translation shipping.
  labelQuestion?: string; placeholderQuestion?: string; vQuestion?: string;
};

const DICT: Record<string, Strings> = {
  en: {
    labelName: "Your name", labelSurname: "Surname", labelPhone: "Phone", labelEmail: "Email",
    legend: "What’s the best way to contact you?", optPhone: "Phone call", optEmail: "Email", send: "Send",
    consentPre: "I agree with the terms of the ", consentLink: "User agreement", consentPost: " read and accept them", policyHref: "/privacy-policy",
    vName: "Name is required", vSurname: "Surname is required", vPhone: "Phone is required",
    vEmailInvalid: "Invalid email address", vEmail: "Email is required", vContact: "What’s the best way to contact you?",
    vConsentReq: "Consent is required", vConsentOne: "Consent required",
    success: "We have received your request and will contact you shortly.",
    error: "An error occurred while sending the request. Please try again later.",
    labelQuestion: "Your question", placeholderQuestion: "What would you like to know?",
    vQuestion: "Please enter your question",
  },
  de: {
    labelName: "Ihr Vorname", labelSurname: "Ihr Nachname", labelPhone: "Telefon", labelEmail: "E-Mail Adresse",
    legend: "Wie möchten Sie am besten kontaktiert werden?", optPhone: "Telefon", optEmail: "E-Mail", send: "Absenden",
    consentPre: "Ich habe die Bedingungen der ", consentLink: "Benutzervereinbarung", consentPost: " gelesen und akzeptiere sie", policyHref: "/de/datenschutzrichtlinie",
    vName: "Name ist erforderlich", vSurname: "Nachname ist erforderlich", vPhone: "Telefon ist erforderlich",
    vEmailInvalid: "Ungültige E-Mail Adresse", vEmail: "E-Mail ist erforderlich", vContact: "Wie können wir Sie am besten kontaktieren?",
    vConsentReq: "Zustimmung erforderlich", vConsentOne: "Einverständnis erforderlich",
    success: "Wir haben Ihre Anfrage erhalten und werden uns in Kürze bei Ihnen melden.",
    error: "Beim Senden der Anfrage ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.",
  },
  pl: {
    labelName: "Imię", labelSurname: "Nazwisko", labelPhone: "Telefon", labelEmail: "E-mail",
    legend: "W jaki sposób najlepiej się z Tobą skontaktować?", optPhone: "Telefonicznie", optEmail: "E-mail", send: "Wyślij",
    consentPre: "Zgadzam się z ", consentLink: "Umowa użytkownika", consentPost: " przeczytałem i akceptuję je", policyHref: "/pl/polityka-prywatnosci",
    vName: "Imię jest wymagane", vSurname: "Nazwisko jest wymagane", vPhone: "Telefon jest wymagany",
    vEmailInvalid: "Nieprawidłowy format email", vEmail: "Email jest wymagany", vContact: "Wybierz preferowaną formę kontaktu",
    vConsentReq: "Zgoda jest wymagana", vConsentOne: "Wymagane wyrażenie zgody",
    success: "Otrzymaliśmy Twoje zapytanie i skontaktujemy się z Tobą wkrótce.",
    error: "Wystąpił błąd podczas wysyłania zapytania. Spróbuj ponownie później.",
  },
  ru: {
    labelName: "Ваше имя", labelSurname: "Фамилия", labelPhone: "Телефон", labelEmail: "Ваш email",
    legend: "Как с вами лучше связаться?", optPhone: "Телефон", optEmail: "Email", send: "Отправить",
    consentPre: "Я согласен с ", consentLink: "Пользовательским соглашением", consentPost: " прочитал и принимаю их", policyHref: "/ru/politika-privatnosti",
    vName: "Имя обязательно", vSurname: "Фамилия обязательна", vPhone: "Телефон обязателен",
    vEmailInvalid: "Неверный формат email", vEmail: "Email обязателен", vContact: "Как с вами лучше связаться?",
    vConsentReq: "Согласие обязательно", vConsentOne: "Требуется согласие",
    success: "Мы получили вашу заявку и свяжемся с вами в ближайшее время.",
    error: "Произошла ошибка при отправке заявки. Попробуйте позже.",
  },
};

// EN keeps its gold accent word; other locales render the plain localized title.
const titleNode = (lang: string) => {
  if (lang === "de") return "Lassen Sie sich noch heute von uns beraten!";
  if (lang === "pl") return "Zostaw zapytanie, a my skontaktujemy się z Tobą wkrótce";
  if (lang === "ru") return "Оставьте заявку и мы свяжемся с вами в ближайшее время";
  return (<>Leave <span className="it">your details</span> and we will contact you shortly</>);
};

// title/subtitle: optional per-page override of the default heading/copy above
// the fields (e.g. the FAQ page's own "Still have a question?" framing) —
// omit both to get the standard titleNode() heading, unchanged for every
// existing caller.
// showQuestionField: opt-in "Your question" textarea (FAQ page only today) —
// defaults to false, so the field is absent from both the DOM and validation
// for every other existing usage of this shared component.
const Form: FC<{ lang?: string; title?: React.ReactNode; subtitle?: React.ReactNode; showQuestionField?: boolean }> = ({
  lang = "en", title, subtitle, showQuestionField = false,
}) => {
  const t = DICT[lang] ?? DICT.en;
  const questionLabel = t.labelQuestion ?? "Your question";
  const questionPlaceholder = t.placeholderQuestion ?? "What would you like to know?";
  const questionRequired = t.vQuestion ?? "Please enter your question";
  const uid = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [formStartTime] = useState(() => Date.now());
  const formikRef = useRef<FormikProps<FormData> | null>(null);

  const initialValues: FormData = {
    name: "", surname: "", phone: "", email: "",
    preferredContact: "", agreedToPolicy: false, company: "", formStartTime, question: "",
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
        setMessage(t.success);
        setTimeout(() => setMessage(null), 5000);
      } else {
        throw new Error("Failed to send lead");
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage(t.error);
      setTimeout(() => setMessage(null), 7000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="section is-light formsec">
      {message && <div className="formsec__popup" role="alert" aria-live="assertive">{message}</div>}

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
                      <ErrorMessage name="name" component="div" className="formsec__error" />
                    </div>

                    <div className="formsec__field">
                      <label className="formsec__label" htmlFor={`${uid}-surname`}>{t.labelSurname}</label>
                      <Field name="surname">
                        {({ field }: any) => (
                          <input {...field} id={`${uid}-surname`} type="text" autoComplete="family-name" className="formsec__input" />
                        )}
                      </Field>
                      <ErrorMessage name="surname" component="div" className="formsec__error" />
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
                      <ErrorMessage name="phone" component="div" className="formsec__error" />
                    </div>

                    <div className="formsec__field">
                      <label className="formsec__label" htmlFor={`${uid}-email`}>{t.labelEmail}</label>
                      <Field name="email">
                        {({ field }: any) => (
                          <input {...field} id={`${uid}-email`} type="email" autoComplete="email" className="formsec__input" />
                        )}
                      </Field>
                      <ErrorMessage name="email" component="div" className="formsec__error" />
                    </div>

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
                        <ErrorMessage name="question" component="div" className="formsec__error" />
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
                  <ErrorMessage name="preferredContact" component="div" className="formsec__error" />

                  {/* honeypot */}
                  <Field type="text" name="company" style={{ display: "none" }} tabIndex={-1} autoComplete="new-password" aria-hidden="true" />

                  <button type="submit" className="btn btn--primary formsec__submit" disabled={isSubmitting}>
                    {isSubmitting ? <span className="formsec__loader" /> : t.send}
                  </button>

                  <div className="formsec__consent">
                    <Field
                      type="checkbox"
                      name="agreedToPolicy"
                      id={`${uid}-agreedToPolicy`}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldValue("agreedToPolicy", e.target.checked)}
                    />
                    <label htmlFor={`${uid}-agreedToPolicy`}>
                      {t.consentPre}
                      <a className="formsec__policy" href={t.policyHref} target="_blank" rel="noopener noreferrer">{t.consentLink}</a>
                      {t.consentPost}
                    </label>
                    <ErrorMessage name="agreedToPolicy" component="div" className="formsec__error" />
                  </div>
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
