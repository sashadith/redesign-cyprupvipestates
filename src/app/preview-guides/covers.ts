// Page 1 of each guide PDF, as a JPEG (generated from src/lib/guides/pdf-files with PyMuPDF at 84 dpi).
// Static imports: Next emits them under /_next/static/media, which nginx serves.
import type { StaticImageData } from "next/image";
import type { GuideId } from "@/lib/guides/registry";
import type { GuideLang } from "@/lib/guides/types";

import cost_of_buying_en from "./covers/cost-of-buying.en.jpg";
import cost_of_buying_de from "./covers/cost-of-buying.de.jpg";
import cost_of_buying_pl from "./covers/cost-of-buying.pl.jpg";
import cost_of_buying_ru from "./covers/cost-of-buying.ru.jpg";
import buying_process_en from "./covers/buying-process.en.jpg";
import buying_process_de from "./covers/buying-process.de.jpg";
import buying_process_pl from "./covers/buying-process.pl.jpg";
import buying_process_ru from "./covers/buying-process.ru.jpg";
import rent_or_buy_en from "./covers/rent-or-buy.en.jpg";
import rent_or_buy_de from "./covers/rent-or-buy.de.jpg";
import rent_or_buy_pl from "./covers/rent-or-buy.pl.jpg";
import rent_or_buy_ru from "./covers/rent-or-buy.ru.jpg";
import residency_en from "./covers/residency.en.jpg";
import residency_de from "./covers/residency.de.jpg";
import residency_pl from "./covers/residency.pl.jpg";
import residency_ru from "./covers/residency.ru.jpg";

export const GUIDE_COVERS: Record<GuideId, Record<GuideLang, StaticImageData>> = {
  "cost-of-buying": {
    en: cost_of_buying_en,
    de: cost_of_buying_de,
    pl: cost_of_buying_pl,
    ru: cost_of_buying_ru,
  },
  "buying-process": {
    en: buying_process_en,
    de: buying_process_de,
    pl: buying_process_pl,
    ru: buying_process_ru,
  },
  "rent-or-buy": {
    en: rent_or_buy_en,
    de: rent_or_buy_de,
    pl: rent_or_buy_pl,
    ru: rent_or_buy_ru,
  },
  "residency": {
    en: residency_en,
    de: residency_de,
    pl: residency_pl,
    ru: residency_ru,
  },
};
