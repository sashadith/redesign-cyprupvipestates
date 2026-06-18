// app/components/ProjectFilters/ProjectFilters.tsx
import React from "react";
import styles from "./ProjectFilters.module.scss";
import Select from "react-select";

type OptionType = {
  title: string;
  value: string;
};

type PropertyTypesOptionsTranslations = {
  en: OptionType[];
  de: OptionType[];
  ru: OptionType[];
  pl: OptionType[];
};

type ProjectFiltersProps = {
  lang: string;
  city: string;
  priceFrom?: number | string | null;
  priceTo?: number | string | null;
  propertyType?: string;
};

const propertyTypesOptionsTranslations: PropertyTypesOptionsTranslations = {
  en: [
    { title: "All types", value: "" },
    { title: "Apartment", value: "Apartment" },
    { title: "Villa", value: "Villa" },
    { title: "Townhouse", value: "Townhouse" },
    { title: "Semi-detached villa", value: "Semi-detached villa" },
    { title: "Office", value: "Office" },
    { title: "Shop", value: "Shop" },
  ],
  de: [
    { title: "Alle Typen", value: "" },
    { title: "Apartment", value: "Apartment" },
    { title: "Villa", value: "Villa" },
    { title: "Reihenhaus", value: "Townhouse" },
    { title: "Halb freistehende Villa", value: "Semi-detached villa" },
    { title: "Büro", value: "Office" },
    { title: "Geschäft", value: "Shop" },
  ],
  ru: [
    { title: "Все типы", value: "" },
    { title: "Квартира", value: "Apartment" },
    { title: "Вилла", value: "Villa" },
    { title: "Таунхаус", value: "Townhouse" },
    { title: "Двойной дом", value: "Semi-detached villa" },
    { title: "Офис", value: "Office" },
    { title: "Магазин", value: "Shop" },
  ],
  pl: [
    { title: "Wszystkie typy", value: "" },
    { title: "Mieszkanie", value: "Apartment" },
    { title: "Willa", value: "Villa" },
    { title: "Dom szeregowy", value: "Townhouse" },
    { title: "Willa bliźniacza", value: "Semi-detached villa" },
    { title: "Biuro", value: "Office" },
    { title: "Sklep", value: "Shop" },
  ],
};

const ProjectFilters: React.FC<ProjectFiltersProps> = ({
  lang,
  city,
  priceFrom,
  priceTo,
  propertyType,
}) => {
  // Определяем нужный массив опций в зависимости от выбранного языка,
  // если для текущего языка перевода нет – используется английская версия
  const propertyTypesOptions =
    propertyTypesOptionsTranslations[
      lang as keyof PropertyTypesOptionsTranslations
    ] || propertyTypesOptionsTranslations["en"];

  return (
    <form method="get" style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <label htmlFor="city">
            {lang === "en"
              ? "City"
              : lang === "de"
                ? "Stadt"
                : lang === "pl"
                  ? "Miasto"
                  : lang === "ru"
                    ? "Город"
                    : "City"}
            :{" "}
          </label>
          <select name="city" id="city" defaultValue={city}>
            <option value="">
              {lang === "en"
                ? "All cities"
                : lang === "de"
                  ? "Alle Städte"
                  : lang === "pl"
                    ? "Wszystkie miasta"
                    : lang === "ru"
                      ? "Все города"
                      : "All cities"}
            </option>
            <option value="Paphos">
              {lang === "en"
                ? "Paphos"
                : lang === "de"
                  ? "Paphos"
                  : lang === "pl"
                    ? "Pafos"
                    : lang === "ru"
                      ? "Пафос"
                      : "Paphos"}
            </option>
            <option value="Limassol">
              {lang === "en"
                ? "Limassol"
                : lang === "de"
                  ? "Limassol"
                  : lang === "pl"
                    ? "Limassol"
                    : lang === "ru"
                      ? "Лимассол"
                      : "Limassol"}
            </option>
            <option value="Larnaca">
              {lang === "en"
                ? "Larnaca"
                : lang === "de"
                  ? "Larnaca"
                  : lang === "pl"
                    ? "Larnaca"
                    : lang === "ru"
                      ? "Ларнака"
                      : "Larnaca"}
            </option>
          </select>
        </div>
        <div>
          <label htmlFor="priceFrom">Price from: </label>
          <input
            type="number"
            name="priceFrom"
            id="priceFrom"
            defaultValue={priceFrom || ""}
          />
        </div>
        <div>
          <label htmlFor="priceTo">Price to: </label>
          <input
            type="number"
            name="priceTo"
            id="priceTo"
            defaultValue={priceTo || ""}
          />
        </div>
        <div>
          <label htmlFor="propertyType">
            {lang === "en"
              ? "Property Type"
              : lang === "de"
                ? "Immobilientyp"
                : lang === "pl"
                  ? "Typ nieruchomości"
                  : lang === "ru"
                    ? "Тип недвижимости"
                    : "Property Type"}
            :{" "}
          </label>
          <select
            name="propertyType"
            id="propertyType"
            defaultValue={propertyType}
          >
            {propertyTypesOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ marginTop: "1rem", color: "blue" }}>
        <button type="submit" className={styles.button}>
          {lang === "en"
            ? "Apply filters"
            : lang === "de"
              ? "Filter anwenden"
              : lang === "pl"
                ? "Zastosuj filtry"
                : lang === "ru"
                  ? "Применить фильтры"
                  : "Apply filters"}
        </button>
      </div>
    </form>
  );
};

export default ProjectFilters;
