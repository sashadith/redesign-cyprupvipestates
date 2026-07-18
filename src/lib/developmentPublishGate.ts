// Same normalization the AreaDescription lookup itself uses (originated in
// admin/developments/[id]/page.tsx) — "Paphos" -> "fafos" etc. Kept here so
// every caller checking "does this area have an approved description" agrees
// on the same slug.
export function areaSlugOf(a: string): string {
  return a.toLowerCase().replace(/ph/g, "f").replace(/[^a-z]/g, "");
}

// The required-fields checklist a Development must clear before it's really
// publish-ready. Single source of truth shared by the editor
// (admin/developments/[id]/page.tsx, where it originated) and the Publishing
// Queue (admin/developers/publishing-queue) — the queue's missing-field chips
// must always match what the editor itself shows, so this can't drift into
// two copies.
export type PublishGateCheck = { key: string; ok: boolean; label: string; chip: string };

export function computePublishGate(input: {
  description: string;
  area: string;
  district: string;
  lat: number | null | undefined;
  lng: number | null | undefined;
  stage: string | null | undefined;
  hasAreaDescription: boolean;
  gallery: string[];
  mainImage: string | null | undefined;
  // A sold-out development needs no construction stage to be validly
  // published/archived — availability is computed from units, never from
  // this field (see src/lib/developmentAvailability.ts). Optional so
  // existing callers that never pass it keep the old (stricter) behaviour.
  soldOut?: boolean;
}): PublishGateCheck[] {
  return [
    { key: "description", ok: !!input.description, label: "Description filled", chip: "description" },
    { key: "area", ok: !!input.area, label: "Area set", chip: "area" },
    { key: "district", ok: !!input.district, label: "District set", chip: "district" },
    { key: "location", ok: input.lat != null && input.lng != null, label: "Map location set", chip: "location" },
    {
      key: "stage", ok: !!input.stage || !!input.soldOut,
      label: input.soldOut ? "Construction stage (sold out — optional)" : "Construction stage set",
      chip: "stage",
    },
    { key: "areaDescription", ok: input.hasAreaDescription, label: "Neighbourhood description exists for this area", chip: "area desc" },
    { key: "images", ok: input.gallery.length > 0 || !!input.mainImage, label: "Has images", chip: "images" },
  ];
}
