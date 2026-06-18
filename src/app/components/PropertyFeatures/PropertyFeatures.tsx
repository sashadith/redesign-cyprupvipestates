import React, { FC } from "react";
import styles from "./PropertyFeatures.module.scss";
import { PropertyType } from "@/types/homepage";
import { KeyFeatures } from "@/types/project";
import { formatMonthYear } from "@/lib/formatMonthYear";

const cityTranslations: {
  [city in "Paphos" | "Limassol" | "Larnaca"]: {
    en: string;
    de: string;
    pl: string;
    ru: string;
  };
} = {
  Paphos: {
    en: "Paphos",
    de: "Paphos",
    pl: "Pafos",
    ru: "Пафос",
  },
  Limassol: {
    en: "Limassol",
    de: "Limassol",
    pl: "Limassol",
    ru: "Лимассол",
  },
  Larnaca: {
    en: "Larnaca",
    de: "Larnaca",
    pl: "Larnaca",
    ru: "Ларнака",
  },
};

type Props = {
  keyFeatures: KeyFeatures;
  lang: string;
};

const PropertyFeatures: FC<Props> = ({ keyFeatures, lang }) => {
  if (!keyFeatures) {
    return <div>Нет данных о ключевых особенностях</div>;
  }
  const completion = keyFeatures.completionDate
    ? formatMonthYear(keyFeatures.completionDate, lang, { capitalize: true })
    : null;
  return (
    <section className={styles.propertyFeatures}>
      <div className={styles.propertyFeaturesInner}>
        <p className={styles.featuresTitle}>
          {lang === "en"
            ? "Project overview"
            : lang === "de"
              ? "Projektübersicht"
              : lang === "pl"
                ? "Przegląd projektu"
                : lang === "ru"
                  ? "Обзор проекта"
                  : "Project overview"}
        </p>
        <div className={styles.features}>
          <div className={styles.featuresWrapper}>
            <div className={styles.feature}>
              <div className={styles.featureText}>
                {lang === "en"
                  ? "City"
                  : lang === "de"
                    ? "Stadt"
                    : lang === "pl"
                      ? "Miasto"
                      : lang === "ru"
                        ? "Город"
                        : "City"}
              </div>
              {keyFeatures.city ? (
                <div className={styles.featureValue}>
                  {(
                    cityTranslations[keyFeatures.city] as {
                      en: string;
                      de: string;
                      pl: string;
                      ru: string;
                    }
                  )[lang as "en" | "de" | "pl" | "ru"] || keyFeatures.city}
                </div>
              ) : (
                <div className={styles.featureNoValue}>
                  {lang === "en"
                    ? "Not available"
                    : lang === "de"
                      ? "Nicht verfügbar"
                      : lang === "pl"
                        ? "Niedostępne"
                        : lang === "ru"
                          ? "Недоступно"
                          : "Not available"}
                </div>
              )}
            </div>
            <div className={styles.feature}>
              <div className={styles.featureText}>
                {lang === "en"
                  ? "Type"
                  : lang === "de"
                    ? "Typ"
                    : lang === "pl"
                      ? "Typ"
                      : lang === "ru"
                        ? "Тип"
                        : "Type"}
              </div>
              {keyFeatures.propertyType ? (
                <div className={styles.featureValue}>
                  {keyFeatures.propertyType}
                </div>
              ) : (
                <div className={styles.featureNoValue}>
                  {lang === "en"
                    ? "Not available"
                    : lang === "de"
                      ? "Nicht verfügbar"
                      : lang === "pl"
                        ? "Niedostępne"
                        : lang === "ru"
                          ? "Недоступно"
                          : "Not available"}
                </div>
              )}
            </div>
            <div className={styles.feature}>
              <div className={styles.featureText}>
                {lang === "en"
                  ? "Bedrooms"
                  : lang === "de"
                    ? "Schlafzimmer"
                    : lang === "pl"
                      ? "Sypialnie"
                      : lang === "ru"
                        ? "Спальни"
                        : "Bedrooms"}
              </div>
              <div className={styles.featureValue}>{keyFeatures.bedrooms}</div>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureText}>
                {lang === "en"
                  ? "Covered area"
                  : lang === "de"
                    ? "Überdachte Fläche"
                    : lang === "pl"
                      ? "Powierzchnia zadaszona"
                      : lang === "ru"
                        ? "Площадь крытая"
                        : "Covered area"}
              </div>
              <div className={styles.featureValue}>
                {keyFeatures.coveredArea}
                {lang === "en"
                  ? " m²"
                  : lang === "de"
                    ? " m²"
                    : lang === "pl"
                      ? " m²"
                      : lang === "ru"
                        ? " м²"
                        : " m²"}
              </div>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureText}>
                {lang === "en"
                  ? "Plot size"
                  : lang === "de"
                    ? "Grundstück"
                    : lang === "pl"
                      ? "Powierzchnia działki"
                      : lang === "ru"
                        ? "Площадь участка"
                        : "Plot size"}
              </div>
              <div className={styles.featureValue}>
                {keyFeatures.plotSize}
                {lang === "en"
                  ? " m²"
                  : lang === "de"
                    ? " m²"
                    : lang === "pl"
                      ? " m²"
                      : lang === "ru"
                        ? " м²"
                        : " m²"}
              </div>
            </div>
            {keyFeatures.energyEfficiency && (
              <div className={styles.feature}>
                <div className={styles.featureText}>
                  {lang === "en"
                    ? "Energy efficiency"
                    : lang === "de"
                      ? "Energieeffizienz"
                      : lang === "pl"
                        ? "Efektywność energetyczna"
                        : lang === "ru"
                          ? "Энергоэффективность"
                          : "Energy efficiency"}
                </div>
                <div className={styles.featureValue}>
                  {keyFeatures.energyEfficiency}
                </div>
              </div>
            )}
            {completion && (
              <div className={styles.feature}>
                <div className={styles.featureText}>
                  {lang === "en"
                    ? "Completion month"
                    : lang === "de"
                      ? "Fertigstellungsmonat"
                      : lang === "pl"
                        ? "Miesiąc zakończenia"
                        : lang === "ru"
                          ? "Месяц завершения"
                          : "Completion month"}
                </div>
                <div className={styles.featureValue}>{completion}</div>
              </div>
            )}
            {keyFeatures.price && (
              <div className={styles.feature}>
                <div className={styles.featureText}>
                  {lang === "en"
                    ? "Price from (+VAT)"
                    : lang === "de"
                      ? "Preis ab (+MwSt)"
                      : lang === "pl"
                        ? "Cena od (+VAT)"
                        : lang === "ru"
                          ? "Цена от (+НДС)"
                          : "Price from (+VAT)"}
                </div>
                <div className={styles.featureValue}>
                  {keyFeatures.price.toLocaleString()} €
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PropertyFeatures;
