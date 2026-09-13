"use client";
import { getAttribution } from "@/lib/attribution";

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
import "../formFeedback.css";
import { formErrorText } from "../formFeedbackCopy";
import { consentCopy } from "../consentCopy";
import { formRoiCopy } from "./FormRoi.copy";
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
  /* The shared banner draws a tick; on a failure that contradicts the
     words next to it. See formFeedback.css. */
  const [messageIsError, setMessageIsError] = useState(false);
  const [filled, setFilled] = useState({
    name: false,
    surname: false,
    phone: false,
    email: false,
  });

  const [formStartTime, setFormStartTime] = useState(0);
  const formikRef = useRef<FormikProps<FormData> | null>(null);

  const copy = { ...formRoiCopy(lang), errorMessage: formErrorText(lang) };

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
      .required(copy.contactMethodRequired),

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
        ...getAttribution(),
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
        setMessageIsError(false);
        setMessage(copy.successMessage);
        setTimeout(() => setMessage(null), 10000);
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

      setMessageIsError(true);
      setMessage(apiMessage);
      setTimeout(() => setMessage(null), 12000);
    } finally {
      setSubmitting(false);
    }
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
                <div className={styles.errorSlot}>
                  <ErrorMessage name="surname">
                    {(msg) => <div className={styles.error}>{msg}</div>}
                  </ErrorMessage>
                </div>
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
              <div className={styles.errorSlot}>
                <ErrorMessage name="email">
                  {(msg) => <div className={styles.error}>{msg}</div>}
                </ErrorMessage>
              </div>
            </div>

            <fieldset className={`${styles.inputWrapper} min-w-0`}>
              <legend className={styles.radioGroupLabel}>
                {copy.contactMethodLegend}
              </legend>
              <div className={styles.radioGroupWrapper}>
                <label className={styles.radioOption}>
                  <Field type="radio" name="preferredContact" value="phone" />
                  <span>{copy.phoneCallLabel}</span>
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
                  <span>{copy.emailRadioLabel}</span>
                </label>
              </div>

              <div className={styles.errorSlot}>
                <ErrorMessage name="preferredContact">
                  {(msg) => <div className={styles.error}>{msg}</div>}
                </ErrorMessage>
              </div>
            </fieldset>

            <div>
              <button
                type="submit"
                className={styles.sentBtn}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className={`${styles.loader} form-spinner`}></div>
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
                {consentCopy(lang).lead}
                <Link className={styles.policyLink} href={consentCopy(lang).termsHref} target="_blank">
                  {consentCopy(lang).termsLabel}
                </Link>
                {consentCopy(lang).mid}
                <Link className={styles.policyLink} href={consentCopy(lang).privacyHref} target="_blank">
                  {consentCopy(lang).privacyLabel}
                </Link>
                {consentCopy(lang).tail}
              </label>
            </div>
          </Form>
        )}
      </Formik>
    </>
  );
};

export default FormRoi;
