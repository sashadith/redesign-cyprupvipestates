type PropertyType = "Apartment" | "Villa";

type PropertyPurpose = "Sale" | "Rent";

type PropertyTypeClassification =
  | "Residential"
  | "Commercial"
  | "Investment"
  | "Exclusive";

type MarketType = "Primary" | "Secondary";

export type ImageAlt = {
  _key: string;
  _type: "image";
  alt?: string; // Добавлено поле alt для текстового описания изображения
  asset: {
    _ref: string;
    _type: "reference";
  };
};

export type GeoPoint = {
  _type: "geopoint";
  lat: number;
  lng: number;
  alt?: number;
};

export type Distances = {
  toCenter?: string;
  toBeach?: string;
  toAirport?: string;
  toShop?: string;
  toSchool?: string;
  toGolf?: string;
};

export type Seo = {
  metaTitle: string;
  metaDescription: string;
};

export type Property = {
  _id: string;
  _type: "property";
  seo: Seo;
  title: string;
  excerpt: string;
  previewImage: ImageAlt;
  price: number;
  videoId?: string;
  videoPreview?: ImageAlt;
  images: ImageAlt[];
  address: string;
  city: string;
  district: string;
  description: any;
  type: PropertyType;
  purpose: PropertyPurpose;
  propertyType: PropertyTypeClassification;
  location: GeoPoint;
  floorSize: number;
  rooms: number;
  hasParking?: boolean;
  hasPool?: boolean;
  distances?: Distances;
  marketType?: MarketType;
  isActual: boolean;
  language: string;
  slug: {
    [lang: string]: {
      current: string;
    };
  };
  _translations: [
    {
      slug: {
        [lang: string]: {
          current: string;
        };
      };
    },
  ];
};
