"use client";

import { FC, useState, useEffect, useId, useRef } from "react";
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

import styles from "./FormMinimalBlockComponent.module.scss";
import Link from "next/link";

export type FormData = {
  name: string;
  surname: string;
  phone: string;
  email: string;
  message: string;
  preferredContact: string;
  agreedToPolicy: boolean;
  company: string;
  formStartTime: number;
};

export interface ContactFormProps {
  onFormSubmitSuccess?: () => void;
  form: any;
  lang: string;
  offerButtonCustomText?: string;
}

const FormMinimalBlockComponent: FC<ContactFormProps> = ({
  onFormSubmitSuccess,
  form,
  lang,
  offerButtonCustomText,
}) => {
  const uid = useId();
  const [message, setMessage] = useState<string | null>(null);
  const dataForm = form.form;

  const [formStartTime, setFormStartTime] = useState(0);
  const formikRef = useRef<FormikProps<FormData> | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const f = formikRef.current;
      const fields = ["name", "surname", "email", "message"] as const;

      fields.forEach((field) => {
        const el = document.querySelector(`[name="${field}"]`) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | null;

        const domVal = (el?.value ?? "").trim();

        if (f && domVal && !String((f.values as any)[field] ?? "").trim()) {
          f.setFieldValue(field, domVal, false);
        }
      });
    }, 200);

    if (formStartTime === 0) {
      setFormStartTime(Date.now());
    }

    return () => clearInterval(interval);
  }, [formStartTime]);

  const initialValues: FormData = {
    name: "",
    surname: "",
    phone: "",
    email: "",
    message: "",
    preferredContact: "",
    agreedToPolicy: false,
    company: "",
    formStartTime: 0,
  };

  const validationSchema = Yup.object({
    name: Yup.string()
      .transform((v) => (typeof v === "string" ? v.trim() : v))
      .required(`${dataForm.validationNameRequired}`),

    surname: Yup.string()
      .transform((v) => (typeof v === "string" ? v.trim() : v))
      .required(
        (dataForm as any).validationSurnameRequired ??
          dataForm.validationNameRequired,
      ),

    phone: Yup.string().required(`${dataForm.validationPhoneRequired}`),

    email: Yup.string()
      .transform((v) => (typeof v === "string" ? v.trim() : v))
      .email(`${dataForm.validationEmailInvalid}`)
      .required(`${dataForm.validationEmailRequired}`),

    message: Yup.string()
      .transform((v) => (typeof v === "string" ? v.trim() : v))
      .required(dataForm.validationMessageRequired!),

    preferredContact: Yup.string()
      .oneOf(["phone", "whatsapp", "email"])
      .required(
        lang === "ru"
          ? "Как с вами лучше связаться?"
          : lang === "de"
            ? "Wie können wir Sie am besten kontaktieren?"
            : lang === "pl"
              ? "Wybierz preferowaną formę kontaktu"
              : "What’s the best way to contact you?",
      ),

    agreedToPolicy: Yup.boolean()
      .required(`${dataForm.validationAgreementRequired}`)
      .oneOf([true], `${dataForm.validationAgreementOneOf}`),
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
      });

      if (
        response.status === 200 &&
        response.data?.ok === true &&
        response.data?.created === true
      ) {
        if (typeof window !== "undefined" && window.fbq) {
          window.fbq("track", "Lead", {
            form_name: "form_minimal",
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
            form_name: "form_minimal",
            page_url: window.location.href,
          });
        }

        onFormSubmitSuccess && onFormSubmitSuccess();

        setMessage(
          lang === "ru"
            ? "Мы получили вашу заявку и свяжемся с вами в ближайшее время."
            : lang === "de"
              ? "Wir haben Ihre Anfrage erhalten und werden uns in Kürze bei Ihnen melden."
              : lang === "pl"
                ? "Otrzymaliśmy Twoje zapytanie i skontaktujemy się z Tobą wkrótce."
                : "We have received your request and will contact you shortly.",
        );

        setTimeout(() => setMessage(null), 5000);
      } else {
        console.warn("Form blocked/failed:", response.data);
        throw new Error(response.data?.blocked || "blocked_or_failed");
      }
    } catch (error: any) {
      console.error("Error:", error);

      const blocked = error?.response?.data?.blocked;
      const okFalse = error?.response?.data?.ok === false;

      if (blocked || okFalse) {
        setMessage(dataForm.spamBlockedMessage || dataForm.errorMessage);
      } else {
        setMessage(dataForm.errorMessage);
      }

      setTimeout(() => setMessage(null), 7000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleButtonClick = () => {
    // optional debug
  };

  return (
    <>
      <div className={styles.formMinimal}>
        <div className="container">
          {message && <div className={styles.popup}>{message}</div>}

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
              const isMessageFilled = Boolean(values.message.trim());

              return (
                <Form>
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
                      className={`${styles.label} ${isNameFilled ? styles.filled : ""}`}
                    >
                      {dataForm.inputName}
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

                    <ErrorMessage
                      name="name"
                      component="div"
                      className={styles.error}
                    />
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
                      className={`${styles.label} ${isSurnameFilled ? styles.filled : ""}`}
                    >
                      {(dataForm as any).inputSurname ??
                        (lang === "ru"
                          ? "Фамилия"
                          : lang === "de"
                            ? "Nachname"
                            : lang === "pl"
                              ? "Nazwisko"
                              : "Surname")}
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

                    <ErrorMessage
                      name="surname"
                      component="div"
                      className={styles.error}
                    />
                  </div>

                  <div className={styles.inputWrapper}>
                    <PhoneInput
                      id={`${uid}-phone`}
                      name="phone"
                      aria-label={dataForm.inputPhone}
                      placeholder={dataForm.inputPhone}
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
                        formikRef.current?.setFieldTouched("phone", true, true);
                      }}
                    />

                    <ErrorMessage
                      name="phone"
                      component="div"
                      className={styles.error}
                    />
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
                      className={`${styles.label} ${isEmailFilled ? styles.filled : ""}`}
                    >
                      {dataForm.inputEmail}
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

                    <ErrorMessage
                      name="email"
                      component="div"
                      className={styles.error}
                    />
                  </div>

                  <div className={styles.inputWrapper}>
                    <span className={styles.radioGroupLabel}>
                      {lang === "ru"
                        ? "Как с вами лучше связаться?"
                        : lang === "de"
                          ? "Wie können wir Sie am besten kontaktieren?"
                          : lang === "pl"
                            ? "W jaki sposób najlepiej się z Tobą skontaktować?"
                            : "What’s the best way to contact you?"}
                    </span>

                    <div className={styles.radioGroupWrapper}>
                      <label className={styles.radioOption}>
                        <Field
                          type="radio"
                          name="preferredContact"
                          value="phone"
                        />
                        <span>
                          {lang === "ru"
                            ? "Телефон"
                            : lang === "de"
                              ? "Anruf"
                              : lang === "pl"
                                ? "Telefonicznie"
                                : "Phone call"}
                        </span>
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
                        <span>
                          {lang === "de"
                            ? "E-Mail"
                            : lang === "pl"
                              ? "E-mail"
                              : "Email"}
                        </span>
                      </label>
                    </div>

                    <ErrorMessage
                      name="preferredContact"
                      component="div"
                      className={styles.error}
                    />
                  </div>

                  <div className={styles.inputWrapper}>
                    <label
                      htmlFor={`${uid}-message`}
                      className={`${styles.label} ${styles.labelMessage} ${
                        isMessageFilled ? styles.filled : ""
                      }`}
                    >
                      {dataForm.inputMessage}
                    </label>

                    <Field name="message">
                      {({ field }: any) => (
                        <textarea
                          {...field}
                          id={`${uid}-message`}
                          autoComplete="off"
                          className={styles.inputField}
                          onBlur={field.onBlur}
                        />
                      )}
                    </Field>

                    <ErrorMessage
                      name="message"
                      component="div"
                      className={styles.error}
                    />
                  </div>

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
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setFieldValue("agreedToPolicy", e.target.checked);
                      }}
                    />

                    <ErrorMessage
                      name="agreedToPolicy"
                      component="div"
                      className={styles.errorCheckbox}
                    />

                    <label htmlFor={`${uid}-agreedToPolicy`}>
                      {lang === "ru"
                        ? "Я согласен с "
                        : lang === "de"
                          ? "Ich habe die Bedingungen der "
                          : lang === "pl"
                            ? "Zgadzam się z "
                            : "I agree with the terms of the "}
                      <Link
                        className={styles.policyLink}
                        href={
                          lang === "ru"
                            ? "/ru/politika-privatnosti"
                            : lang === "de"
                              ? "/datenschutzrichtlinie"
                              : lang === "pl"
                                ? "/pl/polityka-prywatnosci"
                                : "/en/privacy-policy"
                        }
                        target="_blank"
                      >
                        {lang === "ru"
                          ? "Пользовательским соглашением"
                          : lang === "de"
                            ? "Benutzervereinbarung"
                            : lang === "pl"
                              ? "Umowa użytkownika"
                              : "User agreement"}
                      </Link>
                      {lang === "ru"
                        ? " прочитал и принимаю их"
                        : lang === "de"
                          ? " gelesen und akzeptiere sie"
                          : lang === "pl"
                            ? " przeczytałem i akceptuję je"
                            : " read and accept them"}
                    </label>
                  </div>

                  <div>
                    <button
                      type="submit"
                      className={styles.sentBtn}
                      disabled={isSubmitting}
                      onClick={handleButtonClick}
                    >
                      {isSubmitting ? (
                        <div className={styles.loader}></div>
                      ) : offerButtonCustomText ? (
                        offerButtonCustomText
                      ) : (
                        dataForm.buttonText
                      )}
                    </button>
                  </div>
                </Form>
              );
            }}
          </Formik>
        </div>
      </div>
    </>
  );
};

export default FormMinimalBlockComponent;
