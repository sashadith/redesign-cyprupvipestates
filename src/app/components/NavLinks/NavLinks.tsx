"use client";

import Link from "next/link";
import { Header as HeaderType } from "@/types/header";
import styles from "../Header/Header.module.scss";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiChevronDown } from "react-icons/fi";

type Props = {
  navLinks: HeaderType["navLinks"];
  params: { lang: string };
  closeMenu: () => void;
};

const NavLinks: React.FC<Props> = ({ navLinks, params, closeMenu }) => {
  const [activeSection, setActiveSection] = useState("");
  const [isHomePage, setIsHomePage] = useState(false);
  const [openSubMenuIndex, setOpenSubMenuIndex] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const getNormalizedHref = (lang: string, link: string) => {
    const normalizedLink = link.startsWith("/") ? link.slice(1) : link;
    const languagePrefix = lang === "de" ? "" : `/${lang}`;

    return `${languagePrefix}/${normalizedLink}`;
  };

  useEffect(() => {
    setIsHomePage(
      params.lang === "de"
        ? window.location.pathname === "/"
        : window.location.pathname === `/${params.lang}`,
    );

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    const handleScroll = () => {
      let closestSectionId = "";
      let smallestDistance = Infinity;

      navLinks.forEach((navLink) => {
        if (navLink.link.startsWith("/")) return;

        const sectionElement = document.getElementById(navLink.link);

        if (sectionElement) {
          const distance = Math.abs(sectionElement.getBoundingClientRect().top);

          if (distance < smallestDistance) {
            smallestDistance = distance;
            closestSectionId = navLink.link;
          }
        }
      });

      setActiveSection(closestSectionId);
    };

    handleResize();
    handleScroll();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [navLinks, params.lang]);

  const toggleSubMenu = (index: number) => {
    setOpenSubMenuIndex(openSubMenuIndex === index ? null : index);
  };

  const scrollToSection = (sectionId: string) => {
    const sectionElement = document.getElementById(sectionId);

    if (sectionElement) {
      const offset =
        sectionElement.getBoundingClientRect().top + window.scrollY - 100;

      window.scrollTo({
        top: offset,
        behavior: "smooth",
      });
    } else if (!isHomePage) {
      window.location.href =
        params.lang === "de"
          ? `/#${sectionId}`
          : `/${params.lang}/#${sectionId}`;
    }
  };

  if (!navLinks) {
    return null;
  }

  return (
    <nav className={styles.navLinks}>
      {navLinks.map((link, index) => {
        const isPageLink = link.link.startsWith("/");
        const hasSubLinks = link.subLinks && link.subLinks.length > 0;

        return (
          <div
            key={link.label}
            className={`${styles.navLinkWrapper} ${
              isMobile && openSubMenuIndex === index
                ? styles.activeNavLinkWrapper
                : ""
            }`}
            onMouseEnter={() =>
              !isMobile && hasSubLinks && setOpenSubMenuIndex(index)
            }
            onMouseLeave={() =>
              !isMobile && hasSubLinks && setOpenSubMenuIndex(null)
            }
          >
            <div
              className={`${styles.navLinkInner} ${
                isMobile && openSubMenuIndex === index
                  ? styles.activeNavLink
                  : ""
              }`}
            >
              {isPageLink ? (
                <Link
                  href={getNormalizedHref(params.lang, link.link)}
                  className={`${styles.navLink} ${
                    activeSection === link.link ? styles.active : ""
                  }`}
                  onClick={(e) => {
                    if (isMobile && hasSubLinks) {
                      e.preventDefault();
                      toggleSubMenu(index);
                      return;
                    }

                    closeMenu();
                  }}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  href={`#${link.link}`}
                  onClick={(e) => {
                    e.preventDefault();

                    if (isMobile && hasSubLinks) {
                      toggleSubMenu(index);
                      return;
                    }

                    scrollToSection(link.link);
                    closeMenu();
                  }}
                  className={`${styles.navLink} ${
                    activeSection === link.link ? styles.active : ""
                  }`}
                >
                  {link.label}
                </a>
              )}

              {hasSubLinks && (
                <button
                  type="button"
                  className={styles.chevronButton}
                  onClick={() => toggleSubMenu(index)}
                  aria-label="Toggle submenu"
                >
                  <FiChevronDown
                    className={`${styles.chevron} ${
                      openSubMenuIndex === index ? styles.chevronOpen : ""
                    }`}
                  />
                </button>
              )}
            </div>

            {/* <AnimatePresence> */}
            {hasSubLinks && (
              <>
                {isMobile ? (
                  <AnimatePresence>
                    {openSubMenuIndex === index && (
                      <motion.div
                        className={styles.subLinks}
                        initial={{ maxHeight: 0, overflow: "hidden" }}
                        animate={{ maxHeight: "35vh", overflow: "auto" }}
                        exit={{ maxHeight: 0, overflow: "hidden" }}
                        transition={{ duration: 0.4 }}
                      >
                        <div className={styles.subLinksWrapper}>
                          {link.subLinks?.map((subLink) => (
                            <Link
                              key={subLink.label}
                              href={getNormalizedHref(
                                params.lang,
                                subLink.link,
                              )}
                              className={styles.subLink}
                              onClick={closeMenu}
                            >
                              {subLink.label}
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                ) : (
                  <div className={styles.subLinks}>
                    <div className={styles.subLinksWrapper}>
                      {link.subLinks?.map((subLink) => (
                        <Link
                          key={subLink.label}
                          href={getNormalizedHref(params.lang, subLink.link)}
                          className={styles.subLink}
                          onClick={closeMenu}
                        >
                          {subLink.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {/* </AnimatePresence> */}
          </div>
        );
      })}
    </nav>
  );
};

export default NavLinks;
