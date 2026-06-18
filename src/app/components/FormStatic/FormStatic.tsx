"use client";

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
  const [formStartTime] = useState(() => Date.now());
  const formikRef = useRef<FormikProps<FormData> | null>(null);

  const inputPhoneLabel =
    lang === "ru"
      ? "Телефон"
      : lang === "de"
        ? "Telefon"
        : lang === "pl"
          ? "Telefon"
          : "Phone";

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
    name: Yup.string().required(
      lang === "ru"
        ? "Имя обязательно"
        : lang === "de"
          ? "Name ist erforderlich"
          : lang === "pl"
            ? "Imię jest wymagane"
            : "Name is required",
    ),

    surname: Yup.string().required(
      lang === "ru"
        ? "Фамилия обязательна"
        : lang === "de"
          ? "Nachname ist erforderlich"
          : lang === "pl"
            ? "Nazwisko jest wymagane"
            : "Surname is required",
    ),

    phone: Yup.string().required(
      lang === "ru"
        ? "Телефон обязателен"
        : lang === "de"
          ? "Telefon ist erforderlich"
          : lang === "pl"
            ? "Telefon jest wymagany"
            : "Phone is required",
    ),

    email: Yup.string()
      .email(
        lang === "ru"
          ? "Неверный формат email"
          : lang === "de"
            ? "Ungültige E-Mail Adresse"
            : lang === "pl"
              ? "Nieprawidłowy format email"
              : "Invalid email address",
      )
      .required(
        lang === "ru"
          ? "Email обязателен"
          : lang === "de"
            ? "E-Mail ist erforderlich"
            : lang === "pl"
              ? "Email jest wymagany"
              : "Email is required",
      ),

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
      .required(
        lang === "ru"
          ? "Согласие обязательно"
          : lang === "de"
            ? "Zustimmung erforderlich"
            : lang === "pl"
              ? "Zgoda jest wymagana"
              : "Consent is required",
      )
      .oneOf(
        [true],
        lang === "ru"
          ? "Требуется согласие"
          : lang === "de"
            ? "Einverständnis erforderlich"
            : lang === "pl"
              ? "Wymagane wyrażenie zgody"
              : "Consent required",
      ),
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

        setMessage(
          lang === "ru"
            ? "Мы получили вашу заявку и свяжемся с вами в ближайшее время."
            : lang === "de"
              ? "Wir haben Ihre Anfrage erhalten und werden uns in Kürze bei Ihnen melden."
              : lang === "pl"
                ? "Otrzymaliśmy Twoje zapytanie i skontaktujemy się z Tobą wkrótce."
                : "We have received your request and will contact you shortly.",
        );

        setTimeout(() => {
          setMessage(null);
        }, 5000);
      } else {
        throw new Error("Failed to send lead to monday.com");
      }
    } catch (error) {
      console.error("Error:", error);

      setMessage(
        lang === "ru"
          ? "Произошла ошибка при отправке заявки. Попробуйте позже."
          : lang === "de"
            ? "Beim Senden der Anfrage ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut."
            : lang === "pl"
              ? "Wystąpił błąd podczas wysyłania zapytania. Spróbuj ponownie później."
              : "An error occurred while sending the request. Please try again later.",
      );

      setTimeout(() => {
        setMessage(null);
      }, 7000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleButtonClick = () => {
    console.log("Button clicked");
  };

  return (
    <>
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

          return (
            <Form>
              <section className={styles.form}>
                <div className="container">
                  <div className={styles.formWrapper}>
                    <div className={styles.formContent}>
                      <h2 className={styles.title}>
                        {lang === "ru"
                          ? "Оставьте заявку и мы свяжемся с вами в ближайшее время"
                          : lang === "de"
                            ? "Lassen Sie sich noch heute von uns beraten!"
                            : lang === "pl"
                              ? "Zostaw zapytanie, a my skontaktujemy się z Tobą wkrótce"
                              : "Leave your request and we will contact you shortly"}
                      </h2>

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
                            {lang === "ru"
                              ? "Ваше имя"
                              : lang === "de"
                                ? "Ihr Vorname"
                                : lang === "pl"
                                  ? "Imię"
                                  : "Your name"}
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
                            className={`${styles.label} ${
                              isSurnameFilled ? styles.filled : ""
                            }`}
                          >
                            {lang === "ru"
                              ? "Фамилия"
                              : lang === "de"
                                ? "Ihr Nachname"
                                : lang === "pl"
                                  ? "Nazwisko"
                                  : "Surname"}
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
                            className={`${styles.label} ${
                              isEmailFilled ? styles.filled : ""
                            }`}
                          >
                            {lang === "ru"
                              ? "Ваш email"
                              : lang === "de"
                                ? "E-Mail Adresse"
                                : lang === "pl"
                                  ? "E-mail"
                                  : "Email"}
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
                      </div>

                      <div className={styles.radioGroupWrapper}>
                        <span className={styles.radioGroupLabel}>
                          {lang === "ru"
                            ? "Как с вами лучше связаться?"
                            : lang === "de"
                              ? "Wie möchten Sie am besten kontaktiert werden?"
                              : lang === "pl"
                                ? "W jaki sposób najlepiej się z Tobą skontaktować?"
                                : "What’s the best way to contact you?"}
                        </span>

                        <div className={styles.radioOptions}>
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
                                  ? "Telefon"
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
                      </div>

                      <ErrorMessage
                        name="preferredContact"
                        component="div"
                        className={styles.errorRadio}
                      />

                      <button
                        type="submit"
                        className={styles.sentBtn}
                        disabled={isSubmitting}
                        onClick={handleButtonClick}
                      >
                        {isSubmitting ? (
                          <div className={styles.loader}></div>
                        ) : lang === "ru" ? (
                          "Отправить"
                        ) : lang === "de" ? (
                          "Absenden"
                        ) : lang === "pl" ? (
                          "Wyślij"
                        ) : (
                          "Send"
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
