/* Stylish glass language switcher for the nav (preview). EN active; hover/focus
   reveals the others. Visual for now — wiring to real locale routes later. */

const Globe = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.2" />
    <path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);
const Chevron = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
    <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* [code, name, ISO country code for the flag SVG] */
const LANGS: [string, string, string][] = [
  ["EN", "English", "GB"],
  ["DE", "Deutsch", "DE"],
  ["PL", "Polski", "PL"],
  ["RU", "Русский", "RU"],
];
const flag = (cc: string) =>
  `https://purecatamphetamine.github.io/country-flag-icons/3x2/${cc}.svg`;

const LangSwitch = () => (
  <div className="lang">
    <button className="lang__btn" type="button" aria-haspopup="true" aria-label="Select language">
      <Globe />
      <span className="lang__cur">EN</span>
      <Chevron />
    </button>
    <div className="lang__menu" role="menu">
      {LANGS.map(([code, name, cc]) => (
        <a key={code} href="#" role="menuitem" className={code === "EN" ? "is-active" : ""}>
          <img className="lang__flag" src={flag(cc)} alt="" width={24} height={16} />
          <span className="lang__name">{name}</span>
        </a>
      ))}
    </div>
  </div>
);

export default LangSwitch;
