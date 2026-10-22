import { LogoFull, LogoMark } from "@/app/partner-portal/components/Brand";
import { requireOwner } from "../guard";

// Static sample of the partner portal (no DB data) built from the real portal.css classes, so the
// owner's draft colours, fonts, sizes and corners show exactly as the portal would render them.
export default async function PortalPreviewPage() {
  await requireOwner();
  return (
    <>
      <header className="pp-top">
        <div className="pp-top-in">
          <a href="#" className="pp-logo">
            <LogoFull className="pp-logo-full" />
            <LogoMark className="pp-logo-mark" />
            <span className="pp-logo-tag">Partner programme</span>
          </a>
          <nav className="pp-nav" aria-label="Partner">
            <a href="#">Overview</a>
            <a href="#">Submit a client</a>
            <a href="#">Clients</a>
          </nav>
        </div>
      </header>
      <main className="pp-main">
        <div className="pp-stack">
          <section className="pp-card">
            <p className="pp-eyebrow">Your clients</p>
            <h1>Welcome back, Anna</h1>
            <p>Your client Piotr Nowak has a viewing next week. <a href="#">See the details</a></p>
            <p><span className="pp-state pp-state-stage">Viewing scheduled</span></p>
            <form className="pp-form">
              <div className="pp-field">
                <label htmlFor="pp-prev-name">Client name</label>
                <input id="pp-prev-name" defaultValue="Maria Ivanova" />
              </div>
              <div><button type="button" className="pp-btn">Submit a client</button></div>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}
