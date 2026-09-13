"use client";
import { getAttribution } from "@/lib/attribution";

import { FC, useId, useRef, useState } from "react";
import {
  Formik,
  Form,
  Field,
  ErrorMessage,
  FormikHelpers,
  FormikProps,
} from "formik";
import * as Yup from "yup";
import axios from "axios";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { parsePhoneNumberFromString } from "libphonenumber-js";

import styles from "./FormStatic.module.scss";
import Link from "next/link";
import "../formFeedback.css";
import { formSuccessText, formErrorText } from "../formFeedbackCopy";
import { formStaticCopy } from "./FormStatic.copy";

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

export interface ContactFormProps {
  onFormSubmitSuccess?: () => void;
  lang: string;
}

const consultantImage =
  "/uploads/files/50b0d355d8507f9aadbe785a65e8a7233dd8f2e6.png";

const FormStatic: FC<ContactFormProps> = ({ onFormSubmitSuccess, lang }) => {
  const uid = useId();
  const [message, setMessage] = useState<string | null>(null);
  /* The shared banner draws a tick; on a failure that contradicts the
     words next to it. See formFeedback.css. */
  const [messageIsError, setMessageIsError] = useState(false);
  const [formStartTime] = useState(() => Date.now());
  const formikRef = useRef<FormikProps<FormData> | null>(null);

  const inputPhoneLabel = formStaticCopy(lang).phoneLabel;

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
    name: Yup.string().required(formStaticCopy(lang).nameRequired),

    surname: Yup.string().required(formStaticCopy(lang).surnameRequired),

    phone: Yup.string().required(formStaticCopy(lang).phoneRequired),

    email: Yup.string()
      .email(formStaticCopy(lang).emailInvalid)
      .required(formStaticCopy(lang).emailRequired),

    preferredContact: Yup.string()
      .oneOf(["phone", "whatsapp", "email"])
      .required(formStaticCopy(lang).contactMethodRequired),

    agreedToPolicy: Yup.boolean()
      .required(formStaticCopy(lang).agreementRequired)
      .oneOf([true], formStaticCopy(lang).agreementOneOf),
  });

  const onSubmit = async (
    values: FormData,
    { setSubmitting, resetForm }: FormikHelpers<FormData>,
  ) => {
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
        if (
          typeof window !== "undefined" &&
          typeof (window as any).lintrk === "function"
        ) {
          (window as any).lintrk("track", {
            conversion_id: 27871505,
          });
        }

        resetForm({});

        if (typeof window !== "undefined" && window.dataLayer) {
          window.dataLayer.push({
            event: "form_submission_success",
            form_name: "form_static",
            page_url: window.location.href,
          });
        }

        onFormSubmitSuccess && onFormSubmitSuccess();

        setMessageIsError(false);
        setMessage(formSuccessText(lang));

        setTimeout(() => {
          setMessage(null);
        }, 10000);
      } else {
        throw new Error("Failed to send lead to monday.com");
      }
    } catch (error) {
      console.error("Error:", error);

      setMessageIsError(true);
      setMessage(formErrorText(lang));

      setTimeout(() => {
        setMessage(null);
      }, 12000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleButtonClick = () => {
    console.log("Button clicked");
  };

  return (
    <>
      {message && <div className={`${styles.popup} form-feedback${messageIsError ? " form-feedback--error" : ""}`} role="alert" aria-live="assertive">{message}</div>}

      <Formik
        innerRef={(inst) => {
          formikRef.current = inst;
        }}
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={onSubmit}
      >
        {({ isSubmitting, setFieldValue, values }) => {
          const isNameFilled = Boolean(values.name.trim());
          const isSurnameFilled = Boolean(values.surname.trim());
          const isEmailFilled = Boolean(values.email.trim());

          return (
            <Form>
              <section className={styles.form}>
                <div className="container">
                  <div className={styles.formWrapper}>
                    <div className={styles.formContent}>
                      <h2 className={styles.title}>{formStaticCopy(lang).title}</h2>

                      <div className={styles.inputs}>
                        <div className={styles.inputWrapper}>
                          <svg
                            className={styles.icon}
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            fill="#bd8948"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
                          </svg>
                          <label
                            htmlFor={`${uid}-name`}
                            className={`${styles.label} ${
                              isNameFilled ? styles.filled : ""
                            }`}
                          >
                            {formStaticCopy(lang).nameLabel}
                          </label>

                          <Field name="name">
                            {({ field }: any) => (
                              <input
                                {...field}
                                id={`${uid}-name`}
                                type="text"
                                autoComplete="given-name"
                                className={styles.inputField}
                                onBlur={field.onBlur}
                              />
                            )}
                          </Field>

                          <div className={styles.errorSlot}>
                            <ErrorMessage name="name">
                              {(msg) => <div className={styles.error}>{msg}</div>}
                            </ErrorMessage>
                          </div>
                        </div>

                        <div className={styles.inputWrapper}>
                          <svg
                            className={styles.icon}
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            fill="#bd8948"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
                          </svg>
                          <label
                            htmlFor={`${uid}-surname`}
                            className={`${styles.label} ${
                              isSurnameFilled ? styles.filled : ""
                            }`}
                          >
                            {formStaticCopy(lang).surnameLabel}
                          </label>

                          <Field name="surname">
                            {({ field }: any) => (
                              <input
                                {...field}
                                id={`${uid}-surname`}
                                type="text"
                                autoComplete="family-name"
                                className={styles.inputField}
                                onBlur={field.onBlur}
                              />
                            )}
                          </Field>

                          <div className={styles.errorSlot}>
                            <ErrorMessage name="surname">
                              {(msg) => <div className={styles.error}>{msg}</div>}
                            </ErrorMessage>
                          </div>
                        </div>

                        <div className={styles.inputWrapper}>
                          <PhoneInput
                            id={`${uid}-phone`}
                            name="phone"
                            aria-label={inputPhoneLabel}
                            placeholder={inputPhoneLabel}
                            className={`${styles.inputField} ${styles.phoneInput}`}
                            value={values.phone}
                            defaultCountry="CY"
                            international
                            withCountryCallingCode
                            smartCaret={false}
                            autoComplete="tel"
                            inputMode="tel"
                            type="tel"
                            onChange={(value) => {
                              setFieldValue("phone", value || "", false);
                            }}
                            onBlur={() => {
                              formikRef.current?.setFieldTouched(
                                "phone",
                                true,
                                true,
                              );
                            }}
                          />

                          <div className={styles.errorSlot}>
                            <ErrorMessage name="phone">
                              {(msg) => <div className={styles.error}>{msg}</div>}
                            </ErrorMessage>
                          </div>
                        </div>

                        <div className={styles.inputWrapper}>
                          <svg
                            className={styles.icon}
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            fill="#bd8948"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 13.5l-11-7.5v15h22v-15l-11 7.5zm0-2.5l11-7h-22l11 7z" />
                          </svg>
                          <label
                            htmlFor={`${uid}-email`}
                            className={`${styles.label} ${
                              isEmailFilled ? styles.filled : ""
                            }`}
                          >
                            {formStaticCopy(lang).emailLabel}
                          </label>

                          <Field name="email">
                            {({ field }: any) => (
                              <input
                                {...field}
                                id={`${uid}-email`}
                                type="email"
                                autoComplete="email"
                                className={styles.inputField}
                                onBlur={field.onBlur}
                              />
                            )}
                          </Field>

                          <div className={styles.errorSlot}>
                            <ErrorMessage name="email">
                              {(msg) => <div className={styles.error}>{msg}</div>}
                            </ErrorMessage>
                          </div>
                        </div>
                      </div>

                      <fieldset className={`${styles.radioGroupWrapper} min-w-0`}>
                        <legend className={styles.radioGroupLabel}>
                          {formStaticCopy(lang).contactMethodLegend}
                        </legend>

                        <div className={styles.radioOptions}>
                          <label className={styles.radioOption}>
                            <Field
                              type="radio"
                              name="preferredContact"
                              value="phone"
                            />
                            <span>{formStaticCopy(lang).phoneCallLabel}</span>
                          </label>

                          <label className={styles.radioOption}>
                            <Field
                              type="radio"
                              name="preferredContact"
                              value="whatsapp"
                            />
                            <span>WhatsApp</span>
                          </label>

                          <label className={styles.radioOption}>
                            <Field
                              type="radio"
                              name="preferredContact"
                              value="email"
                            />
                            <span>{formStaticCopy(lang).emailRadioLabel}</span>
                          </label>
                        </div>
                      </fieldset>

                      <div className={styles.errorSlot}>
                        <ErrorMessage name="preferredContact">
                          {(msg) => <div className={styles.errorRadio}>{msg}</div>}
                        </ErrorMessage>
                      </div>

                      <button
                        type="submit"
                        className={styles.sentBtn}
                        disabled={isSubmitting}
                        onClick={handleButtonClick}
                      >
                        {isSubmitting ? (
                          <div className={`${styles.loader} form-spinner`}></div>
                        ) : (
                          formStaticCopy(lang).submitLabel
                        )}
                      </button>

                      <Field
                        type="text"
                        name="company"
                        style={{ display: "none" }}
                        tabIndex={-1}
                        autoComplete="new-password"
                        aria-hidden="true"
                      />

                      <div className={styles.customCheckbox}>
                        <Field
                          type="checkbox"
                          name="agreedToPolicy"
                          id={`${uid}-agreedToPolicy`}
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
                            setFieldValue("agreedToPolicy", e.target.checked);
                          }}
                        />

                        <label htmlFor={`${uid}-agreedToPolicy`}>
                          {formStaticCopy(lang).agreementLead}

                          <Link
                            className={styles.policyLink}
                            href={formStaticCopy(lang).agreementHref}
                            target="_blank"
                          >
                            {formStaticCopy(lang).agreementLinkLabel}
                          </Link>

                          {formStaticCopy(lang).agreementTail}
                        </label>

                        <ErrorMessage
                          name="agreedToPolicy"
                          component="div"
                          className={styles.errorCheckbox}
                        />
                      </div>
                    </div>

                    <div className={styles.imageWrapper}>
                      <img
                        src={consultantImage}
                        alt="Sascha Dith, CEO Cyprus VIP Estates"
                        className={styles.consultantImage}
                      />

                      <div className={styles.personCaption}>
                        <strong>Sascha Dith</strong>
                        <span>CEO Cyprus VIP Estates</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </Form>
          );
        }}
      </Formik>
    </>
  );
};

export default FormStatic;
