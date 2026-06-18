"use client";

import React from "react";
import styles from "./roi-calculator.module.scss";
import { RoiCalculatorInput, RoiStrategy } from "@/lib/roi";
import RoiRangeField from "./RoiRangeField";

type Props = {
  input: RoiCalculatorInput;
  strategy: RoiStrategy;
  lang: string;
  onChange: React.Dispatch<React.SetStateAction<RoiCalculatorInput>>;
};

const RoiInputs: React.FC<Props> = ({ input, strategy, lang, onChange }) => {
  const t = {
    purchasePrice:
      lang === "pl"
        ? "Cena nieruchomości"
        : lang === "de"
          ? "Kaufpreis"
          : lang === "ru"
            ? "Цена недвижимости"
            : "Property price",

    furnishing:
      lang === "pl"
        ? "Koszt wyposażenia"
        : lang === "de"
          ? "Ausstattungskosten"
          : lang === "ru"
            ? "Стоимость меблировки"
            : "Furnishing cost",

    buildPeriod:
      lang === "pl"
        ? "Czas budowy"
        : lang === "de"
          ? "Bauzeit"
          : lang === "ru"
            ? "Срок строительства"
            : "Build period",

    offPlanGrowth:
      lang === "pl"
        ? "Wzrost w budowie (rocznie)"
        : lang === "de"
          ? "Wachstum während der Bauphase"
          : lang === "ru"
            ? "Рост на этапе строительства"
            : "Annual off-plan growth",

    sellingCosts:
      lang === "pl"
        ? "Koszty sprzedaży"
        : lang === "de"
          ? "Verkaufskosten"
          : lang === "ru"
            ? "Расходы на продажу"
            : "Selling costs",

    rentalSection:
      lang === "pl"
        ? "Parametry najmu"
        : lang === "de"
          ? "Mietparameter"
          : lang === "ru"
            ? "Параметры аренды"
            : "Rental parameters",

    netYieldYearOne:
      lang === "pl"
        ? "Yield netto (rok 1)"
        : lang === "de"
          ? "Netto-Rendite (Jahr 1)"
          : lang === "ru"
            ? "Чистая доходность (год 1)"
            : "Net yield (year 1)",

    annualRentGrowth:
      lang === "pl"
        ? "Wzrost czynszu rocznie"
        : lang === "de"
          ? "Jährliches Mietwachstum"
          : lang === "ru"
            ? "Рост аренды в год"
            : "Annual rent growth",

    rentalPeriodYears:
      lang === "pl"
        ? "Okres najmu po oddaniu"
        : lang === "de"
          ? "Mietdauer nach Fertigstellung"
          : lang === "ru"
            ? "Срок аренды после сдачи"
            : "Rental period after completion",

    annualAppreciation:
      lang === "pl"
        ? "Aprecjacja roczna"
        : lang === "de"
          ? "Jährliche Wertsteigerung"
          : lang === "ru"
            ? "Годовой рост стоимости"
            : "Annual appreciation",
  };

  const yearsUnit =
    lang === "pl"
      ? "lat"
      : lang === "de"
        ? "J."
        : lang === "ru"
          ? "лет"
          : "yrs";

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  const updateField = <K extends keyof RoiCalculatorInput>(
    field: K,
    value: RoiCalculatorInput[K],
  ) => {
    onChange((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className={styles.inputs}>
      <RoiRangeField
        label={t.purchasePrice}
        value={input.purchasePrice}
        min={50000}
        max={2000000}
        step={1000}
        unit="€"
        onChange={(value) => updateField("purchasePrice", value)}
      />

      <RoiRangeField
        label={t.furnishing}
        value={input.furnishingCost}
        min={0}
        max={50000}
        step={1000}
        unit="€"
        onChange={(value) => updateField("furnishingCost", value)}
      />

      <RoiRangeField
        label={t.buildPeriod}
        value={Number(input.buildPeriodYears.toFixed(1))}
        min={1}
        max={5}
        step={0.1}
        unit={yearsUnit}
        onChange={(value) =>
          updateField("buildPeriodYears", clamp(value, 1, 5))
        }
      />

      <RoiRangeField
        label={t.offPlanGrowth}
        value={Number((input.offPlanGrowth * 100).toFixed(1))}
        min={5}
        max={20}
        step={0.1}
        unit="%"
        onChange={(value) =>
          updateField("offPlanGrowth", clamp(value, 5, 20) / 100)
        }
      />

      {strategy === "buyHold" && (
        <>
          <div className={styles.inputsSection}>
            <div className={styles.inputsSectionTitle}>{t.rentalSection}</div>
          </div>

          <RoiRangeField
            label={t.netYieldYearOne}
            value={Number((input.netYieldYearOne * 100).toFixed(1))}
            min={2}
            max={12}
            step={0.1}
            unit="%"
            onChange={(value) =>
              updateField("netYieldYearOne", clamp(value, 2, 12) / 100)
            }
          />

          <RoiRangeField
            label={t.annualRentGrowth}
            value={Number((input.annualRentGrowth * 100).toFixed(1))}
            min={0}
            max={8}
            step={0.1}
            unit="%"
            onChange={(value) =>
              updateField("annualRentGrowth", clamp(value, 0, 8) / 100)
            }
          />

          <RoiRangeField
            label={t.rentalPeriodYears}
            value={input.rentalPeriodYears}
            min={1}
            max={20}
            step={1}
            unit={yearsUnit}
            onChange={(value) =>
              updateField("rentalPeriodYears", clamp(value, 1, 20))
            }
          />

          <RoiRangeField
            label={t.annualAppreciation}
            value={Number((input.annualAppreciation * 100).toFixed(1))}
            min={1}
            max={12}
            step={0.1}
            unit="%"
            onChange={(value) =>
              updateField("annualAppreciation", clamp(value, 1, 12) / 100)
            }
          />
        </>
      )}

      <RoiRangeField
        label={t.sellingCosts}
        value={Number((input.sellingCostsPercent * 100).toFixed(1))}
        min={2}
        max={6}
        step={0.1}
        unit="%"
        onChange={(value) =>
          updateField("sellingCostsPercent", clamp(value, 2, 6) / 100)
        }
      />
    </div>
  );
};

export default RoiInputs;
