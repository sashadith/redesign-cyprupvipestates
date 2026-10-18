import Link from "next/link";
import { PARTNER_LOCALES, type PartnerDict, type PartnerLocale } from "@/lib/partner/i18n";
import { logoutAction } from "../sessionActions";
import { LanguageSwitcher } from "./LanguageSwitcher";

type Props = { locale: PartnerLocale; t: PartnerDict; loggedIn: boolean; children: React.ReactNode };

export function PortalShell({ locale, t, loggedIn, children }: Props) {
  return (
    <>
      <header className="pp-top">
        <Link href={loggedIn ? "/home" : "/"} className="pp-logo" aria-label="Cyprus VIP Estates · Partner">
          <i aria-hidden="true">CV</i>
          <span>Cyprus VIP Estates · Partner</span>
        </Link>
        {loggedIn && (
          <nav className="pp-nav" aria-label="Partner">
            <Link href="/home">{t.nav.home}</Link>
            <Link href="/profile">{t.nav.profile}</Link>
            <form action={logoutAction}>
              <button type="submit" className="pp-linkbtn">{t.nav.logout}</button>
            </form>
          </nav>
        )}
        <LanguageSwitcher current={locale} locales={PARTNER_LOCALES} label={t.nav.language} />
      </header>
      <main className="pp-main">{children}</main>
      <footer className="pp-foot">
        <span>© {new Date().getFullYear()} {t.footer.brand}. {t.footer.rights}</span>
        <Link href="/agreement">{t.footer.agreement}</Link>
      </footer>
    </>
  );
}
