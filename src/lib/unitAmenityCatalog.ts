// Per-UNIT features (differ between apartments in the same building), unlike the
// project-wide amenities. Ticked per unit in the unit detail panel.
export const UNIT_AMENITY_CATALOG: { category: string; items: string[] }[] = [
  {
    category: "View",
    items: ["Sea view", "Partial sea view", "Mountain view", "Garden view", "Pool view", "Unobstructed view"],
  },
  {
    category: "Systems",
    items: ["VRV/VRF air conditioning", "Underfloor heating", "Smart home", "Solar water heating", "Provision for A/C"],
  },
  {
    category: "Position",
    items: ["Corner unit", "Ground floor", "Top floor", "Penthouse level"],
  },
  {
    category: "Extras",
    items: [
      "Private pool",
      "Private garden",
      "Private roof terrace",
      "Storage room",
      "Covered parking",
      "Maid's room",
      "En-suite bathroom",
      "Walk-in wardrobe",
      "Fireplace",
    ],
  },
];

export const ALL_UNIT_AMENITIES = UNIT_AMENITY_CATALOG.flatMap((g) => g.items);
