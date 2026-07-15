import { iconFor } from "./amenityIcons";

/* Project amenities as gold-accented chips with matching icons. Aggregated from
   the units' feature lists. Icon mapping lives in ./amenityIcons.tsx — shared
   with the Client Presentation overlay (src/app/c/[token]/PropertyOverlay.tsx)
   so both surfaces use the exact same icon set. */

export default function Benefits({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="pp-benefits">
      {items.map((b) => (
        <li className="pp-benefit" key={b}>
          <span className="pp-benefit__ic">{iconFor(b)}</span>
          {b}
        </li>
      ))}
    </ul>
  );
}
