"use client";

import React from "react";
import styles from "./roi-calculator.module.scss";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  displayValue?: number | string;
};

const RoiRangeField: React.FC<Props> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  displayValue,
}) => {
  const safeDisplayValue = displayValue ?? value;

  const handleInputChange = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    onChange(Math.min(Math.max(parsed, min), max));
  };

  const handleRangeChange = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    onChange(parsed);
  };

  return (
    <div className={styles.rangeField}>
      <div className={styles.rangeFieldTop}>
        <label>{label}</label>

        <div className={styles.rangeFieldInputWrap}>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={safeDisplayValue}
            onChange={(e) => handleInputChange(e.target.value)}
            className={styles.rangeFieldInput}
          />
          {unit && <span className={styles.rangeFieldUnit}>{unit}</span>}
        </div>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => handleRangeChange(e.target.value)}
        className={styles.rangeSlider}
      />

      <div className={styles.rangeFieldBottom}>
        <span>
          {min}
          {unit ? ` ${unit}` : ""}
        </span>
        <span>
          {max}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
    </div>
  );
};

export default RoiRangeField;
