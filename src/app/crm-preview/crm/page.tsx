import { LogoFull, LogoMark } from "@/app/partner-portal/components/Brand";
import { requireOwner } from "../guard";

// Static sample of the CRM (no DB data) built from the real crm.css classes, so the owner's draft
// colours, fonts, sizes and corners show exactly as the CRM would render them.
export default async function CrmPreviewPage() {
  await requireOwner();
  return (
    <>
      <header className="crm-top">
        <span className="crm-logo">
          <LogoMark className="crm-logo-mark" />
          <LogoFull className="crm-logo-full" />
          <span aria-hidden="true">Office</span>
        </span>
        <nav className="crm-nav" aria-label="CRM">
          <a href="#">Today</a>
          <a href="#" className="on">Pipeline</a>
          <a href="#">Inbox <span className="n">3</span></a>
        </nav>
        <div className="crm-me"><span>Sample User</span><b aria-hidden="true">SU</b></div>
      </header>
      <main className="crm-main">
        <div className="crm-headrow">
          <div>
            <h1>Pipeline</h1>
            <p>Sample data for the design preview.</p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 260px) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
          <section className="crm-col s-OFFER" aria-label="Offer" style={{ minHeight: 0 }}>
            <div className="colh"><span className="dot" />Offer<span className="cnt">2</span><span className="sum">€840k</span></div>
            <div className="crm-cardwrap">
              <div className="crm-card s-OFFER">
                <div className="c-top"><b>Anna Schneider</b><span className="lang">DE</span></div>
                <div className="c-proj">Seafront villa, Paphos</div>
                <div className="c-meta"><span className="src partner">Partner</span><span className="age">3d</span><span className="av">SU</span></div>
              </div>
            </div>
            <div className="crm-cardwrap">
              <div className="crm-card s-OFFER">
                <div className="c-top"><b>Piotr Nowak</b><span className="lang">PL</span></div>
                <div className="c-proj">Two-bedroom apartment, Limassol</div>
                <div className="c-meta"><span className="src">Website</span><span className="age warn">12d</span><span className="av none">—</span></div>
              </div>
            </div>
          </section>
          <section className="crm-panel" style={{ display: "grid", gap: 14 }}>
            <div className="crm-ck-title">
              <span className="crm-ck-status s-VIEWING_SCHEDULED"><span className="dot" />Viewing scheduled</span>
              <span className="crm-pill">Default</span>
            </div>
            <label className="crm-ck-field">
              Next step
              <input defaultValue="Call back on Thursday" />
            </label>
            <p className="crm-muted" style={{ margin: 0 }}>Last contact two days ago by phone.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="crm-btn primary">Save</button>
              <button type="button" className="crm-btn">Cancel</button>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
