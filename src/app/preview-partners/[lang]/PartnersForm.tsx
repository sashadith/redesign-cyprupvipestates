"use client";

import React, { useId, useRef, useState } from "react";
import { Formik, Form as FormikForm, Field, ErrorMessage, FormikHelpers, FormikProps } from "formik";
import * as Yup from "yup";
import axios from "axios";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { getAttribution } from "@/lib/attribution";
import { partnersCopy } from "./copy";

/* Partner registration form — redesign styling (reuses the shared .formsec__*
   design-system classes from tokens.css, same as preview-home/sections/Form.tsx),
   but a DEDICATED component rather than reusing Form.tsx directly: Form.tsx
   posts to /api/monday (the general consultation-request pipeline) and has no
   `country` field. This page's submission must keep hitting /api/email, whose
   PARTNERS_PATH_RE gate REQUIRES a non-empty `country` and tags the resulting
   lead `source: "PARTNER"` for CRM — porting FormPartners.tsx's exact field
   set/validation/submit logic here preserves that contract unchanged, only the
   visual layer is new. */

type PartnersFormData = {
  name: string;
  surname: string;
  phone: string;
  email: string;
  country: string;
  agreedToPolicy: boolean;
  company: string;
  formStartTime: number;
};

export default function PartnersForm({ lang }: { lang: string }) {
  const t = partnersCopy(lang);
  const uid = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [formStartTime] = useState(() => Date.now());
  const formikRef = useRef<FormikProps<PartnersFormData> | null>(null);

  const initialValues: PartnersFormData = {
    name: "", surname: "", phone: "", email: "", country: "",
    agreedToPolicy: false, company: "", formStartTime,
  };

  const validationSchema = Yup.object({
    name: Yup.string().trim().required(t.vName),
    surname: Yup.string().trim().required(t.vSurname),
    phone: Yup.string().required(t.vPhone),
    email: Yup.string().trim().email(t.vEmailInvalid).required(t.vEmail),
    country: Yup.string().trim().required(t.vCountry),
    agreedToPolicy: Yup.boolean().required(t.vConsent).oneOf([true], t.vConsent),
  });

  const onSubmit = async (values: PartnersFormData, { setSubmitting, resetForm }: FormikHelpers<PartnersFormData>) => {
    setSubmitting(true);
    try {
      const currentPage = window.location.href;
      const parsedPhone = parsePhoneNumberFromString(values.phone || "");
      const phoneFinal = parsedPhone?.number || values.phone || "";

      const response = await axios.post("/api/email", {
        ...values,
        phone: phoneFinal,
        formStartTime,
        currentPage,
        lang,
        ...getAttribution(),
      });

      if (response.status === 200 && response.data?.ok === true) {
        if (typeof window !== "undefined" && window.fbq) {
          window.fbq("track", "Lead", { form_name: "partners_form", page_location: currentPage });
        }
        resetForm({});
        if (typeof window !== "undefined" && (window as any).dataLayer) {
          (window as any).dataLayer.push({
            event: "form_submission_success",
            form_name: "partners_form",
            page_url: window.location.href,
          });
        }
        setMessage(t.formSuccess);
        setTimeout(() => setMessage(null), 5000);
      } else {
        throw new Error(response.data?.blocked || "blocked_or_failed");
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage(t.formError);
      setTimeout(() => setMessage(null), 7000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {message && <div className="formsec__popup" role="alert" aria-live="assertive">{message}</div>}

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
                <label className="formsec__label" htmlFor={`${uid}-name`}>{t.formLabelName}</label>
                <Field name="name">
                  {({ field }: any) => (
                    <input {...field} id={`${uid}-name`} type="text" autoComplete="given-name" className="formsec__input" />
                  )}
                </Field>
                <ErrorMessage name="name" component="div" className="formsec__error" />
              </div>

              <div className="formsec__field">
                <label className="formsec__label" htmlFor={`${uid}-surname`}>{t.formLabelSurname}</label>
                <Field name="surname">
                  {({ field }: any) => (
                    <input {...field} id={`${uid}-surname`} type="text" autoComplete="family-name" className="formsec__input" />
                  )}
                </Field>
                <ErrorMessage name="surname" component="div" className="formsec__error" />
              </div>

              <div className="formsec__field">
                <label className="formsec__label" htmlFor={`${uid}-phone`}>{t.formLabelPhone}</label>
                <PhoneInput
                  id={`${uid}-phone`}
                  name="phone"
                  aria-label={t.formLabelPhone}
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
                <label className="formsec__label" htmlFor={`${uid}-email`}>{t.formLabelEmail}</label>
                <Field name="email">
                  {({ field }: any) => (
                    <input {...field} id={`${uid}-email`} type="email" autoComplete="email" className="formsec__input" />
                  )}
                </Field>
                <ErrorMessage name="email" component="div" className="formsec__error" />
              </div>

              <div className="formsec__field formsec__field--full">
                <label className="formsec__label" htmlFor={`${uid}-country`}>{t.formLabelCountry}</label>
                <Field name="country">
                  {({ field }: any) => (
                    <input {...field} id={`${uid}-country`} type="text" autoComplete="country-name" className="formsec__input" />
                  )}
                </Field>
                <ErrorMessage name="country" component="div" className="formsec__error" />
              </div>
            </div>

            {/* honeypot */}
            <Field type="text" name="company" style={{ display: "none" }} tabIndex={-1} autoComplete="new-password" aria-hidden="true" />

            <button type="submit" className="btn btn--primary formsec__submit" disabled={isSubmitting}>
              {isSubmitting ? <span className="formsec__loader" /> : t.formSubmit}
            </button>

            <div className="formsec__consent">
              <Field
                type="checkbox"
                name="agreedToPolicy"
                id={`${uid}-agreedToPolicy`}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldValue("agreedToPolicy", e.target.checked)}
              />
              <label htmlFor={`${uid}-agreedToPolicy`}>
                {t.formConsentPre}
                <a className="formsec__policy" href={t.formPolicyHref} target="_blank" rel="noopener noreferrer">{t.formConsentLink}</a>
                {t.formConsentPost}
              </label>
              <ErrorMessage name="agreedToPolicy" component="div" className="formsec__error" />
            </div>
          </FormikForm>
        )}
      </Formik>
    </>
  );
}
