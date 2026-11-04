// Country facts the CRM needs about a lead (2026-11-04): calling code, whether the euro is the
// currency, and the IANA time zone(s). Pure and import-free (client components use it too).
//
// zones: the real IANA zones, never fixed offsets, so summer/winter time is right. A country with
// more than one zone lists them all; the cockpit then asks which one applies.

export type CountryInfo = { iso: string; name: string; dial: string; euro: boolean; zones: string[] };

const C = (iso: string, name: string, dial: string, zones: string[], euro = false): CountryInfo => ({ iso, name, dial, euro, zones });

export const COUNTRIES: CountryInfo[] = [
  // Euro area and euro users
  C("AT", "Austria", "43", ["Europe/Vienna"], true),
  C("BE", "Belgium", "32", ["Europe/Brussels"], true),
  C("HR", "Croatia", "385", ["Europe/Zagreb"], true),
  C("CY", "Cyprus", "357", ["Asia/Nicosia"], true),
  C("EE", "Estonia", "372", ["Europe/Tallinn"], true),
  C("FI", "Finland", "358", ["Europe/Helsinki"], true),
  C("FR", "France", "33", ["Europe/Paris"], true),
  C("DE", "Germany", "49", ["Europe/Berlin"], true),
  C("GR", "Greece", "30", ["Europe/Athens"], true),
  C("IE", "Ireland", "353", ["Europe/Dublin"], true),
  C("IT", "Italy", "39", ["Europe/Rome"], true),
  C("LV", "Latvia", "371", ["Europe/Riga"], true),
  C("LT", "Lithuania", "370", ["Europe/Vilnius"], true),
  C("LU", "Luxembourg", "352", ["Europe/Luxembourg"], true),
  C("MT", "Malta", "356", ["Europe/Malta"], true),
  C("NL", "Netherlands", "31", ["Europe/Amsterdam"], true),
  C("PT", "Portugal", "351", ["Europe/Lisbon", "Atlantic/Azores"], true),
  C("SK", "Slovakia", "421", ["Europe/Bratislava"], true),
  C("SI", "Slovenia", "386", ["Europe/Ljubljana"], true),
  C("ES", "Spain", "34", ["Europe/Madrid", "Atlantic/Canary"], true),
  C("MC", "Monaco", "377", ["Europe/Monaco"], true),
  C("ME", "Montenegro", "382", ["Europe/Podgorica"], true),
  C("AD", "Andorra", "376", ["Europe/Andorra"], true),
  C("BG", "Bulgaria", "359", ["Europe/Sofia"], true),
  // Rest of Europe
  C("GB", "United Kingdom", "44", ["Europe/London"]),
  C("CH", "Switzerland", "41", ["Europe/Zurich"]),
  C("LI", "Liechtenstein", "423", ["Europe/Vaduz"]),
  C("NO", "Norway", "47", ["Europe/Oslo"]),
  C("SE", "Sweden", "46", ["Europe/Stockholm"]),
  C("DK", "Denmark", "45", ["Europe/Copenhagen"]),
  C("IS", "Iceland", "354", ["Atlantic/Reykjavik"]),
  C("PL", "Poland", "48", ["Europe/Warsaw"]),
  C("CZ", "Czechia", "420", ["Europe/Prague"]),
  C("HU", "Hungary", "36", ["Europe/Budapest"]),
  C("RO", "Romania", "40", ["Europe/Bucharest"]),
  C("RS", "Serbia", "381", ["Europe/Belgrade"]),
  C("UA", "Ukraine", "380", ["Europe/Kyiv"]),
  C("MD", "Moldova", "373", ["Europe/Chisinau"]),
  C("BY", "Belarus", "375", ["Europe/Minsk"]),
  C("RU", "Russia", "7", ["Europe/Moscow", "Europe/Kaliningrad", "Europe/Samara", "Asia/Yekaterinburg", "Asia/Novosibirsk", "Asia/Krasnoyarsk", "Asia/Irkutsk", "Asia/Vladivostok"]),
  C("TR", "Turkey", "90", ["Europe/Istanbul"]),
  // Caucasus, Central Asia
  C("GE", "Georgia", "995", ["Asia/Tbilisi"]),
  C("AM", "Armenia", "374", ["Asia/Yerevan"]),
  C("AZ", "Azerbaijan", "994", ["Asia/Baku"]),
  C("KZ", "Kazakhstan", "77", ["Asia/Almaty", "Asia/Aqtobe"]),
  C("UZ", "Uzbekistan", "998", ["Asia/Tashkent"]),
  C("KG", "Kyrgyzstan", "996", ["Asia/Bishkek"]),
  // Middle East, Africa
  C("IL", "Israel", "972", ["Asia/Jerusalem"]),
  C("LB", "Lebanon", "961", ["Asia/Beirut"]),
  C("JO", "Jordan", "962", ["Asia/Amman"]),
  C("AE", "United Arab Emirates", "971", ["Asia/Dubai"]),
  C("SA", "Saudi Arabia", "966", ["Asia/Riyadh"]),
  C("QA", "Qatar", "974", ["Asia/Qatar"]),
  C("KW", "Kuwait", "965", ["Asia/Kuwait"]),
  C("BH", "Bahrain", "973", ["Asia/Bahrain"]),
  C("OM", "Oman", "968", ["Asia/Muscat"]),
  C("EG", "Egypt", "20", ["Africa/Cairo"]),
  C("ZA", "South Africa", "27", ["Africa/Johannesburg"]),
  C("NG", "Nigeria", "234", ["Africa/Lagos"]),
  C("KE", "Kenya", "254", ["Africa/Nairobi"]),
  // Asia, Pacific, Americas
  C("IN", "India", "91", ["Asia/Kolkata"]),
  C("PK", "Pakistan", "92", ["Asia/Karachi"]),
  C("CN", "China", "86", ["Asia/Shanghai"]),
  C("HK", "Hong Kong", "852", ["Asia/Hong_Kong"]),
  C("SG", "Singapore", "65", ["Asia/Singapore"]),
  C("TH", "Thailand", "66", ["Asia/Bangkok"]),
  C("JP", "Japan", "81", ["Asia/Tokyo"]),
  C("AU", "Australia", "61", ["Australia/Sydney", "Australia/Brisbane", "Australia/Adelaide", "Australia/Perth", "Australia/Darwin"]),
  C("NZ", "New Zealand", "64", ["Pacific/Auckland"]),
  C("US", "United States", "1", ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"]),
  C("CA", "Canada", "1", ["America/St_Johns", "America/Halifax", "America/Toronto", "America/Winnipeg", "America/Regina", "America/Edmonton", "America/Vancouver"]),
  C("BR", "Brazil", "55", ["America/Sao_Paulo", "America/Manaus"]),
  C("MX", "Mexico", "52", ["America/Mexico_City", "America/Cancun", "America/Tijuana"]),
];

const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));

/** Free text or an ISO code ("ZA", "South Africa", "germany") → the country, or null. */
export function countryOf(value: string | null | undefined): CountryInfo | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const iso = BY_ISO.get(v.toUpperCase());
  if (iso) return iso;
  const lower = v.toLowerCase();
  return COUNTRIES.find((c) => c.name.toLowerCase() === lower) ?? (lower === "uk" ? BY_ISO.get("GB")! : null);
}

/** Digits of an international number (leading +/00 dropped), or null for a number in national format. */
export function internationalDigits(phone: string | null | undefined): string | null {
  const p = (phone ?? "").trim();
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  if (p.startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  return null;
}

/** The country a phone number belongs to, by its longest matching calling code. +1 and +7 are shared
 *  (US/CA, RU/KZ): +1 gives null (the lead's country decides), +7 gives Russia unless +77 (Kazakhstan). */
export function countryOfPhone(phone: string | null | undefined): CountryInfo | null {
  const d = internationalDigits(phone);
  if (!d) return null;
  if (d.startsWith("1")) return null;
  let best: CountryInfo | null = null;
  for (const c of COUNTRIES) {
    if (d.startsWith(c.dial) && (!best || c.dial.length > best.dial.length)) best = c;
  }
  return best;
}
