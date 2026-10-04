/* Small line icons for the CRM's action buttons.
 *
 * Deliberately the same drawing language as NavIcons: 24-unit box, 1.8 stroke,
 * currentColor, no fill. They ride alongside a word rather than replacing it —
 * an icon-only "Email log" would be a riddle — so they are sized to sit on the
 * text baseline and inherit its colour, which keeps a disabled or hovered
 * button consistent without a second rule. */
export function ActionIcon({ k, size = 14 }: { k: string; size?: number }) {
  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.8,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    className: "shrink-0",
    "aria-hidden": true,
  };
  switch (k) {
    case "email":
      return (<svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>);
    case "whatsapp":
      return (<svg {...common}><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.2-5.2A8.5 8.5 0 1 1 21 11.5z" /></svg>);
    case "sparkle":
      return (<svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></svg>);
    case "calendar":
      return (<svg {...common}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>);
    case "email-log":
      return (<svg {...common}><rect x="3" y="5" width="14" height="11" rx="2" /><path d="m3 7 7 4.5L17 7" /><circle cx="18" cy="17" r="4" /><path d="M18 15.5V17l1 .8" /></svg>);
    case "budget":
      return (<svg {...common}><path d="M14 6a6 6 0 1 0 0 12" /><path d="M4 10h7M4 14h7" /></svg>);
    case "clock":
      return (<svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
    case "card":
      return (<svg {...common}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>);
    case "home":
      return (<svg {...common}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>);
    case "note":
      return (<svg {...common}><path d="M4 4h16v12l-4 4H4z" /><path d="M20 16h-4v4" /><path d="M8 9h8M8 13h5" /></svg>);
    case "phone":
      return (<svg {...common}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>);
    case "save":
      return (<svg {...common}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>);
    case "plus":
      return (<svg {...common}><path d="M12 5v14M5 12h14" /></svg>);
    default:
      return null;
  }
}
