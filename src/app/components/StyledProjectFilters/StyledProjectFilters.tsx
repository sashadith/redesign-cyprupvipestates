"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FloatingSelect, { OptionType } from "../FloatingSelect/FloatingSelect";
import FloatingLabelInput from "../FloatingLabelInput/FloatingLabelInput";
import styles from "./StyledProjectFilters.module.scss";
import Image from "next/image";

function debounce<T extends (...args: any[]) => void>(fn: T, wait = 300) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

type ProjectFiltersProps = {
  lang: string;
  city: string;
  priceFrom?: number | string | null;
  priceTo?: number | string | null;
  propertyType?: string;
  bedrooms?: string;
  sort?: string;
  q?: string;
};

const cityOptionsByLang: Record<string, OptionType[]> = {
  en: [
    { label: "All cities", value: "" },
    { label: "Paphos", value: "Paphos" },
    { label: "Limassol", value: "Limassol" },
    { label: "Larnaca", value: "Larnaca" },
  ],
  de: [
    { label: "Alle Städte", value: "" },
    { label: "Paphos", value: "Paphos" },
    { label: "Limassol", value: "Limassol" },
    { label: "Larnaka", value: "Larnaca" },
  ],
  ru: [
    { label: "Все города", value: "" },
    { label: "Пафос", value: "Paphos" },
    { label: "Лимассол", value: "Limassol" },
    { label: "Ларнака", value: "Larnaca" },
  ],
  pl: [
    { label: "Wszystkie miasta", value: "" },
    { label: "Pafos", value: "Paphos" },
    { label: "Limasol", value: "Limassol" },
    { label: "Larnaka", value: "Larnaca" },
  ],
};

const propertyTypeOptionsByLang: Record<string, OptionType[]> = {
  en: [
    { label: "All types", value: "" },
    { label: "Apartment", value: "Apartment" },
    { label: "Villa", value: "Villa" },
    { label: "Townhouse", value: "Townhouse" },
  ],
  de: [
    { label: "Alle Typen", value: "" },
    { label: "Apartment", value: "Apartment" },
    { label: "Villa", value: "Villa" },
    { label: "Reihenhaus", value: "Townhouse" },
  ],
  ru: [
    { label: "Все типы", value: "" },
    { label: "Квартира", value: "Apartment" },
    { label: "Вилла", value: "Villa" },
    { label: "Таунхаус", value: "Townhouse" },
  ],
  pl: [
    { label: "Wszystkie typy", value: "" },
    { label: "Mieszkanie", value: "Apartment" },
    { label: "Willa", value: "Villa" },
    { label: "Dom szeregowy", value: "Townhouse" },
  ],
};

