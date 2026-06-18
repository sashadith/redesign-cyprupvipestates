"use client";
import React, { useState, FocusEvent, useEffect } from "react";
import Select, {
  StylesConfig,
  SingleValue,
  MultiValue,
  ActionMeta,
} from "react-select";
import styles from "./FloatingSelect.module.scss";

export type OptionType = { label: string; value: string };

type FloatingSelectProps = {
  label: string;
  name: string;
  options: OptionType[];
  value?: OptionType | null;
  onChange?: (option: SingleValue<OptionType>) => void;
};

const FloatingSelect: React.FC<FloatingSelectProps> = ({
  label,
  name,
  options,
  value = null,
  onChange,
}) => {
  const [focused, setFocused] = useState(false);

  const handleFocus = () => setFocused(true);
  const handleBlur = (e: FocusEvent) => {
    if (!value || value.value === "") {
      setFocused(false);
    }
  };

  const handleChange = (
    newValue: SingleValue<OptionType> | MultiValue<OptionType>,
    actionMeta: ActionMeta<OptionType>
  ) => {
    const singleOption = newValue as SingleValue<OptionType>;
    if (onChange) {
      onChange(singleOption);
    }
  };

  const customStyles: StylesConfig<OptionType> = {
    control: (provided, state) => ({
      ...provided,
      minHeight: "48px",
      height: "48px",
      borderColor: state.isFocused ? "#bd8948" : "#ccc",
      boxShadow: state.isFocused ? "0 0 0 1px #bd8948" : "none",
      "&:hover": { borderColor: state.isFocused ? "#bd8948" : "#aaa" },
      padding: "0 5px",
    }),
    valueContainer: (provided) => ({
      ...provided,
      padding: "1rem 0.5rem 0.5rem",
    }),
    dropdownIndicator: (provided) => ({
      ...provided,
    }),
    indicatorSeparator: (provided) => ({
      ...provided,
      height: "60%",
    }),
    singleValue: (provided) => ({
      ...provided,
      marginTop: "-10px",
    }),
    clearIndicator: (provided) => ({
      ...provided,
    }),
    input: (provided) => ({
      ...provided,
      marginTop: "-8px",
    }),
    placeholder: (provided) => ({
      ...provided,
      display: "none",
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 3,
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? "#bd8948"
        : state.isFocused
          ? "rgba(170, 127, 46, 0.2)"
          : provided.backgroundColor,
      color: state.isSelected ? "#fff" : "#000",
      cursor: "pointer",
      ":active": {
        backgroundColor: "#bd8948",
      },
    }),
  };

  useEffect(() => {
    // активируем лейбл, если есть выбранная опция (включая value === "")
    if (value) {
      setFocused(true);
    } else {
      setFocused(false);
    }
  }, [value]);

  return (
    <div className={styles.selectContainer}>
      <Select
        name={name}
        options={options}
        value={value ?? null}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        styles={customStyles}
        isClearable
      />
      <label
        htmlFor={name}
        className={`${styles.floatingLabel} ${
          focused || value ? styles.active : ""
        }`}
      >
        {label}
      </label>
    </div>
  );
};

export default FloatingSelect;
