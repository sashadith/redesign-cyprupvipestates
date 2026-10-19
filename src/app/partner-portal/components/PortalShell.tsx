import Link from "next/link";
import { PARTNER_LOCALES, type PartnerDict, type PartnerLocale } from "@/lib/partner/i18n";
import { logoutAction } from "../sessionActions";
import { LogoFull, LogoMark } from "./Brand";
import { LanguageSwitcher } from "./LanguageSwitcher";

/** `active`: the partner is approved (ACTIVE) — pending partners keep the 3a home/profile navigation. */
type Props = { locale: PartnerLocale; t: PartnerDict; loggedIn: boolean; active?: boolean; children: React.ReactNode };

export function PortalShell({ locale, t, loggedIn, active = false, children }: Props) {
  return (
    <>
      <header className="pp-top">
        <div className="pp-top-in">
          <Link href={loggedIn ? "/home" : "/"} className="pp-logo">
            <LogoFull className="pp-logo-full" />
            <LogoMark className="pp-logo-mark" />
            <span className="pp-logo-tag">{t.landing.title}</span>
          </Link>
          {loggedIn && (
            <nav className="pp-nav" aria-label="Partner">
              {active ? (
                <>
                  <Link href="/home">{t.nav.overview}</Link>
                  <Link href="/submit">{t.nav.submit}</Link>
                  <Link href="/clients">{t.nav.clients}</Link>
                  <Link href="/presentations">{t.nav.presentations}</Link>
                  <Link href="/commissions">{t.nav.commissions}</Link>
                  <Link href="/rating">{t.nav.rating}</Link>
                  <Link href="/projects">{t.nav.projects}</Link>
                  <Link href="/calculator">{t.nav.calculator}</Link>
                  <Link href="/materials">{t.nav.materials}</Link>
                </>
              ) : (
                <Link href="/home">{t.nav.home}</Link>
              )}
              <Link href="/profile">{t.nav.profile}</Link>
              <form action={logoutAction}>
                <button type="submit" className="pp-linkbtn">{t.nav.logout}</button>
              </form>
            </nav>
          )}
          <LanguageSwitcher current={locale} locales={PARTNER_LOCALES} label={t.nav.language} />
        </div>
      </header>
      <main className="pp-main">{children}</main>
      <footer className="pp-foot">
        <div className="pp-foot-in">
          <LogoMark className="pp-foot-mark" />
          <span>© {new Date().getFullYear()} {t.footer.brand}. {t.footer.rights}</span>
          <Link href="/agreement">{t.footer.agreement}</Link>
        </div>
      </footer>
    </>
  );
}
