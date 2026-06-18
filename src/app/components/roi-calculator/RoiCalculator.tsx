"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./roi-calculator.module.scss";
import { Project } from "@/types/project";
import {
  RoiCalculatorInput,
  RoiScenario,
  RoiStrategy,
  calculateBuyHold,
  calculateBuySell,
  mapProjectToCalculatorInput,
} from "@/lib/roi";
import RoiInputs from "./RoiInputs";
import RoiResults from "./RoiResults";
import RoiChart from "./RoiChart";
import ModalRoi from "../ModalRoi/ModalRoi";

type Props = {
  project?: Project | null;
  lang: string;
  isInModal?: boolean;
};

const RoiCalculator: React.FC<Props> = ({
  project,
  lang,
  isInModal = false,
}) => {
  const [strategy, setStrategy] = useState<RoiStrategy>("buyHold");
  const [scenario, setScenario] = useState<RoiScenario>("realistic");

  const [input, setInput] = useState<RoiCalculatorInput>(() =>
    mapProjectToCalculatorInput(project, "buyHold", "realistic"),
  );

  useEffect(() => {
    setInput(mapProjectToCalculatorInput(project, strategy, scenario));
  }, [project, strategy, scenario]);

  const result = useMemo(() => {
    return strategy === "buyHold"
      ? calculateBuyHold(input)
      : calculateBuySell(input);
  }, [strategy, input]);

  const labels = {
    title:
      lang === "pl"
        ? "Kalkulator ROI"
        : lang === "de"
          ? "ROI-Rechner"
          : lang === "ru"
            ? "Калькулятор ROI"
            : "ROI Calculator",
    subtitle:
      lang === "pl"
        ? "Szacunkowa kalkulacja oparta na warunkach rynkowych nowych nieruchomości na Cyprze"
        : lang === "de"
          ? "Geschätzte Kalkulation auf Basis der Marktbedingungen für Neubauten auf Zypern"
          : lang === "ru"
            ? "Ориентировочный расчет на основе рыночных условий для новостроек на Кипре"
            : "Estimated calculation based on Cyprus new-build market conditions",
    buyHold: "Buy & Hold",
    buySell: "Buy & Sell",
    conservative:
      lang === "pl"
        ? "Konserwatywny"
        : lang === "de"
          ? "Konservativ"
          : lang === "ru"
            ? "Консервативный"
            : "Conservative",
    realistic:
      lang === "pl"
        ? "Realistyczny"
        : lang === "de"
          ? "Realistisch"
          : lang === "ru"
            ? "Реалистичный"
            : "Realistic",
    optimistic:
      lang === "pl"
        ? "Optymistyczny"
        : lang === "de"
          ? "Optimistisch"
          : lang === "ru"
            ? "Оптимистичный"
            : "Optimistic",
    disclaimer:
      lang === "pl"
        ? "Wyniki mają charakter orientacyjny i zależą od ceny zakupu, stawki VAT, okresu utrzymania, kosztów sprzedaży i warunków rynkowych."
        : lang === "de"
          ? "Die Ergebnisse sind unverbindliche Schätzungen und hängen von Kaufpreis, MwSt.-Satz, Haltedauer, Verkaufskosten und Marktbedingungen ab."
          : lang === "ru"
            ? "Результаты являются ориентировочными и зависят от цены покупки, ставки НДС, срока владения, расходов на продажу и рыночных условий."
            : "Results are indicative only and depend on purchase price, VAT rate, holding period, selling costs and market conditions.",
    cta:
      lang === "pl"
        ? "Uzyskaj konsultację inwestycyjną"
        : lang === "de"
          ? "Investmentberatung anfragen"
          : lang === "ru"
            ? "Получить инвестиционную консультацию"
            : "Get investment consultation",
  };

  return (
    <section
      className={styles.roiCalculator}
      style={isInModal ? { padding: 0, background: "transparent" } : undefined}
    >
      <div className="container">
        {!isInModal && (
          <div className={styles.header}>
            <h2 className={styles.title}>{labels.title}</h2>
            <p className={styles.subtitle}>{labels.subtitle}</p>
          </div>
        )}

        <div className={styles.topControls}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${strategy === "buyHold" ? styles.active : ""}`}
              onClick={() => setStrategy("buyHold")}
            >
              {labels.buyHold}
            </button>
            <button
              type="button"
              className={`${styles.tab} ${strategy === "buySell" ? styles.active : ""}`}
              onClick={() => setStrategy("buySell")}
            >
              {labels.buySell}
            </button>
          </div>

          <div className={styles.scenarios}>
            <button
              type="button"
              className={`${styles.scenario} ${scenario === "conservative" ? styles.active : ""}`}
              onClick={() => setScenario("conservative")}
            >
              {labels.conservative}
            </button>
            <button
              type="button"
              className={`${styles.scenario} ${scenario === "realistic" ? styles.active : ""}`}
              onClick={() => setScenario("realistic")}
            >
              {labels.realistic}
            </button>
            <button
              type="button"
              className={`${styles.scenario} ${scenario === "optimistic" ? styles.active : ""}`}
              onClick={() => setScenario("optimistic")}
            >
              {labels.optimistic}
            </button>
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.leftColumn}>
            <RoiInputs
              input={input}
              strategy={strategy}
              lang={lang}
              onChange={setInput}
            />
            <RoiChart result={result} strategy={strategy} lang={lang} />
          </div>

          <div className={styles.rightColumn}>
            <RoiResults
              result={result}
              strategy={strategy}
              lang={lang}
              ctaLabel={labels.cta}
              inputBuildPeriodYears={input.buildPeriodYears}
              inputRentalPeriodYears={input.rentalPeriodYears}
            />
          </div>
        </div>

        <div className={styles.disclaimer}>{labels.disclaimer}</div>
      </div>
      <ModalRoi
        lang={lang}
        strategy={strategy}
        scenario={scenario}
        input={input}
        result={result}
      />
    </section>
  );
};

export default RoiCalculator;
