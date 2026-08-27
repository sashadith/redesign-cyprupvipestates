// CVE Dark — the house map style, replacing the CARTO raster basemap.
//
// CARTO started stamping "API KEY REQUIRED" into every tile served without a
// registered key (2026-08), which watermarked every map on the site including
// the client presentation links. This is a vector style rendered by MapLibre
// instead: the colours come from design-tokens.css, so the map is part of the
// design system rather than a tinted third-party image.
//
// Champagne is deliberately absent from the map itself — it is reserved for the
// project pin, which would otherwise lose its contrast against gold roads.
//
// The tile source is OpenFreeMap (no key, no quota). Swapping to self-hosted
// vector tiles later means changing `sources` only; every layer below stays.
import type { StyleSpecification } from "maplibre-gl";

export const CVE_MAP_STYLE = {
  "version": 8,
  "name": "CVE Dark",
  "metadata": {
    "cve:palette": "sea-deep #081512 · sea #102826 · bronze #8E6B3D · champagne #C29A5E · ivory #EFE9DB",
    "cve:note": "Champagne is reserved for the project pins. The map itself stays bronze-muted so the gold markers keep their contrast."
  },
  "glyphs": "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  "sources": {
    "openmaptiles": {
      "type": "vector",
      "url": "https://tiles.openfreemap.org/planet"
    }
  },
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": {
        "background-color": "#121e19"
      }
    },
    {
      "id": "landcover-wood",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "filter": [
        "in",
        "class",
        "wood",
        "forest"
      ],
      "paint": {
        "fill-color": "#16251e",
        "fill-opacity": 0.9
      }
    },
    {
      "id": "landcover-grass",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landcover",
      "filter": [
        "in",
        "class",
        "grass",
        "scrub"
      ],
      "paint": {
        "fill-color": "#142119",
        "fill-opacity": 0.8
      }
    },
    {
      "id": "landuse-residential",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "landuse",
      "filter": [
        "==",
        "class",
        "residential"
      ],
      "paint": {
        "fill-color": "#0e1a14"
      }
    },
    {
      "id": "water",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "water",
      "paint": {
        "fill-color": "#040c0b"
      }
    },
    {
      "id": "waterway",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "waterway",
      "paint": {
        "line-color": "#0a1f1d",
        "line-width": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          8,
          0.4,
          16,
          1.6
        ]
      }
    },
    {
      "id": "building",
      "type": "fill",
      "source": "openmaptiles",
      "source-layer": "building",
      "minzoom": 13,
      "paint": {
        "fill-color": "#192922",
        "fill-outline-color": "#22352e",
        "fill-opacity": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          13,
          0,
          15,
          0.85
        ]
      }
    },
    {
      "id": "road-minor",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "filter": [
        "in",
        "class",
        "minor",
        "service",
        "track"
      ],
      "minzoom": 12,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#202b25",
        "line-width": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          12,
          0.4,
          18,
          3.5
        ]
      }
    },
    {
      "id": "road-secondary",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "filter": [
        "in",
        "class",
        "secondary",
        "tertiary"
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#3b3020",
        "line-width": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          8,
          0.4,
          12,
          1.1,
          18,
          5
        ]
      }
    },
    {
      "id": "road-primary",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "filter": [
        "all",
        [
          "in",
          "class",
          "primary"
        ],
        [
          "!=",
          "ramp",
          1
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#58442a",
        "line-width": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          7,
          0.5,
          12,
          1.6,
          18,
          6.5
        ]
      }
    },
    {
      "id": "road-ramp",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "filter": [
        "==",
        "ramp",
        1
      ],
      "minzoom": 11,
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#58442a",
        "line-width": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          11,
          0.4,
          14,
          1.3,
          18,
          3.2
        ],
        "line-opacity": 0.9
      }
    },
    {
      "id": "road-trunk",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "transportation",
      "filter": [
        "all",
        [
          "in",
          "class",
          "motorway",
          "trunk"
        ],
        [
          "!=",
          "ramp",
          1
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#725a35",
        "line-width": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          5,
          0.5,
          10,
          1.8,
          14,
          4.5,
          18,
          9
        ],
        "line-opacity": 0.95
      }
    },
    {
      "id": "aeroway-runway",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "aeroway",
      "filter": [
        "==",
        "class",
        "runway"
      ],
      "minzoom": 10,
      "paint": {
        "line-color": "#2e271a",
        "line-width": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          10,
          1,
          16,
          10
        ]
      }
    },
    {
      "id": "boundary-country",
      "type": "line",
      "source": "openmaptiles",
      "source-layer": "boundary",
      "filter": [
        "<=",
        "admin_level",
        2
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-color": "#323e37",
        "line-width": 1,
        "line-dasharray": [
          3,
          2
        ]
      }
    },
    {
      "id": "place-minor",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "place",
      "filter": [
        "in",
        "class",
        "village",
        "suburb",
        "neighbourhood"
      ],
      "minzoom": 11,
      "layout": {
        "text-field": [
          "coalesce",
          [
            "get",
            "name:en"
          ],
          [
            "get",
            "name:latin"
          ],
          [
            "get",
            "name"
          ]
        ],
        "text-font": [
          "Noto Sans Regular"
        ],
        "text-size": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          11,
          10,
          16,
          13
        ],
        "text-letter-spacing": 0.06
      },
      "paint": {
        "text-color": "#93A49B",
        "text-halo-color": "#081512",
        "text-halo-width": 1.4
      }
    },
    {
      "id": "place-town",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "place",
      "filter": [
        "in",
        "class",
        "town",
        "city"
      ],
      "layout": {
        "text-field": [
          "coalesce",
          [
            "get",
            "name:en"
          ],
          [
            "get",
            "name:latin"
          ],
          [
            "get",
            "name"
          ]
        ],
        "text-font": [
          "Noto Sans Regular"
        ],
        "text-size": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          6,
          11,
          14,
          17
        ],
        "text-letter-spacing": 0.1,
        "text-transform": "uppercase"
      },
      "paint": {
        "text-color": "#EFE9DB",
        "text-halo-color": "#081512",
        "text-halo-width": 1.6
      }
    },
    {
      "id": "water-name",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "water_name",
      "layout": {
        "text-field": [
          "coalesce",
          [
            "get",
            "name:en"
          ],
          [
            "get",
            "name:latin"
          ],
          [
            "get",
            "name"
          ]
        ],
        "text-font": [
          "Noto Sans Regular"
        ],
        "text-size": 12,
        "text-letter-spacing": 0.16,
        "text-transform": "uppercase"
      },
      "paint": {
        "text-color": "#5E7C74",
        "text-halo-color": "#04100E",
        "text-halo-width": 1.2
      }
    },
    {
      "id": "road-name",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "transportation_name",
      "minzoom": 13,
      "filter": [
        "in",
        "class",
        "motorway",
        "trunk",
        "primary",
        "secondary"
      ],
      "layout": {
        "symbol-placement": "line",
        "symbol-spacing": 420,
        "text-field": [
          "coalesce",
          [
            "get",
            "name:en"
          ],
          [
            "get",
            "name:latin"
          ],
          [
            "get",
            "name"
          ]
        ],
        "text-font": [
          "Noto Sans Regular"
        ],
        "text-size": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          13,
          8.5,
          17,
          10.5
        ],
        "text-letter-spacing": 0.08,
        "text-max-angle": 32,
        "text-padding": 14
      },
      "paint": {
        "text-color": "rgba(239,233,219,0.52)",
        "text-halo-color": "#0A1512",
        "text-halo-width": 1.2,
        "text-halo-blur": 0.4
      }
    }
  ]
} as StyleSpecification;

/** Bounding box of Cyprus — the only area any of our maps ever shows. */
export const CYPRUS_BOUNDS: [[number, number], [number, number]] = [
  [32.1, 34.45],
  [34.1, 35.15],
];

/** Island centre, in MapLibre's [lng, lat] order (Leaflet used [lat, lng]). */
export const CYPRUS_CENTER: [number, number] = [32.95, 34.85];
