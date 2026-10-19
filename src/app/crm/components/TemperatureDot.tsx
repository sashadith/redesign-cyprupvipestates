import { temperatureLabel, temperatureText, type PublicTemperature } from "@/lib/crm/insights/temperatureWiring";

// Lead temperature marks (CRM v2 phase 4a). Server-safe, no state: used by the board's client
// cards, the server-rendered cockpit header and the Today lists.

export function TemperatureDot({ temperature }: { temperature: PublicTemperature }) {
  const text = temperatureText(temperature);
  return (
    <span className={`crm-temp crm-temp-${temperature.level}`} title={text}>
      <span className="crm-temp-dot" aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </span>
  );
}

export function TemperatureChip({ temperature }: { temperature: PublicTemperature }) {
  const shown = temperature.reasons.slice(0, 3);
  return (
    <span className={`crm-temp-chip crm-temp-${temperature.level}`} title={temperatureText(temperature)}>
      <span className="crm-temp-dot" aria-hidden="true" />
      <b>{temperatureLabel(temperature.level)}</b>
      {shown.length > 0 && <span className="crm-temp-why">{shown.join(" · ")}</span>}
    </span>
  );
}
