import React from "react";

/* Amenity name -> icon, shared by Benefits.tsx (public site) and the Client
   Presentation overlay (src/app/c/[token]/PropertyOverlay.tsx) — one mapping,
   reused everywhere rather than duplicated. Icon picked by keyword (most
   specific first); a refined check-mark fallback only for truly unknown
   custom items. See Benefits.tsx for the original home of this file. */

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

// Order matters: the FIRST matching pattern wins, so specific/compound terms
// (e.g. "underfloor heating", "roof terrace") sit before generic ones ("floor").
const ICONS: { test: RegExp; icon: React.ReactNode }[] = [
  { test: /pool|swim/, icon: <Svg><path d="M3 18c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1" /><path d="M7 15V6a2 2 0 0 1 4 0v9M13 15V6a2 2 0 0 1 4 0" /></Svg> },
  { test: /roof|terrace/, icon: <Svg><path d="m3 11 9-6 9 6" /><path d="M6 10v9h12v-9" /><path d="M10 19v-4h4v4" /></Svg> },
  { test: /sea|ocean|beach/, icon: <Svg><path d="M2 16c1.5 0 1.5-1.2 3-1.2S6.5 16 8 16s1.5-1.2 3-1.2S12.5 16 14 16s1.5-1.2 3-1.2S18.5 16 20 16M2 20c1.5 0 1.5-1.2 3-1.2S6.5 20 8 20" /><circle cx="17" cy="7" r="3" /></Svg> },
  { test: /mountain/, icon: <Svg><path d="m3 19 6-9 4 6 2-3 6 6H3Z" /><circle cx="7" cy="7" r="1.5" /></Svg> },
  { test: /garden|landscap/, icon: <Svg><path d="M12 20v-6M12 14c-3 0-5-2-5-5 3 0 5 2 5 5ZM12 14c3 0 5-2 5-5-3 0-5 2-5 5Z" /></Svg> },
  { test: /bbq|barbec|grill/, icon: <Svg><path d="M6 8h12l-1.2 6.5a5 5 0 0 1-9.6 0L6 8Z" /><path d="M8 20l1-3M16 20l-1-3M10 4c0 1-1 1.5-1 2.5M14 4c0 1-1 1.5-1 2.5" /></Svg> },
  { test: /playground|children|kids|play/, icon: <Svg><path d="M12 2l7 7-7 7-7-7 7-7Z" /><path d="M12 16v4l2 2" /></Svg> },
  { test: /tennis|court/, icon: <Svg><circle cx="12" cy="12" r="9" /><path d="M4 6c4 3 4 9 0 12M20 6c-4 3-4 9 0 12" /></Svg> },
  { test: /lounge|sunbed|deck|relax/, icon: <Svg><path d="M4 18v-4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M4 18v2M20 18v2M7 12V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3" /></Svg> },
  { test: /gym|fitness/, icon: <Svg><path d="M4 9v6M20 9v6M7 6v12M17 6v12M7 12h10" /></Svg> },
  { test: /sauna|spa|steam/, icon: <Svg><path d="M12 3c1.6 2 2.4 3.6 2.4 5a2.4 2.4 0 0 1-4.8 0c0-1.4.8-3 2.4-5Z" /><path d="M5 21c1.5-1 2.5-1 4 0M15 21c1.5-1 2.5-1 4 0M6 15h12" /></Svg> },
  { test: /lobby|reception|entrance/, icon: <Svg><path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M4 21h16M14 12h.01" /></Svg> },
  { test: /concierge|bell/, icon: <Svg><path d="M4 19h16M6 19a6 6 0 0 1 12 0M12 6V4M10 4h4" /></Svg> },
  { test: /elevat|lift/, icon: <Svg><rect x="5" y="3" width="14" height="18" rx="2" /><path d="m9 9 1.5-2 1.5 2M12 15l1.5 2 1.5-2" /></Svg> },
  { test: /\bev\b|charg|e-?car/, icon: <Svg><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></Svg> },
  { test: /park/, icon: <Svg><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 16V8h3a2.5 2.5 0 0 1 0 5H9" /></Svg> },
  { test: /storage|store/, icon: <Svg><path d="M4 8l8-4 8 4v9l-8 4-8-4V8Z" /><path d="M4 8l8 4 8-4M12 12v9" /></Svg> },
  { test: /shower|changing/, icon: <Svg><path d="M4 4h6a4 4 0 0 1 4 4v2M18 10H2M6 14v1.5M10 13v1.5M14 14v1.5M8 18v1.5M12 17v1.5" /></Svg> },
  { test: /solar|photovolt|\bpv\b|panel/, icon: <Svg><rect x="3" y="12" width="18" height="8" rx="1" /><path d="M3 16h18M9 12v8M15 12v8" /><circle cx="12" cy="6" r="2" /><path d="M12 1v1M17 3l-1 1M7 3l1 1" /></Svg> },
  { test: /underfloor|floor ?heat/, icon: <Svg><path d="M8 3c1.5 2-1.5 3 0 5M12 3c1.5 2-1.5 3 0 5M16 3c1.5 2-1.5 3 0 5M4 21v-3h16v3M4 21h16" /></Svg> },
  { test: /vrv|vrf|air ?con|a\/c|climate|split unit|provision for a/, icon: <Svg><rect x="3" y="5" width="18" height="8" rx="2" /><path d="M7 17v1M12 17v2M17 17v1" /></Svg> },
  { test: /smart|automation/, icon: <Svg><path d="M4 11l8-6 8 6M6 10v9h12v-9" /><path d="M9 15a4 4 0 0 1 6 0M11 17a1.5 1.5 0 0 1 2 0" /></Svg> },
  { test: /wardrobe|closet|fitted|walk-?in/, icon: <Svg><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M12 3v18M9 10v2M15 10v2" /></Svg> },
  { test: /kitchen/, icon: <Svg><path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11M16 3c-1.5 0-2.5 2-2.5 4.5S15 11 16 11v10" /></Svg> },
  { test: /appliance|oven|dishwash/, icon: <Svg><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M5 9h14M9 6h.01M9 13h2" /></Svg> },
  { test: /ceramic|tile/, icon: <Svg><rect x="3" y="3" width="18" height="18" rx="1" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></Svg> },
  { test: /glaz|window|alumin/, icon: <Svg><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M12 3v18M4 12h16" /></Svg> },
  { test: /sanitary|en-?suite|bath|tap|faucet/, icon: <Svg><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3ZM6 12V6a2 2 0 0 1 3.5-1.3M8 5h2M6 19l-1 2M18 19l1 2" /></Svg> },
  { test: /cctv|camera|surveil/, icon: <Svg><path d="M3 7l13-3 1.5 5-13 3L3 7ZM17 8l4-1v5l-4-1M5 13v5h4" /></Svg> },
  { test: /intercom|door ?phone/, icon: <Svg><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M10 7h4M10 10h4M11 15h2" /></Svg> },
  { test: /alarm/, icon: <Svg><circle cx="12" cy="13" r="7" /><path d="M12 10v3l2 1M5 3 3 5M19 3l2 2" /></Svg> },
  { test: /pressuris|water/, icon: <Svg><path d="M12 3s6 6 6 10a6 6 0 0 1-12 0c0-4 6-10 6-10Z" /></Svg> },
  { test: /gated|security|secure|24|guard|safety/, icon: <Svg><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" /></Svg> },
  { test: /veranda|balcon|patio/, icon: <Svg><path d="M4 20V9l8-5 8 5v11M4 14h16M8 20v-6M12 20v-6M16 20v-6" /></Svg> },
  { test: /amenit|shop|mall|centre|center|conven/, icon: <Svg><path d="M4 7h16l-1 12H5L4 7Z" /><path d="M9 7V5a3 3 0 0 1 6 0v2" /></Svg> },
  { test: /furnish/, icon: <Svg><path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" /><path d="M3 11h18v6H3zM6 17v2M18 17v2" /></Svg> },
  { test: /corner/, icon: <Svg><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" /></Svg> },
  { test: /penthouse|floor|level|storey/, icon: <Svg><path d="M4 21V6l8-4 8 4v15M4 21h16M9 21v-4h6v4M8 9h.01M16 9h.01M8 13h.01M16 13h.01" /></Svg> },
  { test: /maid|staff|\broom\b/, icon: <Svg><path d="M3 18v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5M3 18v2M21 18v2M3 13V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3" /></Svg> },
  { test: /fireplace|fire/, icon: <Svg><path d="M12 3c3 4 5 6 5 9a5 5 0 0 1-10 0c0-1 .5-2.5 2-4 1 2 2 2 3 1-1-3-.5-5 0-6Z" /></Svg> },
  { test: /unobstruct|view|vista|panoram/, icon: <Svg><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="2.5" /></Svg> },
];
const FALLBACK = <Svg><path d="m5 12 4 4 10-10" /></Svg>;
export const iconFor = (name: string) => ICONS.find((i) => i.test.test(name.toLowerCase()))?.icon ?? FALLBACK;
