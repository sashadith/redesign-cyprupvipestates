import { renderToBuffer } from "@react-pdf/renderer";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { getProjectByLang } from "@/sanity/sanity.utils";
import { urlFor } from "@/sanity/sanity.client";
import { formatMonthYear } from "@/lib/formatMonthYear";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

// react-pdf renders server-side, so images are read straight from the local
// filesystem (public/uploads). This is domain-independent — it works during
// staging and after cutover, with no dependency on the public site URL.
const PUBLIC_DIR = fs.realpathSync(path.join(process.cwd(), "public"));
const toLocalFile = (u?: string | null): string | undefined => {
  if (!u) return undefined;
  const rel = u.replace(/^https?:\/\/[^/]+/, "");
  // Resolve and confirm the path stays within PUBLIC_DIR (defends against
  // `../` traversal should a less-trusted source ever reach this helper).
  const resolved = path.resolve(PUBLIC_DIR, "." + (rel.startsWith("/") ? rel : "/" + rel));
  if (resolved !== PUBLIC_DIR && !resolved.startsWith(PUBLIC_DIR + path.sep)) {
    return undefined;
  }
  return resolved;
};

// Self-hosted font (DejaVuSans has the Cyrillic/umlaut coverage the PDFs need).
// Read from the local filesystem — no jsdelivr fetch at render time.
Font.register({
  family: "DejaVuSans",
  src: path.join(PUBLIC_DIR, "fonts", "DejaVuSans.ttf"),
});

const LOGO_URL =
  "/uploads/images/862e62ebddfc232ff9838efb63eb28685b515eb4-400x208.png";

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontSize: 12,
    backgroundColor: "#02060b",
    color: "#ffffff",
    fontFamily: "DejaVuSans",
  },

  heroWrapper: {
    position: "relative",
  },

  image: {
    width: "100%",
    height: 190,
    objectFit: "cover",
  },

  logoBg: {
    position: "absolute",
    top: 18,
    left: 36,
    width: 128,
    height: 70,
    backgroundColor: "#ffffff",
    opacity: 0.92,
  },

  logo: {
    position: "absolute",
    top: 24,
    left: 46,
    width: 108,
    height: 56,
    objectFit: "contain",
  },

  content: {
    paddingTop: 14,
    paddingHorizontal: 40,
    paddingBottom: 12,
  },

  title: {
    fontSize: 26,
    marginBottom: 6,
    color: "#ffffff",
  },

  price: {
    fontSize: 18,
    marginBottom: 12,
    color: "#bd8948",
  },

  excerpt: {
    fontSize: 10,
    lineHeight: 1.4,
    marginBottom: 18,
    color: "#ffffff",
  },

  sectionTitle: {
    fontSize: 16,
    marginBottom: 10,
    color: "#ffffff",
  },

  section: {
    marginBottom: 15,
  },

  divider: {
    width: "100%",
    height: 1.5,
    backgroundColor: "#b88a45",
    marginBottom: 14,
  },

  featuresGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  featureItem: {
    width: "22%",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: 14,
  },

  featureLabel: {
    fontSize: 9,
    color: "#b8b8b8",
    marginBottom: 4,
    textAlign: "center",
  },

  featureValue: {
    fontSize: 11,
    color: "#ffffff",
    textAlign: "center",
  },

  distanceGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  distanceItem: {
    width: "22%",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: 14,
  },

  distanceIcon: {
    width: 24,
    aspectRatio: 1,
    marginBottom: 6,
    objectFit: "contain",
  },

  distanceContent: {
    flexDirection: "column",
    alignItems: "center",
  },

  distanceLabel: {
    fontSize: 8.5,
    color: "#b8b8b8",
    marginBottom: 3,
    textAlign: "center",
  },

  distanceValue: {
    fontSize: 10,
    color: "#ffffff",
    textAlign: "center",
  },

  overviewSection: {
    marginBottom: 18,
  },

  footer: {
    marginTop: 4,
    paddingTop: 8,
    alignItems: "center",
  },

  footerTitle: {
    fontSize: 12,
    color: "#ffffff",
    marginBottom: 4,
    textAlign: "center",
  },

  footerSubtitle: {
    fontSize: 9,
    color: "#b8b8b8",
    marginBottom: 10,
    textAlign: "center",
  },

  footerContact: {
    fontSize: 9,
    color: "#ffffff",
    marginBottom: 3,
    textAlign: "center",
  },

  footerWebsite: {
    fontSize: 9,
    color: "#bd8948",
    marginTop: 4,
    textAlign: "center",
  },
});

