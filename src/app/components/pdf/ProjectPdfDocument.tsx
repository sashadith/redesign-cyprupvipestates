// app/components/pdf/ProjectPdfDocument.tsx

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { Project } from "@/types/project";

type Props = {
  project: Project;
  lang: string;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 24,
    marginBottom: 12,
  },
  excerpt: {
    fontSize: 12,
    marginBottom: 20,
    lineHeight: 1.5,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  row: {
    marginBottom: 4,
  },
});

export default function ProjectPdfDocument({ project, lang }: Props) {
  const features = project.keyFeatures;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{project.title}</Text>

        {project.excerpt && (
          <Text style={styles.excerpt}>{project.excerpt}</Text>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {lang === "ru"
              ? "Основные характеристики"
              : lang === "pl"
                ? "Najważniejsze informacje"
                : lang === "de"
                  ? "Wichtige Informationen"
                  : "Key Features"}
          </Text>

          {features?.price && (
            <Text style={styles.row}>Price: €{features.price}</Text>
          )}

          {features?.city && (
            <Text style={styles.row}>City: {features.city}</Text>
          )}

          {features?.propertyType && (
            <Text style={styles.row}>Type: {features.propertyType}</Text>
          )}

          {features?.bedrooms && (
            <Text style={styles.row}>Bedrooms: {features.bedrooms}</Text>
          )}

          {features?.coveredArea && (
            <Text style={styles.row}>
              Covered area: {features.coveredArea} m²
            </Text>
          )}

          {features?.plotSize && (
            <Text style={styles.row}>Plot size: {features.plotSize} m²</Text>
          )}
        </View>

        {project.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {lang === "ru"
                ? "Описание"
                : lang === "pl"
                  ? "Opis"
                  : lang === "de"
                    ? "Beschreibung"
                    : "Description"}
            </Text>

            <Text>{project.description}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text>Cyprus VIP Estates</Text>
          <Text>https://cyprusvipestates.com</Text>
        </View>
      </Page>
    </Document>
  );
}