const numericBeds = (anyLabel: string): OptionType[] => [
  { label: anyLabel, value: "" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
  { label: "5+", value: "5" },
];
const bedroomsOptionsByLang: Record<string, OptionType[]> = {
  en: numericBeds("Any bedrooms"),
  de: numericBeds("Schlafzimmer (beliebig)"),
  ru: numericBeds("Спальни (любое)"),
  pl: numericBeds("Sypialnie (dowolnie)"),
};

export default function StyledProjectFilters({
  lang,
  city,
  priceFrom,
  priceTo,
  propertyType,
  bedrooms,
  sort,
  q,
}: ProjectFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const cityOptions = cityOptionsByLang[lang];
  const typeOptions = propertyTypeOptionsByLang[lang];
  const bedroomsOptions = bedroomsOptionsByLang[lang] ?? bedroomsOptionsByLang.en;

  const [cityValue, setCityValue] = useState("");
  const [typeValue, setTypeValue] = useState("");
  const [bedroomsValue, setBedroomsValue] = useState("");
  const [sortValue, setSortValue] = useState("");
  const [priceFromValue, setPriceFromValue] = useState("");
  const [priceToValue, setPriceToValue] = useState("");
  const [searchValue, setSearchValue] = useState("");

  const updateQuery = useCallback(
    (next: Record<string, unknown>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(next).forEach(([key, value]) => {
        if (value === "" || value === null || value === undefined) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });

      params.delete("page");

      startTransition(() => {
        router.replace(`?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams, startTransition],
  );

  const handleReset = () => {
    setSearchValue("");
    setCityValue("");
    setPriceFromValue("");
    setPriceToValue("");
    setTypeValue("");
    setBedroomsValue("");
    setSortValue("");

    updateQuery({
      city: "",
      priceFrom: "",
      priceTo: "",
      propertyType: "",
      bedrooms: "",
      sort: "",
      q: "",
      north: "",
      south: "",
      east: "",
      west: "",
    });
  };

  const debouncedUpdate = useMemo(
    () => debounce(updateQuery, 700),
    [updateQuery],
  );

  const cityDefault = city
    ? (cityOptions.find((o) => o.value === city) ?? null)
    : null;
  const typeDefault = propertyType
    ? (typeOptions.find((o) => o.value === propertyType) ?? null)
    : null;

  const labelCity =
    lang === "de"
      ? "Stadt"
      : lang === "ru"
        ? "Город"
        : lang === "pl"
          ? "Miasto"
          : "City";
  const labelPriceFrom =
    lang === "de"
      ? "Preis von (€)"
      : lang === "ru"
        ? "Цена от (€)"
        : lang === "pl"
          ? "Cena od (€)"
          : "Price from (€)";
  const labelPriceTo =
    lang === "de"
      ? "Preis bis (€)"
      : lang === "ru"
        ? "Цена до (€)"
        : lang === "pl"
          ? "Cena do (€)"
          : "Price to (€)";
  const labelPropertyType =
    lang === "de"
      ? "Immobilientyp"
      : lang === "ru"
        ? "Тип недвижимости"
        : lang === "pl"
          ? "Typ nieruchomości"
          : "Property Type";
  const labelBedrooms =
    lang === "de"
      ? "Schlafzimmer"
      : lang === "ru"
        ? "Спальни"
        : lang === "pl"
          ? "Sypialnie"
          : "Bedrooms";
  const labelSearch =
    lang === "de"
      ? "Nach Stichwort suchen"
      : lang === "ru"
        ? "Поиск по ключевым словам"
        : lang === "pl"
          ? "Szukaj według słowa kluczowego"
          : "Search by keyword";
  const labelSort =
    lang === "de"
      ? "Sortieren nach"
      : lang === "ru"
        ? "Сортировка"
        : lang === "pl"
          ? "Sortuj według"
          : "Sort by";

  const sortOptions =
    lang === "de"
      ? [
          { label: "Empfohlen", value: "recommended" },
          { label: "Preis: aufsteigend", value: "priceAsc" },
          { label: "Preis: absteigend", value: "priceDesc" },
          { label: "Fertigstellung: am frühesten", value: "completionSoon" },
          { label: "Titel: A–Z", value: "titleAsc" },
          { label: "Titel: Z–A", value: "titleDesc" },
        ]
      : lang === "ru"
        ? [
            { label: "Рекомендуемые", value: "recommended" },
            { label: "Цена: по возрастанию", value: "priceAsc" },
            { label: "Цена: по убыванию", value: "priceDesc" },
            { label: "Сдача: ближайшая", value: "completionSoon" },
            { label: "Название: A–Z", value: "titleAsc" },
            { label: "Название: Z–A", value: "titleDesc" },
          ]
        : lang === "pl"
          ? [
              { label: "Polecane", value: "recommended" },
              { label: "Cena: rosnąco", value: "priceAsc" },
              { label: "Cena: malejąco", value: "priceDesc" },
              { label: "Oddanie: najszybciej", value: "completionSoon" },
              { label: "Tytuł: A–Z", value: "titleAsc" },
              { label: "Tytuł: Z–A", value: "titleDesc" },
            ]
          : [
              { label: "Recommended", value: "recommended" },
              { label: "Price: Low to High", value: "priceAsc" },
              { label: "Price: High to Low", value: "priceDesc" },
              { label: "Completion: Soonest first", value: "completionSoon" },
              { label: "Title: A–Z", value: "titleAsc" },
              { label: "Title: Z–A", value: "titleDesc" },
            ];
  const labelReset =
    lang === "de"
      ? "Zurücksetzen"
      : lang === "ru"
        ? "Сбросить"
        : lang === "pl"
          ? "Resetuj"
          : "Reset";

  useEffect(() => {
    // Берём всё только из URL, чтобы UI всегда соответствовал адресу
    const sp = new URLSearchParams(searchParams.toString());

    setCityValue(sp.get("city") ?? "");
    setTypeValue(sp.get("propertyType") ?? "");
    setBedroomsValue(sp.get("bedrooms") ?? "");
    setSortValue(sp.get("sort") ?? ""); // пусто = нет параметра => покажем placeholder
    setPriceFromValue(sp.get("priceFrom") ?? "");
    setPriceToValue(sp.get("priceTo") ?? "");
    setSearchValue(sp.get("q") ?? "");
  }, [searchParams]);

  return (
    <div className={styles.form}>
      <div className={styles.bg}>
        <div className={styles.bgOverlay}></div>
        <Image
          src="/uploads/files/bef9ef8c1faaf4bb80be49714d5c345bc434b1e0.webp"
          alt="Search"
          fill
          sizes="100vw"
          className={styles.backgroundImage}
        />
      </div>
      <div className={`${styles.formWrapper} container`}>
        <h1 className="h2-white header-mt text-center">
          {lang === "en"
            ? "Luxury Real Estate Projects in Cyprus"
            : lang === "de" || lang === "ru"
              ? "Luxusimmobilien auf Zypern"
              : lang === "pl"
                ? "Luksusowe projekty nieruchomości na Cyprze"
                : "Luxury Real Estate Projects in Cyprus"}
        </h1>
        <div className={styles.formElements}>
          <FloatingSelect
            label={labelCity}
            name="city"
            options={cityOptions}
            value={
              cityValue
                ? (cityOptions.find((o) => o.value === cityValue) ?? null)
                : null
            }
            onChange={(opt) => {
              const val = opt?.value ?? "";
              setCityValue(val);
              updateQuery({ city: val });
            }}
          />

          <FloatingSelect
            label={labelPropertyType}
            name="propertyType"
            options={typeOptions}
            value={
              typeValue
                ? (typeOptions.find((o) => o.value === typeValue) ?? null)
                : null
            }
            onChange={(opt) => {
              const val = opt?.value ?? "";
              setTypeValue(val);
              updateQuery({ propertyType: val });
            }}
          />

          <FloatingSelect
            label={labelBedrooms}
            name="bedrooms"
            options={bedroomsOptions}
            value={
              bedroomsValue
                ? (bedroomsOptions.find((o) => o.value === bedroomsValue) ?? null)
                : null
            }
            onChange={(opt) => {
              const val = opt?.value ?? "";
              setBedroomsValue(val);
              updateQuery({ bedrooms: val });
            }}
          />

          <FloatingLabelInput
            label={labelPriceFrom}
            name="priceFrom"
            type="number"
            value={priceFromValue}
            onChange={(e) => {
              const val = e.target.value;
              setPriceFromValue(val);
              debouncedUpdate({ priceFrom: val });
            }}
          />

          <FloatingLabelInput
            label={labelPriceTo}
            name="priceTo"
            type="number"
            value={priceToValue}
            onChange={(e) => {
              const val = e.target.value;
              setPriceToValue(val);
              debouncedUpdate({ priceTo: val });
            }}
          />

          <FloatingLabelInput
            label={labelSearch}
            name="q"
            value={searchValue}
            onChange={(e) => {
              const val = e.target.value;
              setSearchValue(val);
              debouncedUpdate({ q: val });
            }}
            className={styles.keywordInput}
          />

          <FloatingSelect
            label={labelSort}
            name="sort"
            options={sortOptions}
            value={
              sortValue
                ? (sortOptions.find((o) => o.value === sortValue) ?? null)
                : null
            }
            onChange={(opt) => {
              const val = opt?.value ?? "";
              setSortValue(val);
              updateQuery({ sort: val });
            }}
          />

          <button type="button" className={styles.button} onClick={handleReset}>
            {labelReset}
          </button>
        </div>
      </div>
    </div>
  );
}