type Props = {
  params: Promise<{
    lang: string;
    slug: string;
  }>;
};

function getLabel(lang: string, labels: Record<string, string>) {
  return labels[lang] || labels.en;
}

const cityTranslations: Record<string, Record<string, string>> = {
  Paphos: {
    en: "Paphos",
    de: "Paphos",
    pl: "Pafos",
    ru: "Пафос",
  },
  Limassol: {
    en: "Limassol",
    de: "Limassol",
    pl: "Limassol",
    ru: "Лимассол",
  },
  Larnaca: {
    en: "Larnaca",
    de: "Larnaca",
    pl: "Larnaca",
    ru: "Ларнака",
  },
};

export async function GET(_request: Request, { params }: Props) {
  const { lang, slug } = await params;

  const project = await getProjectByLang(lang, slug);

  if (!project) {
    return new Response("Project not found", { status: 404 });
  }

  const previewImageUrl = project.previewImage
    ? toLocalFile(urlFor(project.previewImage).width(1200).height(700).fit("crop").url())
    : null;

  const completion = project.keyFeatures?.completionDate
    ? formatMonthYear(project.keyFeatures.completionDate, lang, {
        capitalize: true,
      })
    : null;

  const city = project.keyFeatures?.city
    ? cityTranslations[project.keyFeatures.city]?.[lang] ||
      project.keyFeatures.city
    : null;

  const price = project.keyFeatures?.price
    ? `${project.keyFeatures.price.toLocaleString()} €`
    : null;

  const features = [
    {
      label: getLabel(lang, {
        en: "City",
        de: "Stadt",
        pl: "Miasto",
        ru: "Город",
      }),
      value: city,
    },
    {
      label: getLabel(lang, {
        en: "Type",
        de: "Typ",
        pl: "Typ",
        ru: "Тип",
      }),
      value: project.keyFeatures?.propertyType,
    },
    {
      label: getLabel(lang, {
        en: "Bedrooms",
        de: "Schlafzimmer",
        pl: "Sypialnie",
        ru: "Спальни",
      }),
      value: project.keyFeatures?.bedrooms,
    },
    {
      label: getLabel(lang, {
        en: "Completion month",
        de: "Fertigstellungsmonat",
        pl: "Miesiąc zakończenia",
        ru: "Месяц завершения",
      }),
      value: completion,
    },
  ].filter((item) => item.value);

  const distanceItems = [
    {
      value: project.distances?.beach,
      icon: "https://cyprusvipestates.com/uploads/files/21910cdeda8b4c0b1273cb9e487ea1c16873fcd7.png",
      label: getLabel(lang, {
        en: "Beach",
        de: "Strand",
        pl: "Plaża",
        ru: "Пляж",
      }),
    },
    {
      value: project.distances?.restaurants,
      icon: "https://cyprusvipestates.com/uploads/files/2667dfd1da48a595caf5f9d65c27df5c70695ae1.png",
      label: getLabel(lang, {
        en: "Restaurants",
        de: "Restaurants",
        pl: "Restauracje",
        ru: "Рестораны",
      }),
    },
    {
      value: project.distances?.shops,
      icon: "https://cyprusvipestates.com/uploads/files/91095253a8e1d58c1f8eb5a5356c3ec11e1f7d31.png",
      label: getLabel(lang, {
        en: "Shops",
        de: "Supermarkt",
        pl: "Sklepy",
        ru: "Магазины",
      }),
    },
    {
      value: project.distances?.airport,
      icon: "https://cyprusvipestates.com/uploads/files/a9935ed23f1f65da3447f3a896c879659619badd.png",
      label: getLabel(lang, {
        en: "Airport",
        de: "Flughafen",
        pl: "Lotnisko",
        ru: "Аэропорт",
      }),
    },
    {
      value: project.distances?.hospital,
      icon: "https://cyprusvipestates.com/uploads/files/87c44c6343496d1f4e1990505b571ae0b959d7e9.png",
      label: getLabel(lang, {
        en: "Hospital",
        de: "Klinik",
        pl: "Szpital",
        ru: "Больница",
      }),
    },
    {
      value: project.distances?.school,
      icon: "https://cyprusvipestates.com/uploads/files/080c0ffcaa49fb8967915d21cadcd6b2b286b5d3.png",
      label: getLabel(lang, {
        en: "School",
        de: "Schule",
        pl: "Szkoła",
        ru: "Школа",
      }),
    },
    {
      value: project.distances?.cityCenter,
      icon: "https://cyprusvipestates.com/uploads/files/18fd16655d5281fa114048456caee2eeffcb2b73.png",
      label: getLabel(lang, {
        en: "City center",
        de: "Zentrum",
        pl: "Centrum miasta",
        ru: "Центр города",
      }),
    },
    {
      value: project.distances?.golfCourt,
      icon: "https://cyprusvipestates.com/uploads/files/d72f5770e677f6830968baefeb4129ee9da2acc3.png",
      label: getLabel(lang, {
        en: "Golf court",
        de: "Golfplatz",
        pl: "Pole golfowe",
        ru: "Поле для гольфа",
      }),
    },
  ].filter((item) => item.value);

  const pdfBuffer = await renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        {previewImageUrl && (
          <View style={styles.heroWrapper}>
            <Image src={previewImageUrl} style={styles.image} />
            <View style={styles.logoBg} />
            <Image src={toLocalFile(LOGO_URL)} style={styles.logo} />
          </View>
        )}

        <View style={styles.content}>
          <Text style={styles.title}>{project.title}</Text>

          {price && (
            <Text style={styles.price}>
              {getLabel(lang, {
                en: "Price from",
                de: "Preis ab",
                pl: "Cena od",
                ru: "Цена от",
              })}{" "}
              {price}
            </Text>
          )}

          {project.excerpt && (
            <Text style={styles.excerpt}>{project.excerpt}</Text>
          )}

          <View style={styles.overviewSection}>
            <Text style={styles.sectionTitle}>
              {getLabel(lang, {
                en: "Project overview",
                de: "Projektübersicht",
                pl: "Przegląd projektu",
                ru: "Обзор проекта",
              })}
            </Text>

            <View style={styles.divider} />

            <View style={styles.featuresGrid}>
              {features.map((feature) => (
                <View key={feature.label} style={styles.featureItem}>
                  <Text style={styles.featureLabel}>{feature.label}</Text>
                  <Text style={styles.featureValue}>
                    {String(feature.value)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {distanceItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {getLabel(lang, {
                  en: "Distances",
                  de: "Entfernungen",
                  pl: "Odległości",
                  ru: "Расстояния",
                })}
              </Text>

              <View style={styles.divider} />

              <View style={styles.distanceGrid}>
                {distanceItems.map((item) => (
                  <View key={item.label} style={styles.distanceItem}>
                    <Image src={toLocalFile(item.icon)} style={styles.distanceIcon} />

                    <View style={styles.distanceContent}>
                      <Text style={styles.distanceLabel}>{item.label}</Text>
                      <Text style={styles.distanceValue}>
                        {item.value} {lang === "ru" ? "мин" : "min"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
          <View style={styles.footer}>
            <Text style={styles.footerTitle}>Cyprus VIP Estates</Text>

            <Text style={styles.footerSubtitle}>
              {getLabel(lang, {
                en: "Local expertise for Cyprus property decisions",
                de: "Lokale Expertise für Immobilienentscheidungen auf Zypern",
                pl: "Lokalna wiedza wspierająca decyzje dotyczące nieruchomości na Cyprze",
                ru: "Локальная экспертиза для решений по недвижимости на Кипре",
              })}
            </Text>

            <Text style={styles.footerContact}>+357 25 257 575</Text>

            <Text style={styles.footerContact}>
              office@cyprusvipestates.com
            </Text>

            <Text style={styles.footerWebsite}>cyprusvipestates.com</Text>
          </View>
        </View>
      </Page>
    </Document>,
  );

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slug}.pdf"`,
    },
  });
}
