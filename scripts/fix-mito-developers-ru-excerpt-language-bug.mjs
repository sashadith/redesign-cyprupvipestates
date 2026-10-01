// Found while gathering data for the RU developer-directory page (October
// content plan, sprint day 4): Developer.excerpt for mito-developers/ru was a
// literal copy of the PL row's text (checked: byte-identical), so the RU
// developer detail page and any listing using the excerpt showed Polish
// copy to Russian-speaking visitors. A quick scan of all 115 Developer rows
// across all 4 languages (Cyrillic/Polish-diacritic/German-umlaut heuristics)
// found no other instance of this — isolated, not systemic.
import fs from "node:fs";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const BUGGY_PL_TEXT =
  "Mito Developers to wiodący deweloper nieruchomości na Cyprze, specjalizujący się w luksusowych apartamentach i willach w Pafos. Dzięki współpracy z Cyprus VIP Estates oferujemy klientom najlepsze warunki zakupu, ekskluzywny dostęp do inwestycji oraz kompleksową obsługę.";
const NEW_RU_TEXT =
  "Mito Developers — застройщик элитной недвижимости на Кипре, специализирующийся на апартаментах и виллах премиум-класса в Пафосе. Благодаря партнёрству с Cyprus VIP Estates мы предлагаем клиентам лучшие условия покупки, эксклюзивный доступ к проектам и полное сопровождение сделки.";

async function main() {
  const ru = await prisma.developer.findFirst({ where: { slug: "mito-developers", language: "ru" }, select: { id: true, excerpt: true } });
  if (!ru) throw new Error("ABORT: mito-developers/ru not found");
  if (ru.excerpt !== BUGGY_PL_TEXT) {
    console.log("SKIPPED: RU excerpt no longer matches the known-buggy PL text, not overwriting");
    return;
  }
  await prisma.developer.update({ where: { id: ru.id }, data: { excerpt: NEW_RU_TEXT } });
  console.log("Fixed mito-developers RU excerpt (was Polish, now Russian).");
}

main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
