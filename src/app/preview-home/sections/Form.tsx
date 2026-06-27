"use client";

import React, { FC, useId, useRef, useState } from "react";
import { Formik, Form as FormikForm, Field, ErrorMessage, FormikHelpers, FormikProps } from "formik";
import * as Yup from "yup";
import axios from "axios";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { getAttribution } from "@/lib/attribution";

/* Contact form — restyled to the redesign. The submission/validation/tracking
   logic is preserved verbatim from the live FormStatic (Monday lead + fbq /
   lintrk / dataLayer + honeypot + attribution). Preview is EN-only; i18n is
   re-added at promotion. The live FormStatic + its module CSS are untouched. */

export type FormData = {
  name: string;
  surname: string;
  phone: string;
  email: string;
  preferredContact: string;
  agreedToPolicy: boolean;
  company: string;
  formStartTime: number;
};

const CONSULTANT_IMAGE = "/uploads/files/50b0d355d8507f9aadbe785a65e8a7233dd8f2e6.png";

const Form: FC<{ lang?: string }> = ({ lang = "en" }) => {
  const uid = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [formStartTime] = useState(() => Date.now());
  const formikRef = useRef<FormikProps<FormData> | null>(null);

  const initialValues: FormData = {
    name: "",
    surname: "",
    phone: "",
    email: "",
    preferredContact: "",
    agreedToPolicy: false,
    company: "",
    formStartTime,
  };

  const validationSchema = Yup.object({
    name: Yup.string().required("Name is required"),
    surname: Yup.string().required("Surname is required"),
    phone: Yup.string().required("Phone is required"),
    email: Yup.string().email("Invalid email address").required("Email is required"),
    preferredContact: Yup.string()
      .oneOf(["phone", "whatsapp", "email"])
      .required("What’s the best way to contact you?"),
    agreedToPolicy: Yup.boolean()
      .required("Consent is required")
      .oneOf([true], "Consent required"),
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
        setMessage("We have received your request and will contact you shortly.");
        setTimeout(() => setMessage(null), 5000);
      } else {
        throw new Error("Failed to send lead to monday.com");
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage("An error occurred while sending the request. Please try again later.");
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
            <h2 className="formsec__title">Leave your request and we will contact you shortly</h2>
            <hr className="shimmer formsec__stripe" />

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
                      <label className="formsec__label" htmlFor={`${uid}-name`}>Your name</label>
                      <Field name="name">
                        {({ field }: any) => (
                          <input {...field} id={`${uid}-name`} type="text" autoComplete="given-name" className="formsec__input" />
                        )}
                      </Field>
                      <ErrorMessage name="name" component="div" className="formsec__error" />
                    </div>

                    <div className="formsec__field">
                      <label className="formsec__label" htmlFor={`${uid}-surname`}>Surname</label>
                      <Field name="surname">
                        {({ field }: any) => (
                          <input {...field} id={`${uid}-surname`} type="text" autoComplete="family-name" className="formsec__input" />
                        )}
                      </Field>
                      <ErrorMessage name="surname" component="div" className="formsec__error" />
                    </div>

                    <div className="formsec__field">
                      <label className="formsec__label" htmlFor={`${uid}-phone`}>Phone</label>
                      <PhoneInput
                        id={`${uid}-phone`}
                        name="phone"
                        aria-label="Phone"
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
                      <label className="formsec__label" htmlFor={`${uid}-email`}>Email</label>
                      <Field name="email">
                        {({ field }: any) => (
                          <input {...field} id={`${uid}-email`} type="email" autoComplete="email" className="formsec__input" />
                        )}
                      </Field>
                      <ErrorMessage name="email" component="div" className="formsec__error" />
                    </div>
                  </div>

                  <fieldset className="formsec__radio">
                    <legend className="formsec__radio-legend">What’s the best way to contact you?</legend>
                    <div className="formsec__radio-options">
                      <label className="formsec__radio-option">
                        <Field type="radio" name="preferredContact" value="phone" />
                        <span>Phone call</span>
                      </label>
                      <label className="formsec__radio-option">
                        <Field type="radio" name="preferredContact" value="whatsapp" />
                        <span>WhatsApp</span>
                      </label>
                      <label className="formsec__radio-option">
                        <Field type="radio" name="preferredContact" value="email" />
                        <span>Email</span>
                      </label>
                    </div>
                  </fieldset>
                  <ErrorMessage name="preferredContact" component="div" className="formsec__error" />

                  {/* honeypot */}
                  <Field type="text" name="company" style={{ display: "none" }} tabIndex={-1} autoComplete="new-password" aria-hidden="true" />

                  <button type="submit" className="btn btn--primary formsec__submit" disabled={isSubmitting}>
                    {isSubmitting ? <span className="formsec__loader" /> : "Send"}
                  </button>

                  <div className="formsec__consent">
                    <Field
                      type="checkbox"
                      name="agreedToPolicy"
                      id={`${uid}-agreedToPolicy`}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldValue("agreedToPolicy", e.target.checked)}
                    />
                    <label htmlFor={`${uid}-agreedToPolicy`}>
                      I agree with the terms of the{" "}
                      <a className="formsec__policy" href="/privacy-policy" target="_blank" rel="noopener noreferrer">User agreement</a>{" "}
                      read and accept them
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
