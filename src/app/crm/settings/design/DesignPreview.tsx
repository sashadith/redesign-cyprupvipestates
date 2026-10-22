"use client";
import type { GlobalSettings, SetValues } from "@/lib/design/theme";

// The three preview panes. Task 7 points the CRM and portal frames at /crm-preview/* and posts
// the draft (cssVars of `draft` + `global`) into them; the email frame gets the rendered mail.
// Until then they are empty placeholders with their final ids.
export function DesignPreview({ draft: _draft, global: _global }: { draft: SetValues; global: GlobalSettings }) {
  return (
    <section className="crm-panel crm-ds-preview" aria-label="Preview">
      <h2>Preview</h2>
      <div className="crm-ds-frames">
        <figure><figcaption>CRM</figcaption><iframe id="ds-prev-crm" title="CRM preview" /></figure>
        <figure><figcaption>Partner portal</figcaption><iframe id="ds-prev-portal" title="Partner portal preview" /></figure>
        <figure><figcaption>Partner email</figcaption><iframe id="ds-prev-email" title="Partner email preview" sandbox="" /></figure>
      </div>
    </section>
  );
}
