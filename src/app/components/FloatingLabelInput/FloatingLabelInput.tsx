"use client";
import React, {
  useState,
  ChangeEvent,
  FocusEvent,
  useEffect,
  forwardRef,
} from "react";
import styles from "./FloatingLabelInput.module.scss";

export type FloatingLabelInputProps = {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
};

const FloatingLabelInput = forwardRef<
  HTMLInputElement,
  FloatingLabelInputProps
>(
  (
    {
      label,
      name,
      type = "text",
      defaultValue = "",
      value,
      onChange,
      className,
    },
    ref
  ) => {
    const [innerValue, setInnerValue] = useState(defaultValue);
    const isControlled = value !== undefined;
    const currentValue = isControlled ? value! : innerValue;

    const [focused, setFocused] = useState(Boolean(currentValue));

    useEffect(() => {
      if (!isControlled) {
        setInnerValue(defaultValue);
      }
    }, [defaultValue, isControlled]);

    useEffect(() => {
      setFocused(Boolean(currentValue));
    }, [currentValue]);

    const handleFocus = () => setFocused(true);
    const handleBlur = () => {};
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) setInnerValue(e.target.value);
      onChange?.(e);
    };

    return (
      <div className={`${styles.inputContainer} ${className ?? ""}`}>
        <input
          ref={ref}
          id={name}
          name={name}
          type={type}
          value={currentValue}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          className={styles.inputField}
        />
        <label
          htmlFor={name}
          className={`${styles.floatingLabel} ${focused ? styles.active : ""}`}
        >
          {label}
        </label>
      </div>
    );
  }
);

FloatingLabelInput.displayName = "FloatingLabelInput";
export default FloatingLabelInput;
