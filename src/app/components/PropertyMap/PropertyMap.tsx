"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { FC, useState } from "react";
import Link from "next/link";
import popupStyles from "../ProjectsMapAll/ProjectsMapAll.module.scss";
import styles from "./PropertyMap.module.scss";

type SupportedLang = "de" | "en" | "ru" | "pl";
type CityKey = "Paphos" | "Limassol" | "Larnaca";

type Props = {
  lat: number;
  lng: number;
  lang?: string;
  showPopup?: boolean;
  title?: string;
  slug?: string;
  city?: string;
  price?: number;
  previewUrl?: string;
};

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const customMarkerIcon = new L.Icon({
  iconUrl:
    "/uploads/files/b505baf3de67bb4a320352ebbb2af98fe2e04537.png",
  iconSize: [62, 95],
  iconAnchor: [20, 100],
  popupAnchor: [0, -41],
});

const CITY_CANONICAL: Record<string, CityKey> = {
  paphos: "Paphos",
  pafos: "Paphos",
  limassol: "Limassol",
  larnaca: "Larnaca",
  larnaka: "Larnaca",
};

const CITY_I18N: Record<SupportedLang, Record<CityKey, string>> = {
  en: { Paphos: "Paphos", Limassol: "Limassol", Larnaca: "Larnaca" },
  de: { Paphos: "Paphos", Limassol: "Limassol", Larnaca: "Larnaca" },
  ru: { Paphos: "Пафос", Limassol: "Лимассол", Larnaca: "Ларнака" },
  pl: { Paphos: "Pafos", Limassol: "Limassol", Larnaca: "Larnaka" },
};

function translateCity(city: string | undefined, lang: SupportedLang): string {
  if (!city) return "";
  const key = CITY_CANONICAL[city.trim().toLowerCase()];
  return key ? (CITY_I18N[lang]?.[key] ?? city) : city;
}

function formatPrice(price: number, lang: SupportedLang): string {
  const locales: Record<SupportedLang, string> = {
    en: "en-US",
    de: "de-DE",
    ru: "ru-RU",
    pl: "pl-PL",
  };

  return new Intl.NumberFormat(locales[lang], {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatCoords(lat: number, lng: number) {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function buildMapLinks(lat: number, lng: number) {
  const ll = `${lat},${lng}`;

  return {
    googleView: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ll)}`,
    googleRoute: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ll)}&travelmode=driving`,
    appleRoute: `https://maps.apple.com/?daddr=${encodeURIComponent(ll)}&dirflg=d`,
    osmView: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`,
  };
}

function t(
  label: "coords" | "copy" | "copied" | "open" | "route" | "osm",
  lang: SupportedLang,
) {
  const dict: Record<SupportedLang, Record<string, string>> = {
    en: {
      coords: "Coordinates",
      copy: "Copy",
      copied: "Copied!",
      open: "Open in Google Maps",
      route: "Route (Google/Apple)",
      osm: "Open in OSM",
    },
    de: {
      coords: "Koordinaten",
      copy: "Kopieren",
      copied: "Kopiert!",
      open: "In Google Maps öffnen",
      route: "Route (Google/Apple)",
      osm: "In OSM öffnen",
    },
    ru: {
      coords: "Координаты",
      copy: "Скопировать",
      copied: "Скопировано!",
      open: "Открыть в Google Картах",
      route: "Google/Apple",
      osm: "Открыть в OSM",
    },
    pl: {
      coords: "Współrzędne",
      copy: "Kopiuj",
      copied: "Skopiowano!",
      open: "Otwórz w Google Maps",
      route: "Trasa (Google/Apple)",
      osm: "Otwórz w OSM",
    },
  };

  return dict[lang][label];
}

function projectLinkLabel(lang: SupportedLang) {
  switch (lang) {
    case "de":
      return "Projekt öffnen";
    case "en":
      return "Open project";
    case "ru":
      return "Открыть проект";
    case "pl":
      return "Otwórz projekt";
    default:
      return "Open project";
  }
}

function thumb(url?: string, w = 420, h = 240) {
  if (!url) return "";
  if (url.includes("cdn.sanity.io")) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}w=${w}&h=${h}&fit=crop&auto=format`;
  }
  return url;
}

const popupMessages: Record<SupportedLang, string> = {
  de: "Diese Immobilie befindet sich hier.",
  en: "This property is located here.",
  ru: "Объект находится здесь.",
  pl: "Tutaj znajduje się ta nieruchomość.",
};

const PropertyMap: FC<Props> = ({
  lat,
  lng,
  lang = "de",
  showPopup = false,
  title,
  slug,
  city,
  price,
  previewUrl,
}) => {
  const [copied, setCopied] = useState(false);

  const safeLang: SupportedLang = ["de", "en", "ru", "pl"].includes(lang)
    ? (lang as SupportedLang)
    : "de";

  const cityLabel = translateCity(city, safeLang);
  const links = buildMapLinks(lat, lng);
  const bg = thumb(previewUrl);
  const hasRichPopup = Boolean(previewUrl || title || city || price || slug);

  const href = slug
    ? safeLang === "de"
      ? `/projects/${slug}`
      : `/${safeLang}/projects/${slug}`
    : "#";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatCoords(lat, lng));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  return (
    <div className={styles.propertyMap}>
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        scrollWheelZoom={true}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className={styles.grayscaleTile}
        />

        <Marker position={[lat, lng]} icon={customMarkerIcon}>
          {showPopup && (
            <Popup className={popupStyles.projectPopup} maxWidth={360}>
              {hasRichPopup ? (
                <div
                  className={popupStyles.popupCard}
                  style={{
                    backgroundImage: bg
                      ? `url(${bg})`
                      : "linear-gradient(135deg,#111,#111)",
                  }}
                >
                  <div className={popupStyles.popupOverlay}>
                    {title && (
                      <div
                        style={{ fontSize: "20px" }}
                        className={popupStyles.popupTitle}
                      >
                        {title}
                      </div>
                    )}

                    <div className={popupStyles.popupMeta}>
                      {cityLabel && (
                        <span style={{ fontSize: "16px" }}>{cityLabel}</span>
                      )}
                      {typeof price === "number" && price > 0 && (
                        <span> · {formatPrice(price, safeLang)}</span>
                      )}
                    </div>

                    <div className={popupStyles.popupActions}>
                      <a
                        href={links.googleView}
                        style={{ color: "#fff" }}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t("open", safeLang)}
                      </a>

                      <a
                        href={links.googleRoute}
                        style={{ color: "#fff" }}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t("route", safeLang)}
                      </a>

                      <a
                        href={links.osmView}
                        style={{ color: "#fff" }}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t("osm", safeLang)}
                      </a>

                      <button onClick={handleCopy}>
                        {copied ? t("copied", safeLang) : t("copy", safeLang)}
                      </button>
                    </div>

                    {slug && (
                      <Link
                        href={href}
                        target="_blank"
                        className={popupStyles.projectLink}
                        style={{ fontSize: "20px", color: "#fff" }}
                      >
                        {projectLinkLabel(safeLang)}
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <b>{popupMessages[safeLang]}</b>
              )}
            </Popup>
          )}
        </Marker>
      </MapContainer>
    </div>
  );
};

export default PropertyMap;
