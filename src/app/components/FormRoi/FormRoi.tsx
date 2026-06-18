"use client";

import { FC, useEffect, useId, useRef, useState } from "react";
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

import styles from "../FormStandard/FormStandard.module.scss";
import Link from "next/link";
import {
  RoiCalculationResult,
  RoiCalculatorInput,
  RoiScenario,
  RoiStrategy,
} from "@/lib/roi";

const NAME_MIN = 2;
const NAME_MAX = 22;
const SURNAME_MIN = 2;
const SURNAME_MAX = 22;
const PHONE_MIN = 7;
const PHONE_MAX = 25;

function tpl(str: string | undefined, vars: Record<string, string | number>) {
  return String(str ?? "").replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`,
  );
}

type FormData = {
  name: string;
  surname: string;
  phone: string;
  preferredContact: string;
  email: string;
  agreedToPolicy: boolean;
  fax: string;
  formStartTime: number;
};

type Props = {
  lang: string;
  strategy: RoiStrategy;
  scenario: RoiScenario;
  input: RoiCalculatorInput;
  result: RoiCalculationResult;
  onFormSubmitSuccess?: () => void;
  offerButtonCustomText?: string;
};

const FormRoi: FC<Props> = ({
  lang,
  strategy,
  scenario,
  input,
  result,
  onFormSubmitSuccess,
  offerButtonCustomText,
}) => {
  const uid = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [filled, setFilled] = useState({
    name: false,
    surname: false,
    phone: false,
    email: false,
  });

  const [formStartTime, setFormStartTime] = useState(0);
  const formikRef = useRef<FormikProps<FormData> | null>(null);

  const copy = {
    inputName:
      lang === "ru"
        ? "Имя"
        : lang === "de"
          ? "Vorname"
          : lang === "pl"
            ? "Imię"
            : "Name",
    inputSurname:
      lang === "ru"
        ? "Фамилия"
        : lang === "de"
          ? "Nachname"
          : lang === "pl"
            ? "Nazwisko"
            : "Surname",
    inputPhone:
      lang === "ru"
        ? "Телефон"
        : lang === "de"
          ? "Telefon"
          : lang === "pl"
            ? "Telefon"
            : "Phone",
    inputEmail:
      lang === "ru"
        ? "Email"
        : lang === "de"
          ? "E-Mail"
          : lang === "pl"
            ? "E-mail"
            : "Email",
    buttonText:
      lang === "ru"
        ? "Отправить расчет"
        : lang === "de"
          ? "Berechnung senden"
          : lang === "pl"
            ? "Wyślij kalkulację"
            : "Send calculation",
    successMessage:
      lang === "ru"
        ? "Мы отправили расчет вам на email и получили его копию."
        : lang === "de"
          ? "Wir haben die Berechnung an Ihre E-Mail-Adresse gesendet und eine Kopie erhalten."
          : lang === "pl"
            ? "Wysłaliśmy kalkulację na Twój e-mail i otrzymaliśmy jej kopię."
            : "We sent the calculation to your email and received a copy.",
    errorMessage:
      lang === "ru"
        ? "Произошла ошибка. Попробуйте еще раз."
        : lang === "de"
          ? "Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut."
          : lang === "pl"
            ? "Wystąpił błąd. Spróbuj ponownie."
            : "Something went wrong. Please try again.",
    validationNameRequired:
      lang === "ru"
        ? "Введите имя"
        : lang === "de"
          ? "Bitte Namen eingeben"
          : lang === "pl"
            ? "Wpisz imię"
            : "Please enter your name",
    validationNameTooShort:
      lang === "ru"
        ? "Минимум {min} символа(ов). Сейчас: {current}."
        : lang === "de"
          ? "Mindestens {min} Zeichen. Aktuell: {current}."
          : lang === "pl"
            ? "Minimum {min} znaków. Obecnie: {current}."
            : "Minimum {min} characters. Current: {current}.",
    validationNameTooLong:
      lang === "ru"
        ? "Максимум {max} символов. Сейчас: {current}."
        : lang === "de"
          ? "Maximal {max} Zeichen. Aktuell: {current}."
          : lang === "pl"
            ? "Maksymalnie {max} znaków. Obecnie: {current}."
            : "Maximum {max} characters. Current: {current}.",
    validationSurnameRequired:
      lang === "ru"
        ? "Введите фамилию"
        : lang === "de"
          ? "Bitte Nachnamen eingeben"
          : lang === "pl"
            ? "Wpisz nazwisko"
            : "Please enter your surname",
    validationSurnameTooShort:
      lang === "ru"
        ? "Минимум {min} символа(ов). Сейчас: {current}."
        : lang === "de"
          ? "Mindestens {min} Zeichen. Aktuell: {current}."
          : lang === "pl"
            ? "Minimum {min} znaków. Obecnie: {current}."
            : "Minimum {min} characters. Current: {current}.",
    validationSurnameTooLong:
      lang === "ru"
        ? "Максимум {max} символов. Сейчас: {current}."
        : lang === "de"
          ? "Maximal {max} Zeichen. Aktuell: {current}."
          : lang === "pl"
            ? "Maksymalnie {max} znaków. Obecnie: {current}."
            : "Maximum {max} characters. Current: {current}.",
    validationPhoneRequired:
      lang === "ru"
        ? "Введите номер телефона"
        : lang === "de"
          ? "Bitte Telefonnummer eingeben"
          : lang === "pl"
            ? "Wpisz numer telefonu"
            : "Please enter your phone number",
    validationPhoneTooShort:
      lang === "ru"
        ? "Номер слишком короткий. Минимум {min}."
        : lang === "de"
          ? "Telefonnummer zu kurz. Minimum {min}."
          : lang === "pl"
            ? "Numer jest za krótki. Minimum {min}."
            : "Phone number is too short. Minimum {min}.",
    validationPhoneTooLong:
      lang === "ru"
        ? "Номер слишком длинный. Максимум {max}."
        : lang === "de"
          ? "Telefonnummer zu lang. Maximum {max}."
          : lang === "pl"
            ? "Numer jest za długi. Maksimum {max}."
            : "Phone number is too long. Maximum {max}.",
    validationPhoneInvalid:
      lang === "ru"
        ? "Некорректный номер телефона"
        : lang === "de"
          ? "Ungültige Telefonnummer"
          : lang === "pl"
            ? "Nieprawidłowy numer telefonu"
            : "Invalid phone number",
    validationEmailInvalid:
      lang === "ru"
        ? "Некорректный email"
        : lang === "de"
          ? "Ungültige E-Mail-Adresse"
          : lang === "pl"
            ? "Nieprawidłowy adres e-mail"
            : "Invalid email address",
    validationEmailRequired:
      lang === "ru"
        ? "Введите email"
        : lang === "de"
          ? "Bitte E-Mail eingeben"
          : lang === "pl"
            ? "Wpisz e-mail"
            : "Please enter your email",
    validationAgreementRequired:
      lang === "ru"
        ? "Подтвердите согласие"
        : lang === "de"
          ? "Bitte Zustimmung bestätigen"
          : lang === "pl"
            ? "Potwierdź zgodę"
            : "Please confirm consent",
    validationAgreementOneOf:
      lang === "ru"
        ? "Необходимо принять политику"
        : lang === "de"
          ? "Bitte akzeptieren Sie die Richtlinie"
          : lang === "pl"
            ? "Musisz zaakceptować politykę"
            : "You must accept the policy",
    agreementText:
      lang === "ru"
        ? "Я принимаю"
        : lang === "de"
          ? "Ich akzeptiere"
          : lang === "pl"
            ? "Akceptuję"
            : "I accept",
    agreementLinkDestination: "/privacy-policy",
    agreementLinkLabel:
      lang === "ru"
        ? "политику конфиденциальности"
        : lang === "de"
          ? "die Datenschutzerklärung"
          : lang === "pl"
            ? "politykę prywatności"
            : "the privacy policy",
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const f = formikRef.current;
      const fields = ["name", "surname", "email"] as const;

      fields.forEach((field) => {
        const input = document.querySelector(
          `[name="${field}"]`,
        ) as HTMLInputElement | null;

        const domVal = input?.value?.trim() ?? "";
        const hasValue = Boolean(domVal);

        if (f && domVal && !String(f.values[field] ?? "").trim()) {
          f.setFieldValue(field, domVal, false);
        }

        setFilled((prev) =>
          prev[field] === hasValue ? prev : { ...prev, [field]: hasValue },
        );
      });

      const phoneEl = document.querySelector(
        `[name="phone"]`,
      ) as HTMLInputElement | null;

      const domPhone = phoneEl?.value?.trim() ?? "";
      const phoneHasValue = Boolean(domPhone);

      if (f && domPhone && !String(f.values.phone ?? "").trim()) {
        f.setFieldValue("phone", domPhone, false);
      }

      setFilled((prev) =>
        prev.phone === phoneHasValue ? prev : { ...prev, phone: phoneHasValue },
      );
    }, 200);

    if (formStartTime === 0) {
      setFormStartTime(Date.now());
    }

    return () => clearInterval(interval);
  }, [formStartTime]);

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilled((prev) => ({ ...prev, [name]: value.trim() !== "" }));
  };

  const initialValues: FormData = {
    name: "",
    surname: "",
    phone: "",
    email: "",
    preferredContact: "",
    agreedToPolicy: false,
    fax: "",
    formStartTime: 0,
  };

  const validationSchema = Yup.object({
    name: Yup.string()
      .transform((v) => (typeof v === "string" ? v.trim() : v))
      .required(copy.validationNameRequired)
      .test("name-min", function (value) {
        const current = (value ?? "").trim().length;
        if (current >= NAME_MIN) return true;
        return this.createError({
          message: tpl(copy.validationNameTooShort, { min: NAME_MIN, current }),
        });
      })
      .test("name-max", function (value) {
        const current = (value ?? "").trim().length;
        if (current <= NAME_MAX) return true;
        return this.createError({
          message: tpl(copy.validationNameTooLong, { max: NAME_MAX, current }),
        });
      }),

    surname: Yup.string()
      .transform((v) => (typeof v === "string" ? v.trim() : v))
      .required(copy.validationSurnameRequired)
      .test("surname-min", function (value) {
        const current = (value ?? "").trim().length;
        if (current >= SURNAME_MIN) return true;
        return this.createError({
          message: tpl(copy.validationSurnameTooShort, {
            min: SURNAME_MIN,
            current,
          }),
        });
      })
      .test("surname-max", function (value) {
        const current = (value ?? "").trim().length;
        if (current <= SURNAME_MAX) return true;
        return this.createError({
          message: tpl(copy.validationSurnameTooLong, {
            max: SURNAME_MAX,
            current,
          }),
        });
      }),

    phone: Yup.string()
      .required(copy.validationPhoneRequired)
      .test("phone-min", function (value) {
        const current = String(value ?? "").trim().length;
        if (current >= PHONE_MIN) return true;
        return this.createError({
          message: tpl(copy.validationPhoneTooShort, {
            min: PHONE_MIN,
            current,
          }),
        });
      })
      .test("phone-max", function (value) {
        const current = String(value ?? "").trim().length;
        if (current <= PHONE_MAX) return true;
        return this.createError({
          message: tpl(copy.validationPhoneTooLong, {
            max: PHONE_MAX,
            current,
          }),
        });
      })
      .test("phone-format", function (value) {
        const v = String(value ?? "").trim();
        if (!v) return true;
        const ok = /^[+0-9()\-\s]{7,25}$/.test(v);
        if (ok) return true;
        return this.createError({ message: copy.validationPhoneInvalid });
      }),

    email: Yup.string()
      .transform((v) => (typeof v === "string" ? v.trim() : v))
      .email(copy.validationEmailInvalid)
      .required(copy.validationEmailRequired),

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
      .required(copy.validationAgreementRequired)
      .oneOf([true], copy.validationAgreementOneOf),
  });

  const onSubmit = async (
    values: FormData,
    { setSubmitting, resetForm }: FormikHelpers<FormData>,
  ) => {
    setSubmitting(true);

    try {
      const currentPage = window.location.href;
      const response = await axios.post("/api/roi-calculator", {
        name: values.name,
        surname: values.surname,
        phone: values.phone || "",
        email: values.email,
        preferredContact: values.preferredContact,
        formStartTime,
        fax: values.fax,
        lang,
        currentPage,
        strategy,
        scenario,
        inputs: {
          purchasePrice: input.purchasePrice,
          furnishingCost: input.furnishingCost,
          buildPeriodYears: input.buildPeriodYears,
          offPlanGrowth: input.offPlanGrowth,
          sellingCostsPercent: input.sellingCostsPercent,
          netYieldYearOne: input.netYieldYearOne,
          annualRentGrowth: input.annualRentGrowth,
          rentalPeriodYears: input.rentalPeriodYears,
          annualAppreciation: input.annualAppreciation,
        },
        result: {
          purchaseCostWithFees: result.purchaseCostWithFees,
          totalEntryCost: result.totalEntryCost,
          futureSalePrice: result.futureSalePrice,
          sellingCosts: result.sellingCosts,
          netProfit: result.netProfit,
          roiPercent: result.roiPercent,
          annualizedRoiPercent: result.annualizedRoiPercent,
        },
      });

      if (response.status === 200 && response.data?.ok === true) {
        // Meta Pixel Lead
        if (typeof window !== "undefined" && window.fbq) {
          window.fbq("track", "Lead", {
            form_name: "roi_form",
            page_location: currentPage,
            preferred_contact: values.preferredContact,
            roi_strategy: strategy,
            roi_scenario: scenario,
          });
        }
        resetForm({});
        setFilled({ name: false, surname: false, phone: false, email: false });

        if (typeof window !== "undefined" && (window as any).dataLayer) {
          (window as any).dataLayer.push({
            event: "roi_calculation_sent",
            form_name: "roi_form",
            page_url: window.location.href,
            roi_strategy: strategy,
            roi_scenario: scenario,
          });
        }

        onFormSubmitSuccess?.();
        setMessage(copy.successMessage);
        setTimeout(() => setMessage(null), 5000);
      } else {
        throw new Error("roi_submit_failed");
      }
    } catch (error: any) {
      console.error("ROI form error:", error);
      console.log("ROI API response:", error?.response?.data);

      const apiMessage =
        error?.response?.data?.details?.message ||
        error?.response?.data?.error ||
        copy.errorMessage;

      setMessage(apiMessage);
      setTimeout(() => setMessage(null), 7000);
    } finally {
      setSubmitting(false);
    }
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
        {({ isSubmitting, setFieldValue, values }) => (
          <Form>
            <div className={styles.nameSurnameWrapper}>
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
                  className={`${styles.label} ${filled.name ? styles.filled : ""}`}
                >
                  {copy.inputName}
                </label>
                <Field name="name">
                  {({ field }: any) => (
                    <input
                      {...field}
                      id={`${uid}-name`}
                      type="text"
                      className={styles.inputField}
                      onBlur={(e) => {
                        field.onBlur(e);
                        handleBlur(e as any);
                      }}
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
                  className={`${styles.label} ${filled.surname ? styles.filled : ""}`}
                >
                  {copy.inputSurname}
                </label>
                <Field name="surname">
                  {({ field }: any) => (
                    <input
                      {...field}
                      id={`${uid}-surname`}
                      type="text"
                      className={styles.inputField}
                      onBlur={(e) => {
                        field.onBlur(e);
                        handleBlur(e as any);
                      }}
                      autoComplete="family-name"
                    />
                  )}
                </Field>
                <ErrorMessage
                  name="surname"
                  component="div"
                  className={styles.error}
                />
              </div>
            </div>

            <div className={styles.inputWrapper}>
              <label
                htmlFor={`${uid}-phone`}
                className={`${styles.label} ${styles.labelPhone} ${filled.phone ? styles.filled : ""}`}
              >
                {copy.inputPhone}
              </label>
              <PhoneInput
                id={`${uid}-phone`}
                name="phone"
                className={`${styles.inputField} ${styles.phoneInput}`}
                value={values.phone}
                onChange={(value) => {
                  setFieldValue("phone", value);
                  setFilled((f) => ({ ...f, phone: Boolean(value) }));
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
                className={`${styles.label} ${filled.email ? styles.filled : ""}`}
              >
                {copy.inputEmail}
              </label>
              <Field name="email">
                {({ field }: any) => (
                  <input
                    {...field}
                    id={`${uid}-email`}
                    type="email"
                    className={styles.inputField}
                    onBlur={(e) => {
                      field.onBlur(e);
                      handleBlur(e as any);
                    }}
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
              <p className={styles.radioGroupLabel}>
                {lang === "ru"
                  ? "Как с вами лучше связаться?"
                  : lang === "de"
                    ? "Wie können wir Sie am besten kontaktieren?"
                    : lang === "pl"
                      ? "W jaki sposób najlepiej się z Tobą skontaktować?"
                      : "What’s the best way to contact you?"}
              </p>
              <div className={styles.radioGroupWrapper}>
                <label className={styles.radioOption}>
                  <Field type="radio" name="preferredContact" value="phone" />
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
                  <Field type="radio" name="preferredContact" value="email" />
                  <span>
                    {lang === "ru"
                      ? "Email"
                      : lang === "de"
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

            <div>
              <button
                type="submit"
                className={styles.sentBtn}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className={styles.loader}></div>
                ) : offerButtonCustomText ? (
                  offerButtonCustomText
                ) : (
                  copy.buttonText
                )}
              </button>
            </div>

            <Field
              type="text"
              name="fax"
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
                {copy.agreementText}{" "}
                <Link
                  className={styles.policyLink}
                  href={copy.agreementLinkDestination!}
                  target="_blank"
                >
                  {copy.agreementLinkLabel}
                </Link>
              </label>
            </div>
          </Form>
        )}
      </Formik>
    </>
  );
};

export default FormRoi;
