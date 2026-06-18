// PhoneField.tsx
"use client";

import { FC, useId } from "react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { useFormikContext } from "formik";

// 🔥 используем те же стили, что и в FormStandard
import styles from "../../FormStandard/FormStandard.module.scss";

type Props = {
  name?: string; // по умолчанию "phone"
  label: string; // текст лейбла (dataForm.inputPhone)
};

const PhoneField: FC<Props> = ({ name = "phone", label }) => {
  const uid = useId();
  const { values, setFieldValue, errors, touched } = useFormikContext<any>();

  const id = `${uid}-${name}`;
  const value = values?.[name] ?? "";
  const hasValue = Boolean(value);
  const error = errors?.[name] as string | undefined;
  const isTouched = touched?.[name];

  return (
    <div className={styles.inputWrapper}>
      <label
        htmlFor={id}
        className={`${styles.label} ${styles.labelPhone} ${
          hasValue ? styles.filled : ""
        }`}
      >
        {label}
      </label>

      <PhoneInput
        id={id}
        name={name}
        className={`${styles.inputField} ${styles.phoneInput}`}
        value={value}
        onChange={(val) => setFieldValue(name, val)}
      />

      {isTouched && error && <div className={styles.error}>{error}</div>}
    </div>
  );
};

export default PhoneField;
