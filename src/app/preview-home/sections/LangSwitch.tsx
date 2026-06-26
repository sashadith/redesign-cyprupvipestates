import { Globe, ChevronDown, LANGS, flag } from "./navShared";

/* Glass language switcher for the desktop nav. Hover/focus reveals the panel;
   a transparent bridge keeps it open while moving to the items. Visual for now
   (wiring to real locale routes later). Hidden on mobile (lang lives in the burger). */

const LangSwitch = () => (
  <div className="lang">
    <button className="lang__btn" type="button" aria-haspopup="true" aria-label="Select language">
      <Globe />
      <span className="lang__cur">EN</span>
      <ChevronDown />
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
