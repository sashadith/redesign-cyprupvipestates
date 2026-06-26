import { Globe, ChevronDown, LANGS } from "./navShared";

/* Glass language switcher for the desktop nav. Hover/focus reveals the panel;
   a transparent bridge keeps it open while moving to the items. Text-only
   options. Hidden on mobile (language lives in the burger menu). */

const LangSwitch = () => (
  <div className="lang">
    <button className="lang__btn" type="button" aria-haspopup="true" aria-label="Select language">
      <Globe />
      <span className="lang__cur">EN</span>
      <ChevronDown />
    </button>
    <div className="lang__menu" role="menu">
      {LANGS.map(([code, name]) => (
        <a key={code} href="#" role="menuitem" className={code === "EN" ? "is-active" : ""}>
          <span className="lang__name">{name}</span>
        </a>
      ))}
    </div>
  </div>
);

export default LangSwitch;
