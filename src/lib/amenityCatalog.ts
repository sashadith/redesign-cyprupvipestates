// Curated amenity catalogue for the admin checkbox editor, grouped by category.
// Seeded from the amenities the developer feeds/PDFs provide (INEX, BBF, Eniko
// Mare …). Admins tick these; anything else is added as a free-text custom item.
export const AMENITY_CATALOG: { category: string; items: string[] }[] = [
  {
    category: "Leisure & Outdoor",
    items: [
      "Communal swimming pool",
      "Private swimming pool",
      "Roof terrace with sea views",
      "Roof garden",
      "BBQ & recreational area",
      "Landscaped gardens",
      "Children's playground",
      "Tennis court",
      "Outdoor lounge area",
    ],
  },
  {
    category: "Building & Services",
    items: [
      "Fully equipped gym",
      "Welcoming lobby",
      "Concierge service",
      "Elevator",
      "Covered parking",
      "Underground parking",
      "Storage room",
      "EV charging",
      "Shower & changing facilities",
    ],
  },
  {
    category: "Comfort & Interior",
    items: [
      "A/C split units",
      "VRV cooling",
      "Underfloor heating",
      "Solar water heating",
      "Photovoltaic panels",
      "Photovoltaic system",
      "Smart home system",
      "Fitted wardrobes",
      "Tailor-made kitchen",
      "Branded appliances",
      "Double glazing",
      "Upgraded thermal aluminium",
      "Imported ceramic tiles",
      "Branded sanitary ware",
      "Electric gate",
      "Electric car charger",
    ],
  },
  {
    category: "Security",
    items: ["24/7 security", "Gated community", "CCTV", "Video intercom", "Alarm system", "Pressurised water system"],
  },
  {
    category: "Views",
    items: ["Sea views", "Unobstructed views", "Mountain views"],
  },
];

export const ALL_CATALOG_AMENITIES = AMENITY_CATALOG.flatMap((g) => g.items);
