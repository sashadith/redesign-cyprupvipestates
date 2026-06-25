import LocaleSwitcher from "../LocaleSwitcher/LocaleSwitcher";
import { getHeaderByLang } from "@/sanity/sanity.utils";
import { Header as HeaderType } from "@/types/header";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import styles from "./Header.module.scss";
import Link from "next/link";
import NavWrapper from "../NavWrapper/NavWrapper";
import { Translation } from "@/types/homepage";
import { ButtonModal } from "../ButtonModal/ButtonModal";
import { localizedHref } from "@/lib/locale";

type Props = {
  translations?: Translation[];
  params: { lang: string };
};

const Header = async ({ translations, params }: Props) => {
  const data = await getHeaderByLang(params.lang);

  return (
    <header className={styles.header}>
      <div className="container">
        <div className={styles.wrapper}>
          <div className={styles.companyData}>
            <Link
              className={styles.logoLink}
              href={localizedHref(params.lang)}
            >
              <Image
                alt="Cyprus VIP Estates Logo"
                src={urlFor(data.logo).url()}
                width={300}
                height={300}
                className={styles.logoImage}
              />
              <Image
                alt="Cyprus VIP Estates Logo"
                src={urlFor(data.logoMobile).url()}
                width={40}
                height={40}
                unoptimized
                className={`${styles.logoImageMobile} logoImageMobile`}
              />
            </Link>
          </div>
          <div className={styles.contacts}>
            <div className={styles.navWrapperParent}>
              <NavWrapper navLinks={data.navLinks} params={params} />
            </div>
            <div className={styles.contactData}>
              <div className={styles.contactButtons}>
                <ButtonModal className={styles.headerCta}>
                  {params.lang === "de"
                    ? "Beratung anfragen"
                    : params.lang === "pl"
                      ? "Umów konsultację"
                      : params.lang === "ru"
                        ? "Получить консультацию"
                        : "Get Consultation"}
                </ButtonModal>
                <LocaleSwitcher translations={translations} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
